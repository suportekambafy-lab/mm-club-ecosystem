/**
 * Paddle adapter. Paddle is Merchant of Record and runs its own recurring
 * billing and dunning: we open a transaction, the member pays on our
 * /pagamento page (Paddle.js overlay), and Paddle charges future cycles by
 * itself. Off-session "charge this card now" is not offered by Paddle.
 */
import type {
  CreateChargeInput,
  GatewayCustomer,
  GatewayMandate,
  GatewayPayment,
  GatewaySubscription,
  NormalizedWebhook,
  PaymentGateway,
} from "./types";

export type PaddleEnv = "sandbox" | "live";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev/paddle";

/** Build-time token decides the environment: preview = test, published = live. */
export function paddleEnv(): PaddleEnv {
  const token = (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined) ?? "";
  return token.startsWith("test_") ? "sandbox" : "live";
}

function need(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not configured`);
  return v;
}

async function call<T>(path: string, init: RequestInit = {}, env = paddleEnv()): Promise<T> {
  const conn = need(env === "sandbox" ? "PADDLE_SANDBOX_API_KEY" : "PADDLE_LIVE_API_KEY");
  const res = await fetch(`${GATEWAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Connection-Api-Key": conn,
      "Lovable-API-Key": need("LOVABLE_API_KEY"),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Paddle ${path} failed [${res.status}]: ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

type PaddleTxn = {
  id: string;
  status: string;
  currency_code: string;
  customer_id: string | null;
  subscription_id: string | null;
  custom_data: Record<string, unknown> | null;
  billed_at: string | null;
  details?: { totals?: { grand_total?: string } };
  payments?: {
    status?: string;
    error_code?: string | null;
    captured_at?: string | null;
    payment_method_id?: string | null;
    method_details?: { type?: string } | null;
  }[];
};

const STATUS_MAP: Record<string, GatewayPayment["status"]> = {
  draft: "pending",
  ready: "pending",
  billed: "pending",
  paid: "paid",
  completed: "paid",
  canceled: "canceled",
  past_due: "failed",
};

export function normalizePaddleTxn(raw: PaddleTxn, checkoutUrl: string | null = null): GatewayPayment {
  const lastPay = raw.payments?.[0];
  return {
    id: raw.id,
    status: STATUS_MAP[raw.status] ?? "pending",
    amountCents: Number(raw.details?.totals?.grand_total ?? 0),
    currency: raw.currency_code ?? "EUR",
    method: lastPay?.method_details?.type ?? null,
    subscriptionId: raw.subscription_id ?? null,
    mandateId: lastPay?.payment_method_id ?? null,
    customerId: raw.customer_id ?? null,
    refundedCents: 0,
    metadata: (raw.custom_data ?? {}) as Record<string, unknown>,
    checkoutUrl,
    paidAt: lastPay?.captured_at ?? raw.billed_at ?? null,
    failureReason: lastPay?.error_code ?? null,
  };
}

export const paddleGateway: PaymentGateway = {
  name: "paddle",
  get environment() {
    return paddleEnv() === "sandbox" ? ("test" as const) : ("live" as const);
  },

  async createCustomer(input): Promise<GatewayCustomer> {
    const email = input.email?.trim().toLowerCase();
    if (email) {
      const found = await call<{ data: { id: string; email: string }[] }>(
        `/customers?email=${encodeURIComponent(email)}`,
      );
      if (found.data?.[0]) return { id: found.data[0].id, email: found.data[0].email };
    }
    const raw = await call<{ data: { id: string; email: string } }>("/customers", {
      method: "POST",
      body: JSON.stringify({ email, name: input.name ?? undefined, locale: "pt" }),
    });
    return { id: raw.data.id, email: raw.data.email };
  },

  async createCharge(input: CreateChargeInput): Promise<GatewayPayment> {
    const rec = input.recurring;
    const unitCents = rec ? rec.amountCents : input.amountCents;
    const body = {
      items: [
        {
          quantity: 1,
          price: {
            description: input.description,
            name: input.description,
            tax_mode: "internal",
            unit_price: { amount: String(unitCents), currency_code: input.currency },
            ...(rec
              ? {
                  billing_cycle: { interval: rec.interval, frequency: rec.frequency },
                  ...(rec.trialDays > 0
                    ? { trial_period: { interval: "day", frequency: rec.trialDays } }
                    : {}),
                }
              : {}),
            product: { name: rec?.productName ?? input.description, tax_category: "standard" },
          },
        },
      ],
      currency_code: input.currency,
      collection_mode: "automatic",
      custom_data: input.metadata,
      ...(input.customerId ? { customer_id: input.customerId } : {}),
    };
    const raw = await call<{ data: PaddleTxn }>("/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const origin = new URL(input.redirectUrl).origin;
    const url =
      `${origin}/pagamento?_ptxn=${encodeURIComponent(raw.data.id)}` +
      `&next=${encodeURIComponent(input.redirectUrl)}`;
    return normalizePaddleTxn(raw.data, url);
  },

  async getPayment(id: string): Promise<GatewayPayment> {
    const raw = await call<{ data: PaddleTxn }>(`/transactions/${encodeURIComponent(id)}`);
    return normalizePaddleTxn(raw.data);
  },

  async refundPayment(id: string): Promise<void> {
    await call("/adjustments", {
      method: "POST",
      body: JSON.stringify({
        action: "refund",
        transaction_id: id,
        type: "full",
        reason: "Reembolso MM Club",
      }),
    });
  },

  async listMandates(customerId: string): Promise<GatewayMandate[]> {
    const raw = await call<{
      data: { id: string; type: string; card?: { type?: string; last4?: string } | null }[];
    }>(`/customers/${encodeURIComponent(customerId)}/payment-methods`);
    return (raw.data ?? []).map((m) => ({
      id: m.id,
      status: "valid",
      method: m.type ?? null,
      brand: m.card?.type ?? null,
      last4: m.card?.last4 ?? null,
    }));
  },

  async chargeWithMandate(): Promise<GatewayPayment> {
    // Paddle retries renewals itself; we never charge a saved card by hand.
    throw new Error("Paddle: as renovações são cobradas automaticamente pelo Paddle");
  },

  async createSubscription(): Promise<GatewaySubscription> {
    // Paddle creates the subscription when the checkout transaction completes.
    throw new Error("Paddle: subscrições são criadas pelo próprio checkout");
  },

  async cancelSubscription(_customerId: string, subscriptionId: string): Promise<void> {
    await call(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ effective_from: "next_billing_period" }),
    });
  },

  async normalizeWebhook(body: string): Promise<NormalizedWebhook | null> {
    // Signature is verified by the /api/public/payments/webhook route.
    const evt = JSON.parse(body) as { event_type?: string; data?: { id?: string } };
    if (!evt.event_type?.startsWith("transaction.") || !evt.data?.id) return null;
    return { kind: "payment", gatewayPaymentId: evt.data.id };
  },
};

/** Paddle-Signature: "ts=...;h1=..." — HMAC-SHA256 of `${ts}:${body}`. */
export async function verifyPaddleSignature(
  body: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(";").map((p) => p.split("=") as [string, string]),
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}:${body}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== h1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ h1.charCodeAt(i);
  return diff === 0;
}

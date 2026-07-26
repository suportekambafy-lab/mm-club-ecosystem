import type {
  CreateChargeInput,
  CreateSubscriptionInput,
  GatewayCustomer,
  GatewayMandate,
  GatewayPayment,
  GatewaySubscription,
  NormalizedWebhook,
  PaymentGateway,
} from "./types";

const BASE = "https://api.mollie.com/v2";

function apiKey(): string {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) throw new Error("MOLLIE_API_KEY is not configured");
  return key;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mollie ${path} failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as T;
}

type MolliePaymentRaw = {
  id: string;
  status: string;
  amount: { value: string; currency: string };
  amountRefunded?: { value: string } | null;
  method?: string | null;
  subscriptionId?: string | null;
  mandateId?: string | null;
  customerId?: string | null;
  metadata?: Record<string, unknown> | null;
  paidAt?: string | null;
  details?: { failureReason?: string } | null;
  _links?: { checkout?: { href: string } };
};

const STATUS_MAP: Record<string, GatewayPayment["status"]> = {
  open: "pending",
  pending: "pending",
  authorized: "authorized",
  paid: "paid",
  failed: "failed",
  expired: "expired",
  canceled: "canceled",
};

function toCents(value: string | undefined | null): number {
  if (!value) return 0;
  return Math.round(parseFloat(value) * 100);
}

function normalizePayment(raw: MolliePaymentRaw): GatewayPayment {
  return {
    id: raw.id,
    status: STATUS_MAP[raw.status] ?? "pending",
    amountCents: toCents(raw.amount?.value),
    currency: raw.amount?.currency ?? "EUR",
    method: raw.method ?? null,
    subscriptionId: raw.subscriptionId ?? null,
    mandateId: raw.mandateId ?? null,
    customerId: raw.customerId ?? null,
    refundedCents: toCents(raw.amountRefunded?.value),
    metadata: (raw.metadata ?? {}) as Record<string, unknown>,
    checkoutUrl: raw._links?.checkout?.href ?? null,
    paidAt: raw.paidAt ?? null,
    failureReason: raw.details?.failureReason ?? null,
  };
}

function money(cents: number, currency: string) {
  return { currency, value: (cents / 100).toFixed(2) };
}

export const mollieGateway: PaymentGateway = {
  name: "mollie",
  get environment() {
    return apiKey().startsWith("test_") ? ("test" as const) : ("live" as const);
  },

  async createCustomer(input): Promise<GatewayCustomer> {
    const raw = await call<{ id: string; email?: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        email: input.email ?? undefined,
        name: input.name ?? undefined,
        metadata: input.metadata,
        locale: "pt_PT",
      }),
    });
    return { id: raw.id, email: raw.email ?? null };
  },

  async createCharge(input: CreateChargeInput): Promise<GatewayPayment> {
    const raw = await call<MolliePaymentRaw>("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: money(input.amountCents, input.currency),
        description: input.description,
        redirectUrl: input.redirectUrl,
        webhookUrl: input.webhookUrl,
        metadata: input.metadata,
        customerId: input.customerId ?? undefined,
        sequenceType: input.setupRecurring ? "first" : undefined,
        billingEmail: input.setupRecurring
          ? undefined
          : (input.customerEmail ?? undefined),
        locale: "pt_PT",
      }),
    });
    return normalizePayment(raw);
  },

  async getPayment(id: string): Promise<GatewayPayment> {
    const raw = await call<MolliePaymentRaw>(
      `/payments/${encodeURIComponent(id)}`,
    );
    return normalizePayment(raw);
  },

  async refundPayment(id: string, amountCents: number): Promise<void> {
    await call(`/payments/${encodeURIComponent(id)}/refunds`, {
      method: "POST",
      body: JSON.stringify({ amount: money(amountCents, "EUR") }),
    });
  },

  /**
   * Off-session charge on a stored mandate. Used to retry a failed renewal
   * with another card the member already has saved.
   */
  async chargeWithMandate(input): Promise<GatewayPayment> {
    const raw = await call<MolliePaymentRaw>("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: money(input.amountCents, input.currency),
        description: input.description,
        webhookUrl: input.webhookUrl,
        metadata: input.metadata,
        customerId: input.customerId,
        mandateId: input.mandateId,
        sequenceType: "recurring",
        locale: "pt_PT",
      }),
    });
    return normalizePayment(raw);
  },

  async listMandates(customerId: string): Promise<GatewayMandate[]> {

    const raw = await call<{
      _embedded?: {
        mandates?: {
          id: string;
          status: string;
          method?: string;
          details?: { cardLabel?: string; cardNumber?: string };
        }[];
      };
    }>(`/customers/${encodeURIComponent(customerId)}/mandates`);
    return (raw._embedded?.mandates ?? [])
      .filter((m) => m.status === "valid")
      .map((m) => ({
        id: m.id,
        status: m.status,
        method: m.method ?? null,
        brand: m.details?.cardLabel ?? null,
        last4: m.details?.cardNumber?.slice(-4) ?? null,
      }));
  },

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<GatewaySubscription> {
    const raw = await call<{
      id: string;
      status: string;
      nextPaymentDate?: string;
    }>(`/customers/${encodeURIComponent(input.customerId)}/subscriptions`, {
      method: "POST",
      body: JSON.stringify({
        mandateId: input.mandateId,
        amount: money(input.amountCents, input.currency),
        interval: input.interval,
        description: input.description,
        webhookUrl: input.webhookUrl,
        startDate: input.startDate,
        metadata: input.metadata,
      }),
    });
    return {
      id: raw.id,
      status: raw.status,
      nextPaymentAt: raw.nextPaymentDate ?? null,
    };
  },

  async cancelSubscription(
    customerId: string,
    subscriptionId: string,
  ): Promise<void> {
    await call(
      `/customers/${encodeURIComponent(customerId)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: "DELETE" },
    );
  },

  async normalizeWebhook(body: string): Promise<NormalizedWebhook | null> {
    const params = new URLSearchParams(body);
    const id = params.get("id");
    if (!id) return null;
    return { kind: "payment", gatewayPaymentId: id };
  },
};

const MOLLIE_BASE = "https://api.mollie.com/v2";

function getApiKey(): string {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) throw new Error("MOLLIE_API_KEY is not configured");
  return key;
}

export function mollieEnvironment(): "test" | "live" {
  return getApiKey().startsWith("test_") ? "test" : "live";
}

export async function mollieFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const key = getApiKey();
  return fetch(`${MOLLIE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export type MolliePayment = {
  id: string;
  status:
    | "open"
    | "canceled"
    | "pending"
    | "authorized"
    | "expired"
    | "failed"
    | "paid";
  amount: { value: string; currency: string };
  metadata?: Record<string, unknown> | null;
  _links?: { checkout?: { href: string } };
};

export async function createMolliePayment(input: {
  amountEUR: number;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  metadata: Record<string, unknown>;
  customerEmail?: string;
}): Promise<MolliePayment> {
  const res = await mollieFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: {
        currency: "EUR",
        value: input.amountEUR.toFixed(2),
      },
      description: input.description,
      redirectUrl: input.redirectUrl,
      webhookUrl: input.webhookUrl,
      metadata: input.metadata,
      billingEmail: input.customerEmail,
      locale: "pt_PT",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mollie create payment failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as MolliePayment;
}

export async function getMolliePayment(id: string): Promise<MolliePayment> {
  const res = await mollieFetch(`/payments/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mollie get payment failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as MolliePayment;
}

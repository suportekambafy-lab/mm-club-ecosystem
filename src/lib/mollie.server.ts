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

export type MollieCustomer = { id: string; email?: string; name?: string };

export async function createMollieCustomer(input: {
  email?: string;
  name?: string;
  metadata?: Record<string, unknown>;
}): Promise<MollieCustomer> {
  const res = await mollieFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      name: input.name,
      metadata: input.metadata,
      locale: "pt_PT",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mollie create customer failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as MollieCustomer;
}

export async function createMollieFirstPayment(input: {
  customerId: string;
  amountEUR: number;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  metadata: Record<string, unknown>;
}): Promise<MolliePayment> {
  const res = await mollieFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      customerId: input.customerId,
      sequenceType: "first",
      amount: { currency: "EUR", value: input.amountEUR.toFixed(2) },
      description: input.description,
      redirectUrl: input.redirectUrl,
      webhookUrl: input.webhookUrl,
      metadata: input.metadata,
      locale: "pt_PT",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mollie first payment failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as MolliePayment;
}

export type MollieMandate = { id: string; status: string; method: string };

export async function listValidMandates(
  customerId: string,
): Promise<MollieMandate[]> {
  const res = await mollieFetch(
    `/customers/${encodeURIComponent(customerId)}/mandates`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mollie list mandates failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as {
    _embedded?: { mandates?: MollieMandate[] };
  };
  return (json._embedded?.mandates ?? []).filter((m) => m.status === "valid");
}

export type MollieSubscription = {
  id: string;
  status: string;
  amount: { value: string; currency: string };
  interval: string;
  startDate?: string;
  nextPaymentDate?: string;
};

export async function createMollieSubscription(input: {
  customerId: string;
  mandateId: string;
  amountEUR: number;
  interval: string;
  description: string;
  webhookUrl: string;
  startDate?: string;
  metadata?: Record<string, unknown>;
}): Promise<MollieSubscription> {
  const res = await mollieFetch(
    `/customers/${encodeURIComponent(input.customerId)}/subscriptions`,
    {
      method: "POST",
      body: JSON.stringify({
        mandateId: input.mandateId,
        amount: { currency: "EUR", value: input.amountEUR.toFixed(2) },
        interval: input.interval,
        description: input.description,
        webhookUrl: input.webhookUrl,
        startDate: input.startDate,
        metadata: input.metadata,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Mollie create subscription failed [${res.status}]: ${body}`,
    );
  }
  return (await res.json()) as MollieSubscription;
}

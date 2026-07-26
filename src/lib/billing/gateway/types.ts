/**
 * PaymentGateway — the only contract the Billing Engine knows about.
 * No module outside `gateway/` may import a concrete gateway.
 */

export type GatewayCustomer = { id: string; email?: string | null };

export type GatewayPaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "expired"
  | "canceled";

export type GatewayPayment = {
  id: string;
  status: GatewayPaymentStatus;
  amountCents: number;
  currency: string;
  method: string | null;
  subscriptionId: string | null;
  mandateId: string | null;
  customerId: string | null;
  refundedCents: number;
  metadata: Record<string, unknown>;
  checkoutUrl: string | null;
  paidAt: string | null;
  failureReason: string | null;
};

export type GatewayMandate = {
  id: string;
  status: string;
  method: string | null;
  brand: string | null;
  last4: string | null;
};

export type GatewaySubscription = {
  id: string;
  status: string;
  nextPaymentAt: string | null;
};

export type CreateChargeInput = {
  amountCents: number;
  currency: string;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  metadata: Record<string, unknown>;
  customerId?: string | null;
  customerEmail?: string | null;
  /** true → collect a reusable mandate for future recurring charges */
  setupRecurring?: boolean;
};

export type CreateSubscriptionInput = {
  customerId: string;
  mandateId: string;
  amountCents: number;
  currency: string;
  /** e.g. "1 month", "12 months" */
  interval: string;
  description: string;
  webhookUrl: string;
  startDate?: string;
  metadata?: Record<string, unknown>;
};

/** Off-session charge on a stored mandate (retry with an alternate card). */
export type ChargeMandateInput = {
  customerId: string;
  mandateId: string;
  amountCents: number;
  currency: string;
  description: string;
  webhookUrl: string;
  metadata?: Record<string, unknown>;
};


export type NormalizedWebhook = {
  kind: "payment";
  gatewayPaymentId: string;
};

export interface PaymentGateway {
  readonly name: string;
  readonly environment: "test" | "live";

  createCustomer(input: {
    email?: string | null;
    name?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayCustomer>;

  createCharge(input: CreateChargeInput): Promise<GatewayPayment>;
  getPayment(id: string): Promise<GatewayPayment>;
  refundPayment(id: string, amountCents: number): Promise<void>;

  listMandates(customerId: string): Promise<GatewayMandate[]>;

  /** Charge an existing mandate without the member being present. */
  chargeWithMandate(input: ChargeMandateInput): Promise<GatewayPayment>;


  createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<GatewaySubscription>;
  cancelSubscription(customerId: string, subscriptionId: string): Promise<void>;

  normalizeWebhook(
    body: string,
    headers: Headers,
  ): Promise<NormalizedWebhook | null>;
}

export class GatewayNotImplemented extends Error {
  constructor(gateway: string, method: string) {
    super(`${gateway}: ${method} is not implemented yet`);
  }
}

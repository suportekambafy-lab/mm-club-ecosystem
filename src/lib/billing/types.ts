/**
 * MM Club Billing Engine — shared domain types.
 * Pure types only: safe to import from anywhere (client or server).
 */

export type Currency = "EUR";

/**
 * Card verification charged when starting a trial plan (VIP 3 meses grátis).
 * The plan itself stays free during the trial.
 */
export const TRIAL_VERIFICATION_CENTS = 100;

export type ProductKind =
  | "subscription"
  | "course"
  | "event"
  | "credit_pack"
  | "certificate"
  | "addon"
  | "physical";

export type PriceInterval =
  | "day"
  | "week"
  | "month"
  | "year"
  | "one_time"
  | "lifetime";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "grace_period"
  | "suspended"
  | "cancelled"
  | "expired";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "expired"
  | "canceled"
  | "refunded"
  | "partially_refunded"
  | "chargeback";

export type LedgerEntryType =
  | "payment"
  | "refund"
  | "chargeback"
  | "credit_granted"
  | "credit_consumed"
  | "adjustment"
  | "discount"
  | "tax"
  | "payout";

export type LedgerDirection = "debit" | "credit";

export type EntitlementSource =
  | "subscription"
  | "purchase"
  | "manual"
  | "gift"
  | "promo"
  | "signup";

export type CatalogProduct = {
  id: string;
  slug: string;
  kind: ProductKind;
  name: string;
  tagline: string | null;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

export type CatalogPrice = {
  id: string;
  productId: string;
  slug: string;
  version: number;
  amountCents: number;
  currency: string;
  interval: PriceInterval;
  intervalCount: number;
  trialDays: number;
  grantsCredits: number;
  displayLabel: string | null;
};

export type CatalogEntry = CatalogProduct & { prices: CatalogPrice[] };

export type SubscriptionView = {
  id: string;
  status: SubscriptionStatus;
  productName: string;
  productSlug: string;
  priceSlug: string;
  amountCents: number;
  currency: string;
  interval: PriceInterval;
  trialEnd: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  createdAt: string;
};

export type LedgerEntryView = {
  id: string;
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amountCents: number;
  currency: string;
  creditsDelta: number;
  memo: string | null;
  createdAt: string;
};

export type InvoiceView = {
  id: string;
  number: string | null;
  status: string;
  totalCents: number;
  currency: string;
  issuedAt: string | null;
  paidAt: string | null;
  pdfUrl: string | null;
};

export type TimelineItem = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  amountCents: number | null;
  currency: string | null;
  occurredAt: string;
};

export type PaymentMethodView = {
  id: string;
  gateway: string;
  method: string | null;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  status: string;
};

export function formatMoney(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

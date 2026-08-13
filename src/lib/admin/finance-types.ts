/** Client-safe shapes for the admin Financial Dashboard. */
import type {
  LedgerEntryView,
  PaymentMethodView,
  SubscriptionStatus,
  TimelineItem,
} from "@/lib/billing/types";

export type MoneyPoint = { label: string; cents: number; count: number };

/** Periods available in the admin date filter. */
export type FinanceRange =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "prev_month"
  | "90d"
  | "year"
  | "all";

export type FinancePeriod = {
  range: FinanceRange;
  label: string;
  startISO: string;
  endISO: string;
  revenueCents: number;
  paymentsCount: number;
  refundedCents: number;
  failedCount: number;
  chargebacksCount: number;
  newSubs: number;
  cancellations: number;
  avgTicketCents: number | null;
  byPlan: MoneyPoint[];
  byCountry: MoneyPoint[];
  byCoupon: MoneyPoint[];
  byMethod: { method: string; count: number; cents: number }[];
  byDay: MoneyPoint[];
  /** Split between trial-related payments (verification/trial start) and real sales. */
  trial: MoneyPoint;
  regular: MoneyPoint;
  byKind: MoneyPoint[];
};

export type FinanceOverview = {
  generatedAt: string;
  period: FinancePeriod;

  revenue: {
    todayCents: number;
    monthCents: number;
    prevMonthCents: number;
    last30Cents: number;
    mrrCents: number;
    arrCents: number;
    ltvCents: number | null;
    ltvSampleSize: number;
  };
  members: {
    activeSubscribers: number;
    trialing: number;
    newSubs30d: number;
    cancellations30d: number;
    churnRate: number | null;
  };
  payments: {
    todayCount: number;
    todayCents: number;
    failed30d: number;
    recovered30d: number;
    refunded30dCents: number;
    chargebacks30d: number;
    byMethod: { method: string; count: number; cents: number }[];
  };
  subscriptionsByStatus: Record<SubscriptionStatus, number>;
  revenueByPlan: MoneyPoint[];
  revenueByMonth: MoneyPoint[];
  revenueByCountry: MoneyPoint[];
  revenueByCoupon: MoneyPoint[];
  /** Daily net revenue, current month vs. same days of previous month. */
  dailySeries: { day: number; cents: number; prevCents: number }[];
  dunningRecoveredCents: number;

};

export type AdminSubscriptionRow = {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  status: SubscriptionStatus;
  productName: string;
  priceSlug: string;
  amountCents: number;
  currency: string;
  interval: string;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  /** Lifetime billing summary for the member (all subscriptions/purchases). */
  chargesCount?: number;
  lifetimeCents?: number;
  lastPaymentAt?: string | null;
};

/** Everything needed to answer "quanto já pagou e quantas vezes". */
export type CustomerBilling = {
  /** Successful charges (paid). */
  chargesCount: number;
  /** Net revenue collected (paid minus refunds). */
  netCents: number;
  grossCents: number;
  refundedCents: number;
  failedCount: number;
  chargebacksCount: number;
  avgTicketCents: number | null;
  firstPaymentAt: string | null;
  lastPaymentAt: string | null;
  /** Months since first payment (min 1) — used for revenue/month. */
  monthsAsCustomer: number;
  avgPerMonthCents: number | null;
  /** Current recurring value normalised to a month. */
  mrrCents: number;
  nextChargeAt: string | null;
  nextChargeCents: number | null;
  /** Net revenue per month, oldest → newest. */
  byMonth: MoneyPoint[];
  /** Net revenue per plan slug. */
  byPlan: MoneyPoint[];
};


export type AdminPaymentRow = {
  id: string;
  gateway: string;
  gatewayPaymentId: string;
  status: string;
  amountCents: number;
  refundedCents: number;
  currency: string;
  method: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type AdminInvoiceRow = {
  id: string;
  number: string | null;
  status: string;
  totalCents: number;
  currency: string;
  issuedAt: string | null;
  paidAt: string | null;
  pdfUrl: string | null;
};

export type AdminEventRow = {
  id: string;
  type: string;
  aggregateType: string;
  occurredAt: string;
  payloadJson: string;
};

export type CustomerDetail = {
  userId: string;
  email: string | null;
  name: string | null;
  country: string | null;
  createdAt: string | null;
  balanceCents: number;
  lifetimeCents: number;
  features: string[];
  credits: number | null;
  subscriptions: AdminSubscriptionRow[];
  payments: AdminPaymentRow[];
  invoices: AdminInvoiceRow[];
  ledger: LedgerEntryView[];
  timeline: TimelineItem[];
  paymentMethods: PaymentMethodView[];
  events: AdminEventRow[];
};

export type SearchHit = {
  userId: string;
  email: string | null;
  name: string | null;
  matchedOn: string;
  detail: string;
};

export type CouponRow = {
  id: string;
  code: string;
  name: string | null;
  percentOff: number | null;
  amountOffCents: number | null;
  duration: string;
  trialDaysOverride: number | null;
  maxRedemptions: number | null;
  redemptions: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  revenueCents: number;
  activeSubs: number;
  conversionRate: number | null;
};

export type CatalogPriceRow = {
  id: string;
  slug: string;
  version: number;
  amountCents: number;
  currency: string;
  interval: string;
  intervalCount: number;
  trialDays: number;
  grantsCredits: number;
  displayLabel: string | null;
  active: boolean;
  activeSubs: number;
};

export type CatalogProductRow = {
  id: string;
  slug: string;
  kind: string;
  name: string;
  tagline: string | null;
  sortOrder: number;
  active: boolean;
  features: { key: string; quota: number | null }[];
  prices: CatalogPriceRow[];
};

export type SubscriptionStateRow = {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  status: SubscriptionStatus;
  productName: string;
  priceSlug: string;
  amountCents: number;
  currency: string;
  interval: string;
  gateway: string | null;
  gatewaySubscriptionId: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  /** Most recent payment for this subscription. */
  lastPayment: {
    id: string;
    gatewayPaymentId: string;
    status: string;
    amountCents: number;
    currency: string;
    paidAt: string | null;
    createdAt: string;
    failureReason: string | null;
  } | null;
  paidCount: number;
  failedCount: number;
  /** Most recent webhook seen for this subscription's payments. */
  lastWebhook: {
    gateway: string;
    gatewayPaymentId: string | null;
    outcome: string;
    error: string | null;
    receivedAt: string;
  } | null;
  /** Active (non-revoked, non-expired) entitlement features for the account. */
  entitlements: {
    featureKey: string;
    source: string;
    quota: number | null;
    expiresAt: string | null;
  }[];
};

export type UpcomingChargeRow = {
  subscriptionId: string;
  userId: string;
  email: string | null;
  name: string | null;
  status: SubscriptionStatus;
  productName: string;
  priceSlug: string;
  amountCents: number;
  currency: string;
  interval: string;
  intervalCount: number;
  /** ISO date of the next expected charge. */
  chargeAt: string;
  /** True when this is the first charge right after a trial. */
  isFirstChargeAfterTrial: boolean;
  cancelAtPeriodEnd: boolean;
  gateway: string | null;
  gatewaySubscriptionId: string | null;
};

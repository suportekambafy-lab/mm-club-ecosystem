/** Client-safe shapes for the admin Financial Dashboard. */
import type {
  LedgerEntryView,
  PaymentMethodView,
  SubscriptionStatus,
  TimelineItem,
} from "@/lib/billing/types";

export type MoneyPoint = { label: string; cents: number; count: number };

export type FinanceOverview = {
  generatedAt: string;
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

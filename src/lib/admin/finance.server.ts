/**
 * Financial Dashboard data layer — admin only, server only.
 * Reads are done with the service role and aggregated in memory: the
 * dataset is small and this keeps every metric definition in one place.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SubscriptionStatus } from "@/lib/billing/types";
import type {
  AdminEventRow,
  AdminInvoiceRow,
  AdminPaymentRow,
  AdminSubscriptionRow,
  CatalogProductRow,
  CouponRow,
  CustomerDetail,
  FinanceOverview,
  FinancePeriod,
  FinanceRange,
  MoneyPoint,

  SearchHit,
  SubscriptionStateRow,
  UpcomingChargeRow,
} from "./finance-types";

const DAY = 86_400_000;
const ACTIVE_LIKE: SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "grace_period",
];

/** Normalizes any billing interval to a monthly recurring amount. */
export function monthlyCents(
  amountCents: number,
  interval: string,
  intervalCount = 1,
): number {
  const n = Math.max(1, intervalCount);
  switch (interval) {
    case "day":
      return Math.round((amountCents / n) * 30);
    case "week":
      return Math.round((amountCents / n) * 4.345);
    case "month":
      return Math.round(amountCents / n);
    case "year":
      return Math.round(amountCents / (12 * n));
    default:
      return 0; // one_time / lifetime never contribute to MRR
  }
}

function net(p: { amount_cents: number; refunded_cents: number | null }) {
  return p.amount_cents - (p.refunded_cents ?? 0);
}

function bump(map: Map<string, MoneyPoint>, label: string, cents: number) {
  const cur = map.get(label) ?? { label, cents: 0, count: 0 };
  cur.cents += cents;
  cur.count += 1;
  map.set(label, cur);
}

type PaymentRaw = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  price_id: string | null;
  status: string;
  amount_cents: number;
  refunded_cents: number | null;
  currency: string;
  method: string | null;
  paid_at: string | null;
  created_at: string;
};

type SubRaw = {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  price_id: string;
  coupon_id: string | null;
  created_at: string;
  cancelled_at: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

const RANGE_LABEL: Record<FinanceRange, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  month: "Este mês",
  prev_month: "Mês passado",
  "90d": "Últimos 90 dias",
  year: "Este ano",
  all: "Desde sempre",
};

/** Business timezone — all day/month buckets follow Lisbon, not UTC. */
const TZ = "Europe/Lisbon";

const TZ_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function tzParts(date: Date) {
  const p: Record<string, string> = {};
  for (const part of TZ_FMT.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour === "24" ? "0" : p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Local (Lisbon) calendar day of an instant, as YYYY-MM-DD. */
function tzDay(date: Date) {
  const t = tzParts(date);
  return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}

function tzOffsetMs(date: Date) {
  const t = tzParts(date);
  const asUTC = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
  return asUTC - date.getTime();
}

/** The UTC instant of local midnight for the given Lisbon calendar date. */
function tzStartOfDay(year: number, month0: number, day: number) {
  const guess = Date.UTC(year, month0, day);
  let ms = guess - tzOffsetMs(new Date(guess));
  // Re-check once in case the guess landed on the other side of a DST switch.
  ms = guess - tzOffsetMs(new Date(ms));
  return new Date(ms);
}

function resolveRange(range: FinanceRange, now: Date) {
  const t = tzParts(now);
  const y = t.year;
  const m = t.month - 1;
  const d = t.day;
  const startOfDay = tzStartOfDay(y, m, d);
  switch (range) {
    case "today":
      return { start: startOfDay, end: now };
    case "yesterday":
      return { start: tzStartOfDay(y, m, d - 1), end: startOfDay };
    case "7d":
      return { start: new Date(now.getTime() - 7 * DAY), end: now };
    case "30d":
      return { start: new Date(now.getTime() - 30 * DAY), end: now };
    case "month":
      return { start: tzStartOfDay(y, m, 1), end: now };
    case "prev_month":
      return {
        start: tzStartOfDay(y, m - 1, 1),
        end: tzStartOfDay(y, m, 1),
      };
    case "90d":
      return { start: new Date(now.getTime() - 90 * DAY), end: now };
    case "year":
      return { start: tzStartOfDay(y, 0, 1), end: now };
    case "all":
    default:
      return { start: new Date(0), end: now };
  }
}

export async function collectFinanceOverview(
  range: FinanceRange = "30d",
): Promise<FinanceOverview> {
  const now = new Date();
  const nowTz = tzParts(now);
  const startOfToday = tzStartOfDay(nowTz.year, nowTz.month - 1, nowTz.day);
  const startOfMonth = tzStartOfDay(nowTz.year, nowTz.month - 1, 1);
  const startOfPrevMonth = tzStartOfDay(nowTz.year, nowTz.month - 2, 1);
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since400 = new Date(now.getTime() - 400 * DAY);
  const period = resolveRange(range, now);


  const [paymentsRes, subsRes, pricesRes, productsRes, customersRes, couponsRes, recoveredRes] =
    await Promise.all([
      supabaseAdmin
        .from("billing_payments")
        .select(
          "id, user_id, subscription_id, price_id, status, amount_cents, refunded_cents, currency, method, paid_at, created_at",
        )
        .gte("created_at", since400.toISOString())
        .limit(5000),
      supabaseAdmin
        .from("billing_subscriptions")
        .select(
          "id, user_id, status, price_id, coupon_id, created_at, cancelled_at, trial_end, current_period_end, cancel_at_period_end",
        )
        .limit(5000),
      supabaseAdmin
        .from("catalog_prices")
        .select("id, slug, product_id, amount_cents, interval, interval_count"),
      supabaseAdmin.from("catalog_products").select("id, name, slug"),
      supabaseAdmin
        .from("billing_customers")
        .select("user_id, tax_country")
        .limit(5000),
      supabaseAdmin.from("billing_coupons").select("id, code"),
      supabaseAdmin
        .from("domain_events")
        .select("id", { count: "exact", head: true })
        .eq("type", "PaymentRecovered")
        .gte("occurred_at", since30.toISOString()),
    ]);

  const payments = (paymentsRes.data ?? []) as PaymentRaw[];
  const subs = (subsRes.data ?? []) as SubRaw[];
  const priceById = new Map(
    (pricesRes.data ?? []).map((p) => [p.id, p] as const),
  );
  const productById = new Map(
    (productsRes.data ?? []).map((p) => [p.id, p] as const),
  );
  const countryByUser = new Map(
    (customersRes.data ?? []).map((c) => [c.user_id, c.tax_country] as const),
  );
  const couponById = new Map(
    (couponsRes.data ?? []).map((c) => [c.id, c.code] as const),
  );
  const couponByUser = new Map<string, string>();
  for (const s of subs) {
    if (s.coupon_id) {
      couponByUser.set(s.user_id, couponById.get(s.coupon_id) ?? "—");
    }
  }

  // ---- Revenue -----------------------------------------------------------
  const paid = payments.filter((p) => p.status === "paid" && p.paid_at);
  let todayCents = 0;
  let monthCents = 0;
  let prevMonthCents = 0;
  let last30Cents = 0;
  let todayCount = 0;

  const byPlan = new Map<string, MoneyPoint>();
  const byMonth = new Map<string, MoneyPoint>();
  const byCountry = new Map<string, MoneyPoint>();
  const byCoupon = new Map<string, MoneyPoint>();
  const byMethod = new Map<string, { count: number; cents: number }>();
  const dayCurrent = new Map<number, number>();
  const dayPrev = new Map<number, number>();


  for (const p of paid) {
    const at = new Date(p.paid_at as string);
    const value = net(p);
    if (at >= startOfToday) {
      todayCents += value;
      todayCount += 1;
    }
    const dayOfMonth = tzParts(at).day;
    if (at >= startOfMonth) {
      monthCents += value;
      dayCurrent.set(dayOfMonth, (dayCurrent.get(dayOfMonth) ?? 0) + value);
    } else if (at >= startOfPrevMonth) {
      prevMonthCents += value;
      dayPrev.set(dayOfMonth, (dayPrev.get(dayOfMonth) ?? 0) + value);
    }
    if (at >= since30) last30Cents += value;


    const price = p.price_id ? priceById.get(p.price_id) : null;
    const planName = price
      ? (productById.get(price.product_id)?.name ?? price.slug)
      : "Avulso";
    bump(byPlan, planName, value);
    bump(byMonth, tzDay(at).slice(0, 7), value);
    bump(byCountry, countryByUser.get(p.user_id) ?? "—", value);
    const coupon = couponByUser.get(p.user_id);
    if (coupon) bump(byCoupon, coupon, value);

    const m = p.method ?? "desconhecido";
    const cur = byMethod.get(m) ?? { count: 0, cents: 0 };
    cur.count += 1;
    cur.cents += value;
    byMethod.set(m, cur);
  }

  // ---- MRR / ARR ---------------------------------------------------------
  let mrrCents = 0;
  const byStatus = {
    trialing: 0,
    active: 0,
    past_due: 0,
    grace_period: 0,
    suspended: 0,
    cancelled: 0,
    expired: 0,
  } as Record<SubscriptionStatus, number>;

  const activeUsers = new Set<string>();
  for (const s of subs) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    if (!ACTIVE_LIKE.includes(s.status)) continue;
    activeUsers.add(s.user_id);
    const price = priceById.get(s.price_id);
    if (!price) continue;
    // Trials contribute nothing until they convert.
    if (s.status === "trialing") continue;
    mrrCents += monthlyCents(
      price.amount_cents,
      price.interval,
      price.interval_count,
    );
  }

  // ---- Churn & LTV -------------------------------------------------------
  const newSubs30d = subs.filter(
    (s) => new Date(s.created_at) >= since30,
  ).length;
  const cancellations30d = subs.filter(
    (s) => s.cancelled_at && new Date(s.cancelled_at) >= since30,
  ).length;
  const baseline = activeUsers.size + cancellations30d;
  const churnRate = baseline > 0 ? cancellations30d / baseline : null;

  const lifetimeByUser = new Map<string, number>();
  for (const p of paid) {
    lifetimeByUser.set(p.user_id, (lifetimeByUser.get(p.user_id) ?? 0) + net(p));
  }
  const ltvSampleSize = lifetimeByUser.size;
  const ltvCents =
    ltvSampleSize >= 5
      ? Math.round(
          [...lifetimeByUser.values()].reduce((a, b) => a + b, 0) /
            ltvSampleSize,
        )
      : null;

  // ---- Payments ----------------------------------------------------------
  const in30 = (iso: string | null) => !!iso && new Date(iso) >= since30;
  const failed30d = payments.filter(
    (p) => p.status === "failed" && in30(p.created_at),
  ).length;
  const chargebacks30d = payments.filter(
    (p) => p.status === "chargeback" && in30(p.created_at),
  ).length;
  const refunded30dCents = payments
    .filter((p) => in30(p.created_at))
    .reduce((sum, p) => sum + (p.refunded_cents ?? 0), 0);
  const recovered30d = recoveredRes.count ?? 0;

  const sortDesc = (m: Map<string, MoneyPoint>) =>
    [...m.values()].sort((a, b) => b.cents - a.cents);

  // ---- Selected period ---------------------------------------------------
  const inPeriod = (iso: string | null) => {
    if (!iso) return false;
    const at = new Date(iso);
    return at >= period.start && at < period.end;
  };
  const subById = new Map(subs.map((s) => [s.id, s] as const));
  /**
   * A payment counts as "trial" when it happened inside the subscription's
   * trial window (card verification / trial activation) or the price itself is
   * a trial price. Those euros are not real sales.
   */
  const isTrialPayment = (p: PaymentRaw) => {
    const price = p.price_id ? priceById.get(p.price_id) : null;
    if (price && /trial|vip/i.test(price.slug)) return true;
    const sub = p.subscription_id ? subById.get(p.subscription_id) : null;
    if (sub?.trial_end && p.paid_at) {
      return new Date(p.paid_at) <= new Date(sub.trial_end);
    }
    return false;
  };

  const pPlan = new Map<string, MoneyPoint>();
  const pCountry = new Map<string, MoneyPoint>();
  const pCoupon = new Map<string, MoneyPoint>();
  const pDay = new Map<string, MoneyPoint>();
  const pMethod = new Map<string, { count: number; cents: number }>();
  const pKind = new Map<string, MoneyPoint>();
  let pRevenue = 0;
  let pCount = 0;
  let pTrialCents = 0;
  let pTrialCount = 0;
  for (const p of paid) {
    if (!inPeriod(p.paid_at)) continue;
    const at = new Date(p.paid_at as string);
    const value = net(p);
    pRevenue += value;
    pCount += 1;
    const trial = isTrialPayment(p);
    if (trial) {
      pTrialCents += value;
      pTrialCount += 1;
    }
    bump(pKind, trial ? "Trial / verificação" : "Venda paga", value);
    const price = p.price_id ? priceById.get(p.price_id) : null;
    bump(
      pPlan,
      `${price ? (productById.get(price.product_id)?.name ?? price.slug) : "Avulso"}${trial ? " · trial" : ""}`,
      value,
    );
    bump(pCountry, countryByUser.get(p.user_id) ?? "—", value);
    const coupon = couponByUser.get(p.user_id);
    if (coupon) bump(pCoupon, coupon, value);
    bump(pDay, tzDay(at), value);
    const m = p.method ?? "desconhecido";
    const cur = pMethod.get(m) ?? { count: 0, cents: 0 };
    cur.count += 1;
    cur.cents += value;
    pMethod.set(m, cur);
  }
  const periodBlock: FinancePeriod = {
    range,
    label: RANGE_LABEL[range],
    startISO: period.start.toISOString(),
    endISO: period.end.toISOString(),
    revenueCents: pRevenue,
    paymentsCount: pCount,
    refundedCents: payments
      .filter((p) => inPeriod(p.created_at))
      .reduce((sum, p) => sum + (p.refunded_cents ?? 0), 0),
    failedCount: payments.filter(
      (p) => p.status === "failed" && inPeriod(p.created_at),
    ).length,
    chargebacksCount: payments.filter(
      (p) => p.status === "chargeback" && inPeriod(p.created_at),
    ).length,
    newSubs: subs.filter((s) => inPeriod(s.created_at)).length,
    cancellations: subs.filter((s) => inPeriod(s.cancelled_at)).length,
    avgTicketCents: pCount > 0 ? Math.round(pRevenue / pCount) : null,
    byPlan: sortDesc(pPlan),
    byCountry: sortDesc(pCountry),
    byCoupon: sortDesc(pCoupon),
    byMethod: [...pMethod.entries()]
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.cents - a.cents),
    byDay: [...pDay.values()].sort((a, b) => a.label.localeCompare(b.label)),
    trial: {
      label: "Trial / verificação",
      cents: pTrialCents,
      count: pTrialCount,
    },
    regular: {
      label: "Venda paga",
      cents: pRevenue - pTrialCents,
      count: pCount - pTrialCount,
    },
    byKind: sortDesc(pKind),
  };

  return {
    generatedAt: new Date().toISOString(),
    period: periodBlock,

    revenue: {
      todayCents,
      monthCents,
      prevMonthCents,
      last30Cents,
      mrrCents,
      arrCents: mrrCents * 12,
      ltvCents,
      ltvSampleSize,
    },
    members: {
      activeSubscribers: activeUsers.size,
      trialing: byStatus.trialing,
      newSubs30d,
      cancellations30d,
      churnRate,
    },
    payments: {
      todayCount,
      todayCents,
      failed30d,
      recovered30d,
      refunded30dCents,
      chargebacks30d,
      byMethod: [...byMethod.entries()]
        .map(([method, v]) => ({ method, ...v }))
        .sort((a, b) => b.cents - a.cents),
    },
    subscriptionsByStatus: byStatus,
    revenueByPlan: sortDesc(byPlan),
    revenueByMonth: [...byMonth.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
    revenueByCountry: sortDesc(byCountry),
    revenueByCoupon: sortDesc(byCoupon),
    dailySeries: Array.from(
      {
        length: new Date(
          Date.UTC(
            startOfMonth.getUTCFullYear(),
            startOfMonth.getUTCMonth() + 1,
            0,
          ),
        ).getUTCDate(),
      },
      (_, i) => ({
        day: i + 1,
        cents: dayCurrent.get(i + 1) ?? 0,
        prevCents: dayPrev.get(i + 1) ?? 0,
      }),
    ),

    // Money that only arrived because a failed charge was retried: a paid
    // payment on a subscription that also failed at least once in the window.
    dunningRecoveredCents: (() => {
      const failedSubs = new Set(
        payments
          .filter((p) => p.status === "failed" && p.subscription_id && in30(p.created_at))
          .map((p) => p.subscription_id as string),
      );
      return paid
        .filter(
          (p) =>
            in30(p.paid_at) &&
            p.subscription_id &&
            failedSubs.has(p.subscription_id),
        )
        .reduce((sum, p) => sum + net(p), 0);
    })(),
  };
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export async function listSubscriptions(filter?: {
  status?: SubscriptionStatus | null;
  search?: string | null;
}): Promise<AdminSubscriptionRow[]> {
  const query = supabaseAdmin
    .from("billing_subscriptions")
    .select(
      "id, user_id, status, trial_end, current_period_end, cancel_at_period_end, created_at, product:catalog_products(name), price:catalog_prices!billing_subscriptions_price_id_fkey(slug, amount_cents, currency, interval)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const { data, error } = filter?.status
    ? await query.eq("status", filter.status)
    : await query;
  if (error) throw new Error(`listSubscriptions failed: ${error.message}`);


  const rows = (data ?? []) as unknown as (SubRaw & {
    product: { name: string } | null;
    price: {
      slug: string;
      amount_cents: number;
      currency: string;
      interval: string;
    } | null;
  })[];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const identities = await loadIdentities(userIds);

  const mapped: AdminSubscriptionRow[] = rows.map((r) => {
    const id = identities.get(r.user_id);
    return {
      id: r.id,
      userId: r.user_id,
      email: id?.email ?? null,
      name: id?.name ?? null,
      status: r.status,
      productName: r.product?.name ?? "MM Club",
      priceSlug: r.price?.slug ?? "",
      amountCents: r.price?.amount_cents ?? 0,
      currency: r.price?.currency ?? "EUR",
      interval: r.price?.interval ?? "month",
      trialEnd: r.trial_end,
      currentPeriodEnd: r.current_period_end,
      cancelAtPeriodEnd: Boolean(r.cancel_at_period_end),
      createdAt: r.created_at,
    };
  });

  const q = filter?.search?.trim().toLowerCase();
  if (!q) return mapped;
  return mapped.filter(
    (r) =>
      r.email?.toLowerCase().includes(q) ||
      r.name?.toLowerCase().includes(q) ||
      r.id.includes(q) ||
      r.userId.includes(q),
  );
}

type Identity = { email: string | null; name: string | null };

async function loadIdentities(
  userIds: string[],
): Promise<Map<string, Identity>> {
  const out = new Map<string, Identity>();
  if (userIds.length === 0) return out;

  const [customers, profiles] = await Promise.all([
    supabaseAdmin
      .from("billing_customers")
      .select("user_id, email, name")
      .in("user_id", userIds),
    supabaseAdmin.from("profiles").select("id, display_name").in("id", userIds),
  ]);

  for (const c of customers.data ?? []) {
    out.set(c.user_id, { email: c.email, name: c.name });
  }
  for (const p of profiles.data ?? []) {
    const cur = out.get(p.id) ?? { email: null, name: null };
    out.set(p.id, { email: cur.email, name: cur.name ?? p.display_name });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Customer 360
// ---------------------------------------------------------------------------

export async function collectCustomerDetail(
  userId: string,
): Promise<CustomerDetail> {
  const [
    customerRes,
    profileRes,
    subsRes,
    paymentsRes,
    invoicesRes,
    ledgerRes,
    timelineRes,
    pmRes,
    featuresRes,
    creditsRes,
    eventsRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("billing_customers")
      .select("user_id, email, name, tax_country, created_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("display_name, created_at")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_subscriptions")
      .select(
        "id, user_id, status, trial_end, current_period_end, cancel_at_period_end, created_at, product:catalog_products(name), price:catalog_prices!billing_subscriptions_price_id_fkey(slug, amount_cents, currency, interval)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("billing_payments")
      .select(
        "id, gateway, gateway_payment_id, status, amount_cents, refunded_cents, currency, method, failure_reason, paid_at, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("billing_invoices")
      .select(
        "id, number, status, total_cents, currency, issued_at, paid_at, pdf_url",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("billing_ledger_entries")
      .select(
        "id, entry_type, direction, amount_cents, currency, credits_delta, memo, created_at, balance_after",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("billing_timeline")
      .select(
        "id, kind, title, description, amount_cents, currency, occurred_at",
      )
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("billing_payment_methods")
      .select(
        "id, gateway, method, brand, last4, exp_month, exp_year, is_default, status",
      )
      .eq("user_id", userId),
    supabaseAdmin.rpc("resolve_entitlements", { _user_id: userId }),
    supabaseAdmin
      .from("mm_studio_credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("domain_events")
      .select("id, type, aggregate_type, payload, occurred_at")
      .contains("payload", { userId })
      .order("occurred_at", { ascending: false })
      .limit(60),
  ]);

  const subRows = (subsRes.data ?? []) as unknown as (SubRaw & {
    product: { name: string } | null;
    price: {
      slug: string;
      amount_cents: number;
      currency: string;
      interval: string;
    } | null;
  })[];

  const email = customerRes.data?.email ?? null;
  const name = customerRes.data?.name ?? profileRes.data?.display_name ?? null;

  const payments: AdminPaymentRow[] = (paymentsRes.data ?? []).map((p) => ({
    id: p.id,
    gateway: p.gateway,
    gatewayPaymentId: p.gateway_payment_id,
    status: p.status,
    amountCents: p.amount_cents,
    refundedCents: p.refunded_cents ?? 0,
    currency: p.currency,
    method: p.method,
    failureReason: p.failure_reason,
    paidAt: p.paid_at,
    createdAt: p.created_at,
  }));

  const invoices: AdminInvoiceRow[] = (invoicesRes.data ?? []).map((i) => ({
    id: i.id,
    number: i.number,
    status: i.status,
    totalCents: i.total_cents,
    currency: i.currency,
    issuedAt: i.issued_at,
    paidAt: i.paid_at,
    pdfUrl: i.pdf_url,
  }));

  const events: AdminEventRow[] = (eventsRes.data ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    aggregateType: e.aggregate_type,
    occurredAt: e.occurred_at,
    payloadJson: JSON.stringify(e.payload ?? {}),
  }));

  const ledgerRows = ledgerRes.data ?? [];

  return {
    userId,
    email,
    name,
    country: customerRes.data?.tax_country ?? null,
    createdAt: customerRes.data?.created_at ?? profileRes.data?.created_at ?? null,
    balanceCents: ledgerRows[0]?.balance_after ?? 0,
    lifetimeCents: payments
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + p.amountCents - p.refundedCents, 0),
    features: (featuresRes.data ?? []).map(
      (f: { feature_key: string }) => f.feature_key,
    ),
    credits: creditsRes.data?.balance ?? null,
    subscriptions: subRows.map((r) => ({
      id: r.id,
      userId,
      email,
      name,
      status: r.status,
      productName: r.product?.name ?? "MM Club",
      priceSlug: r.price?.slug ?? "",
      amountCents: r.price?.amount_cents ?? 0,
      currency: r.price?.currency ?? "EUR",
      interval: r.price?.interval ?? "month",
      trialEnd: r.trial_end,
      currentPeriodEnd: r.current_period_end,
      cancelAtPeriodEnd: Boolean(r.cancel_at_period_end),
      createdAt: r.created_at,
    })),
    payments,
    invoices,
    ledger: ledgerRows.map((l) => ({
      id: l.id,
      entryType: l.entry_type,
      direction: l.direction,
      amountCents: l.amount_cents,
      currency: l.currency,
      creditsDelta: l.credits_delta,
      memo: l.memo,
      createdAt: l.created_at,
    })),
    timeline: (timelineRes.data ?? []).map((t) => ({
      id: t.id,
      kind: t.kind,
      title: t.title,
      description: t.description,
      amountCents: t.amount_cents,
      currency: t.currency,
      occurredAt: t.occurred_at,
    })),
    paymentMethods: (pmRes.data ?? []).map((m) => ({
      id: m.id,
      gateway: m.gateway,
      method: m.method,
      brand: m.brand,
      last4: m.last4,
      expMonth: m.exp_month,
      expYear: m.exp_year,
      isDefault: m.is_default,
      status: m.status,
    })),
    events,
  };
}

// ---------------------------------------------------------------------------
// Global search
// ---------------------------------------------------------------------------

export async function globalSearch(term: string): Promise<SearchHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const hits = new Map<string, SearchHit>();

  const add = (
    userId: string | null | undefined,
    matchedOn: string,
    detail: string,
    email?: string | null,
    name?: string | null,
  ) => {
    if (!userId) return;
    if (hits.has(userId)) return;
    hits.set(userId, {
      userId,
      email: email ?? null,
      name: name ?? null,
      matchedOn,
      detail,
    });
  };

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);

  const [customers, profiles, invoices, payments, subs] = await Promise.all([
    supabaseAdmin
      .from("billing_customers")
      .select("user_id, email, name")
      .or(`email.ilike.${like},name.ilike.${like}`)
      .limit(20),
    supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", like)
      .limit(20),
    supabaseAdmin
      .from("billing_invoices")
      .select("user_id, number, total_cents")
      .ilike("number", like)
      .limit(20),
    supabaseAdmin
      .from("billing_payments")
      .select("user_id, gateway_payment_id, status")
      .ilike("gateway_payment_id", like)
      .limit(20),
    isUuid
      ? supabaseAdmin
          .from("billing_subscriptions")
          .select("id, user_id, status")
          .eq("id", q)
          .limit(5)
      : Promise.resolve({ data: [] as { id: string; user_id: string; status: string }[] }),
  ]);

  for (const c of customers.data ?? [])
    add(c.user_id, "email", c.email ?? "", c.email, c.name);
  for (const p of profiles.data ?? [])
    add(p.id, "nome", p.display_name ?? "", null, p.display_name);
  for (const i of invoices.data ?? [])
    add(i.user_id, "fatura", `Fatura ${i.number}`);
  for (const p of payments.data ?? [])
    add(p.user_id, "pagamento", `${p.gateway_payment_id} · ${p.status}`);
  for (const s of (subs.data ?? []) as { id: string; user_id: string; status: string }[])
    add(s.user_id, "subscrição", `${s.id} · ${s.status}`);

  if (isUuid) {
    const { data: byUser } = await supabaseAdmin
      .from("billing_customers")
      .select("user_id, email, name")
      .eq("user_id", q)
      .maybeSingle();
    if (byUser)
      add(byUser.user_id, "id do utilizador", q, byUser.email, byUser.name);
  }

  const missing = [...hits.values()].filter((h) => !h.email);
  if (missing.length > 0) {
    const identities = await loadIdentities(missing.map((m) => m.userId));
    for (const h of missing) {
      const id = identities.get(h.userId);
      if (id) hits.set(h.userId, { ...h, email: id.email, name: id.name });
    }
  }

  return [...hits.values()].slice(0, 25);
}

// ---------------------------------------------------------------------------
// Coupons & catalog
// ---------------------------------------------------------------------------

export async function listCoupons(): Promise<CouponRow[]> {
  const [couponsRes, redemptionsRes, subsRes, paymentsRes] = await Promise.all([
    supabaseAdmin
      .from("billing_coupons")
      .select(
        "id, code, name, percent_off, amount_off_cents, duration, trial_days_override, max_redemptions, redemptions, valid_from, valid_until, active",
      )
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("billing_coupon_redemptions")
      .select("coupon_id, user_id"),
    supabaseAdmin
      .from("billing_subscriptions")
      .select("coupon_id, user_id, status"),
    supabaseAdmin
      .from("billing_payments")
      .select("user_id, amount_cents, refunded_cents, status")
      .eq("status", "paid")
      .limit(5000),
  ]);

  const usersByCoupon = new Map<string, Set<string>>();
  for (const r of redemptionsRes.data ?? []) {
    if (!usersByCoupon.has(r.coupon_id))
      usersByCoupon.set(r.coupon_id, new Set());
    usersByCoupon.get(r.coupon_id)!.add(r.user_id);
  }
  const activeByCoupon = new Map<string, number>();
  for (const s of subsRes.data ?? []) {
    if (!s.coupon_id) continue;
    if (!usersByCoupon.has(s.coupon_id))
      usersByCoupon.set(s.coupon_id, new Set());
    usersByCoupon.get(s.coupon_id)!.add(s.user_id);
    if (ACTIVE_LIKE.includes(s.status as SubscriptionStatus)) {
      activeByCoupon.set(s.coupon_id, (activeByCoupon.get(s.coupon_id) ?? 0) + 1);
    }
  }

  const revenueByUser = new Map<string, number>();
  for (const p of paymentsRes.data ?? []) {
    revenueByUser.set(
      p.user_id,
      (revenueByUser.get(p.user_id) ?? 0) + p.amount_cents - (p.refunded_cents ?? 0),
    );
  }

  return (couponsRes.data ?? []).map((c) => {
    const users = usersByCoupon.get(c.id) ?? new Set<string>();
    const revenueCents = [...users].reduce(
      (s, u) => s + (revenueByUser.get(u) ?? 0),
      0,
    );
    const activeSubs = activeByCoupon.get(c.id) ?? 0;
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      percentOff: c.percent_off != null ? Number(c.percent_off) : null,
      amountOffCents: c.amount_off_cents,
      duration: c.duration,
      trialDaysOverride: c.trial_days_override,
      maxRedemptions: c.max_redemptions,
      redemptions: users.size || c.redemptions,
      validFrom: c.valid_from,
      validUntil: c.valid_until,
      active: c.active,
      revenueCents,
      activeSubs,
      conversionRate: users.size > 0 ? activeSubs / users.size : null,
    };
  });
}

export async function listCatalogAdmin(): Promise<CatalogProductRow[]> {
  const [productsRes, pricesRes, featuresRes, subsRes] = await Promise.all([
    supabaseAdmin
      .from("catalog_products")
      .select("id, slug, kind, name, tagline, sort_order, active")
      .order("sort_order"),
    supabaseAdmin
      .from("catalog_prices")
      .select(
        "id, product_id, slug, version, amount_cents, currency, interval, interval_count, trial_days, grants_credits, display_label, active",
      )
      .order("version", { ascending: false }),
    supabaseAdmin
      .from("catalog_product_features")
      .select("product_id, feature_key, quota"),
    supabaseAdmin.from("billing_subscriptions").select("price_id, status"),
  ]);

  const activeByPrice = new Map<string, number>();
  for (const s of subsRes.data ?? []) {
    if (!ACTIVE_LIKE.includes(s.status as SubscriptionStatus)) continue;
    activeByPrice.set(s.price_id, (activeByPrice.get(s.price_id) ?? 0) + 1);
  }

  return (productsRes.data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    kind: p.kind,
    name: p.name,
    tagline: p.tagline,
    sortOrder: p.sort_order,
    active: p.active,
    features: (featuresRes.data ?? [])
      .filter((f) => f.product_id === p.id)
      .map((f) => ({ key: f.feature_key, quota: f.quota })),
    prices: (pricesRes.data ?? [])
      .filter((pr) => pr.product_id === p.id)
      .map((pr) => ({
        id: pr.id,
        slug: pr.slug,
        version: pr.version,
        amountCents: pr.amount_cents,
        currency: pr.currency,
        interval: pr.interval,
        intervalCount: pr.interval_count,
        trialDays: pr.trial_days,
        grantsCredits: pr.grants_credits,
        displayLabel: pr.display_label,
        active: pr.active,
        activeSubs: activeByPrice.get(pr.id) ?? 0,
      })),
  }));
}

// ---------------------------------------------------------------------------
// Subscription state & entitlements (operational view)
// ---------------------------------------------------------------------------

export async function listSubscriptionStates(): Promise<SubscriptionStateRow[]> {
  const { data, error } = await supabaseAdmin
    .from("billing_subscriptions")
    .select(
      "id, user_id, status, gateway, gateway_subscription_id, trial_end, current_period_end, cancel_at_period_end, created_at, product:catalog_products(name), price:catalog_prices!billing_subscriptions_price_id_fkey(slug, amount_cents, currency, interval)",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(`listSubscriptionStates failed: ${error.message}`);

  const subs = (data ?? []) as unknown as (SubRaw & {
    gateway: string | null;
    gateway_subscription_id: string | null;
    product: { name: string } | null;
    price: {
      slug: string;
      amount_cents: number;
      currency: string;
      interval: string;
    } | null;
  })[];

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const subIds = subs.map((s) => s.id);
  if (subIds.length === 0) return [];

  const [identities, paymentsRes, grantsRes] = await Promise.all([
    loadIdentities(userIds),
    supabaseAdmin
      .from("billing_payments")
      .select(
        "id, subscription_id, gateway_payment_id, status, amount_cents, currency, paid_at, created_at, failure_reason",
      )
      .in("subscription_id", subIds)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabaseAdmin
      .from("entitlement_grants")
      .select("user_id, feature_key, source, quota, expires_at, revoked_at")
      .in("user_id", userIds)
      .is("revoked_at", null)
      .limit(5000),
  ]);

  const payments = paymentsRes.data ?? [];
  const paymentIds = [
    ...new Set(payments.map((p) => p.gateway_payment_id).filter(Boolean)),
  ] as string[];

  const hooksRes = paymentIds.length
    ? await supabaseAdmin
        .from("ops_webhook_log")
        .select("gateway, gateway_payment_id, outcome, error, received_at")
        .in("gateway_payment_id", paymentIds)
        .order("received_at", { ascending: false })
        .limit(2000)
    : { data: [] as never[] };

  const hookByPayment = new Map<
    string,
    { gateway: string; gateway_payment_id: string | null; outcome: string; error: string | null; received_at: string }
  >();
  for (const h of hooksRes.data ?? []) {
    const key = h.gateway_payment_id ?? "";
    if (key && !hookByPayment.has(key)) hookByPayment.set(key, h);
  }

  const now = Date.now();

  return subs.map((s) => {
    const id = identities.get(s.user_id);
    const mine = payments.filter((p) => p.subscription_id === s.id);
    const last = mine[0] ?? null;
    const hook = last?.gateway_payment_id
      ? (hookByPayment.get(last.gateway_payment_id) ?? null)
      : null;

    return {
      id: s.id,
      userId: s.user_id,
      email: id?.email ?? null,
      name: id?.name ?? null,
      status: s.status,
      productName: s.product?.name ?? "MM Club",
      priceSlug: s.price?.slug ?? "",
      amountCents: s.price?.amount_cents ?? 0,
      currency: s.price?.currency ?? "EUR",
      interval: s.price?.interval ?? "month",
      gateway: s.gateway ?? null,
      gatewaySubscriptionId: s.gateway_subscription_id ?? null,
      trialEnd: s.trial_end,
      currentPeriodEnd: s.current_period_end,
      cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
      createdAt: s.created_at,
      lastPayment: last
        ? {
            id: last.id,
            gatewayPaymentId: last.gateway_payment_id,
            status: last.status,
            amountCents: last.amount_cents,
            currency: last.currency,
            paidAt: last.paid_at,
            createdAt: last.created_at,
            failureReason: last.failure_reason,
          }
        : null,
      paidCount: mine.filter((p) => p.status === "paid").length,
      failedCount: mine.filter((p) => p.status === "failed").length,
      lastWebhook: hook
        ? {
            gateway: hook.gateway,
            gatewayPaymentId: hook.gateway_payment_id,
            outcome: hook.outcome,
            error: hook.error,
            receivedAt: hook.received_at,
          }
        : null,
      entitlements: (grantsRes.data ?? [])
        .filter(
          (g) =>
            g.user_id === s.user_id &&
            (!g.expires_at || new Date(g.expires_at).getTime() > now),
        )
        .map((g) => ({
          featureKey: g.feature_key,
          source: String(g.source),
          quota: g.quota,
          expiresAt: g.expires_at,
        }))
        .sort((a, b) => a.featureKey.localeCompare(b.featureKey)),
    } satisfies SubscriptionStateRow;
  });
}

// ---------------------------------------------------------------------------
// Upcoming charges (próximos débitos)
// ---------------------------------------------------------------------------

/**
 * Every subscription that is expected to be charged again, sorted by date.
 * The charge date is the trial end while trialing, otherwise the end of the
 * current period. Subscriptions set to cancel at period end are flagged but
 * still listed so admins can see the revenue that is about to drop off.
 */
export async function listUpcomingCharges(): Promise<UpcomingChargeRow[]> {
  const { data, error } = await supabaseAdmin
    .from("billing_subscriptions")
    .select(
      "id, user_id, status, gateway, gateway_subscription_id, trial_end, current_period_end, cancel_at_period_end, product:catalog_products(name), price:catalog_prices!billing_subscriptions_price_id_fkey(slug, amount_cents, currency, interval, interval_count)",
    )
    .in("status", ACTIVE_LIKE)
    .limit(1000);
  if (error) throw new Error(`listUpcomingCharges failed: ${error.message}`);

  const subs = (data ?? []) as unknown as {
    id: string;
    user_id: string;
    status: SubscriptionStatus;
    gateway: string | null;
    gateway_subscription_id: string | null;
    trial_end: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
    product: { name: string } | null;
    price: {
      slug: string;
      amount_cents: number;
      currency: string;
      interval: string;
      interval_count: number | null;
    } | null;
  }[];

  const identities = await loadIdentities([
    ...new Set(subs.map((s) => s.user_id)),
  ]);

  const rows: UpcomingChargeRow[] = [];
  for (const s of subs) {
    const trialing = s.status === "trialing" && s.trial_end;
    const chargeAt = trialing ? s.trial_end : s.current_period_end;
    if (!chargeAt) continue;
    const interval = s.price?.interval ?? "month";
    if (interval === "one_time" || interval === "lifetime") continue;
    const id = identities.get(s.user_id);
    rows.push({
      subscriptionId: s.id,
      userId: s.user_id,
      email: id?.email ?? null,
      name: id?.name ?? null,
      status: s.status,
      productName: s.product?.name ?? "MM Club",
      priceSlug: s.price?.slug ?? "",
      amountCents: s.price?.amount_cents ?? 0,
      currency: s.price?.currency ?? "EUR",
      interval,
      intervalCount: s.price?.interval_count ?? 1,
      chargeAt,
      isFirstChargeAfterTrial: Boolean(trialing),
      cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
      gateway: s.gateway ?? null,
      gatewaySubscriptionId: s.gateway_subscription_id ?? null,
    });
  }

  rows.sort((a, b) => a.chargeAt.localeCompare(b.chargeAt));
  return rows;
}

/**
 * Revenue Intelligence — Customer Payment Profile (server-only).
 *
 * Rebuilds the permanent payment behaviour profile of a member from billing
 * history. Pure aggregation over data we already store: the profile is a
 * cache of the truth, never the truth itself, and is never deleted.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emptyProfile, type CustomerPaymentProfile } from "./intelligence";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type ProfileTrigger =
  | "payment_succeeded"
  | "payment_failed"
  | "method_updated"
  | "login"
  | "plan_changed"
  | "debt_recovered"
  | "suspended"
  | "cancelled"
  | "manual";

type Row = Record<string, unknown>;

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Most frequent value in a list. */
function mode<T extends string | number>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

/** Recomputes the profile from scratch and persists it. */
export async function refreshCustomerProfile(
  userId: string,
  trigger: ProfileTrigger,
): Promise<CustomerPaymentProfile> {
  const [payments, invoices, attempts, methods, events, login] = await Promise.all([
    supabaseAdmin
      .from("billing_payments")
      .select("status, method, amount_cents, refunded_cents, paid_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1000),
    supabaseAdmin
      .from("billing_invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabaseAdmin
      .from("billing_dunning_attempts")
      .select("cycle_key, status, created_at, attempted_at, recovered_at, method")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(2000),
    supabaseAdmin
      .from("billing_payment_methods")
      .select("status, created_at, exp_month, exp_year")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("domain_events")
      .select("type, occurred_at, payload")
      .in("type", ["SubscriptionSuspended", "SubscriptionCancelled"])
      .contains("payload", { userId } as never)
      .limit(200),
    supabaseAdmin
      .from("security_sessions")
      .select("last_seen_at")
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const p = emptyProfile(userId);
  const rows = (payments.data ?? []) as Row[];

  const paid = rows.filter(
    (r) => r.status === "paid" || r.status === "partially_refunded",
  );
  const failed = rows.filter((r) =>
    ["failed", "expired", "canceled"].includes(String(r.status)),
  );

  p.invoicesTotal = invoices.count ?? 0;
  p.paymentsSucceeded = paid.length;
  p.paymentsFailed = failed.length;
  p.chargebacks = rows.filter((r) => r.status === "chargeback").length;
  p.refunds = rows.filter(
    (r) => r.status === "refunded" || num(r.refunded_cents) > 0,
  ).length;

  // Consecutive successes at the tail of the history.
  let streak = 0;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const s = String(rows[i].status);
    if (s === "paid" || s === "partially_refunded") streak += 1;
    else if (["failed", "expired", "canceled", "chargeback"].includes(s)) break;
  }
  p.consecutiveSuccesses = streak;

  const firstAt = rows[0]?.created_at as string | undefined;
  p.customerSince = firstAt ?? null;
  p.monthsAsCustomer = firstAt
    ? Math.max(0, (Date.now() - new Date(firstAt).getTime()) / (30 * DAY))
    : 0;

  const paidDates = paid
    .map((r) => (r.paid_at ?? r.created_at) as string | null)
    .filter(Boolean)
    .map((iso) => new Date(iso as string));
  p.lastPaymentAt = paidDates.length
    ? paidDates[paidDates.length - 1].toISOString()
    : null;
  p.typicalPayDay = mode(paidDates.map((d) => d.getDate()));
  p.bestPayHour = mode(paidDates.map((d) => d.getHours()));

  // Method preference and effectiveness.
  p.preferredMethod = mode(rows.map((r) => (r.method as string) ?? "").filter(Boolean));
  const byMethod = new Map<string, { ok: number; total: number }>();
  for (const r of rows) {
    const m = (r.method as string) ?? null;
    if (!m) continue;
    const e = byMethod.get(m) ?? { ok: 0, total: 0 };
    e.total += 1;
    if (r.status === "paid") e.ok += 1;
    byMethod.set(m, e);
  }
  let bestRate = -1;
  for (const [m, e] of byMethod) {
    if (e.total < 2) continue;
    const rate = e.ok / e.total;
    if (rate > bestRate) {
      bestRate = rate;
      p.bestMethod = m;
      p.bestMethodRate = rate;
    }
  }

  // Recovery history, per cycle.
  const cycles = new Map<string, Row[]>();
  for (const a of (attempts.data ?? []) as Row[]) {
    const key = (a.cycle_key as string) ?? "";
    if (!key) continue;
    const list = cycles.get(key) ?? [];
    list.push(a);
    cycles.set(key, list);
  }
  const recoverHours: number[] = [];
  for (const list of cycles.values()) {
    const recovered = list.find((a) => a.status === "succeeded");
    const open = list.some((a) => a.status === "scheduled");
    if (recovered) {
      p.recoveriesSucceeded += 1;
      const start = new Date(String(list[0].created_at)).getTime();
      const end = new Date(
        String(recovered.recovered_at ?? recovered.attempted_at ?? list[0].created_at),
      ).getTime();
      if (end > start) recoverHours.push((end - start) / HOUR);
    } else if (!open) {
      p.recoveriesFailed += 1;
    }
  }
  const closed = p.recoveriesSucceeded + p.recoveriesFailed;
  p.recoveryRate = closed > 0 ? p.recoveriesSucceeded / closed : 0;
  p.avgHoursToRecover = avg(recoverHours);
  p.avgDaysFailureToPayment = p.avgHoursToRecover ? p.avgHoursToRecover / 24 : null;

  const lastFailure = failed[failed.length - 1];
  p.lastFailureAt = (lastFailure?.created_at as string) ?? null;

  // Payment methods: churn and dead cards.
  const methodRows = (methods.data ?? []) as Row[];
  p.cardChanges = Math.max(0, methodRows.length - 1);
  p.lastMethodChangeAt = (methodRows[0]?.created_at as string) ?? null;
  const now = new Date();
  p.expiredCards = methodRows.filter((m) => {
    if (m.status === "expired" || m.status === "invalid") return true;
    const y = m.exp_year as number | null;
    const mo = m.exp_month as number | null;
    if (!y || !mo) return false;
    return new Date(y, mo, 1) < now;
  }).length;

  const eventRows = (events.data ?? []) as Row[];
  p.suspensions = eventRows.filter((e) => e.type === "SubscriptionSuspended").length;
  p.cancellations = eventRows.filter((e) => e.type === "SubscriptionCancelled").length;

  // Suspension → recovery latency.
  const suspensionTimes = eventRows
    .filter((e) => e.type === "SubscriptionSuspended")
    .map((e) => new Date(String(e.occurred_at)).getTime())
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (const t of suspensionTimes) {
    const next = paidDates.find((d) => d.getTime() > t);
    if (next) gaps.push((next.getTime() - t) / HOUR);
  }
  p.avgHoursSuspensionToRecovery = avg(gaps);

  p.lastLoginAt = (login.data?.last_seen_at as string) ?? null;
  p.refreshedAt = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from("billing_customer_profiles")
    .select("last_score, last_score_at")
    .eq("user_id", userId)
    .maybeSingle();
  p.lastScore = (existing?.last_score as number) ?? null;
  p.lastScoreAt = (existing?.last_score_at as string) ?? null;

  await supabaseAdmin.from("billing_customer_profiles").upsert(
    {
      user_id: userId,
      customer_since: p.customerSince,
      months_as_customer: p.monthsAsCustomer,
      invoices_total: p.invoicesTotal,
      payments_succeeded: p.paymentsSucceeded,
      payments_failed: p.paymentsFailed,
      consecutive_successes: p.consecutiveSuccesses,
      recoveries_succeeded: p.recoveriesSucceeded,
      recoveries_failed: p.recoveriesFailed,
      recovery_rate: p.recoveryRate,
      avg_hours_to_recover: p.avgHoursToRecover,
      avg_days_failure_to_payment: p.avgDaysFailureToPayment,
      chargebacks: p.chargebacks,
      refunds: p.refunds,
      typical_pay_day: p.typicalPayDay,
      best_pay_hour: p.bestPayHour,
      preferred_method: p.preferredMethod,
      best_method: p.bestMethod,
      best_method_rate: p.bestMethodRate,
      card_changes: p.cardChanges,
      expired_cards: p.expiredCards,
      suspensions: p.suspensions,
      cancellations: p.cancellations,
      avg_hours_suspension_to_recovery: p.avgHoursSuspensionToRecovery,
      last_payment_at: p.lastPaymentAt,
      last_failure_at: p.lastFailureAt,
      last_method_change_at: p.lastMethodChangeAt,
      last_login_at: p.lastLoginAt,
      refreshed_at: p.refreshedAt,
    } as never,
    { onConflict: "user_id" },
  );

  await supabaseAdmin.from("audit_log").insert({
    action: "recovery.profile_refreshed",
    entity_type: "user",
    entity_id: userId,
    after: { trigger, recoveryRate: p.recoveryRate } as never,
  });

  return p;
}

/** Reads the stored profile (rebuilding it once if it does not exist yet). */
export async function getCustomerProfile(
  userId: string,
): Promise<CustomerPaymentProfile> {
  const { data } = await supabaseAdmin
    .from("billing_customer_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return refreshCustomerProfile(userId, "manual");
  return mapProfileRow(data as Row);
}

export function mapProfileRow(r: Row): CustomerPaymentProfile {
  const p = emptyProfile(String(r.user_id));
  p.customerSince = (r.customer_since as string) ?? null;
  p.monthsAsCustomer = num(r.months_as_customer);
  p.invoicesTotal = num(r.invoices_total);
  p.paymentsSucceeded = num(r.payments_succeeded);
  p.paymentsFailed = num(r.payments_failed);
  p.consecutiveSuccesses = num(r.consecutive_successes);
  p.recoveriesSucceeded = num(r.recoveries_succeeded);
  p.recoveriesFailed = num(r.recoveries_failed);
  p.recoveryRate = num(r.recovery_rate);
  p.avgHoursToRecover =
    r.avg_hours_to_recover == null ? null : num(r.avg_hours_to_recover);
  p.avgDaysFailureToPayment =
    r.avg_days_failure_to_payment == null ? null : num(r.avg_days_failure_to_payment);
  p.chargebacks = num(r.chargebacks);
  p.refunds = num(r.refunds);
  p.typicalPayDay = r.typical_pay_day == null ? null : num(r.typical_pay_day);
  p.bestPayHour = r.best_pay_hour == null ? null : num(r.best_pay_hour);
  p.preferredMethod = (r.preferred_method as string) ?? null;
  p.bestMethod = (r.best_method as string) ?? null;
  p.bestMethodRate = r.best_method_rate == null ? null : num(r.best_method_rate);
  p.cardChanges = num(r.card_changes);
  p.expiredCards = num(r.expired_cards);
  p.suspensions = num(r.suspensions);
  p.cancellations = num(r.cancellations);
  p.avgHoursSuspensionToRecovery =
    r.avg_hours_suspension_to_recovery == null
      ? null
      : num(r.avg_hours_suspension_to_recovery);
  p.lastPaymentAt = (r.last_payment_at as string) ?? null;
  p.lastFailureAt = (r.last_failure_at as string) ?? null;
  p.lastMethodChangeAt = (r.last_method_change_at as string) ?? null;
  p.lastLoginAt = (r.last_login_at as string) ?? null;
  p.lastScore = r.last_score == null ? null : num(r.last_score);
  p.lastScoreAt = (r.last_score_at as string) ?? null;
  p.refreshedAt = (r.refreshed_at as string) ?? null;
  return p;
}

export async function storeLastScore(userId: string, score: number): Promise<void> {
  await supabaseAdmin
    .from("billing_customer_profiles")
    .update({ last_score: score, last_score_at: new Date().toISOString() } as never)
    .eq("user_id", userId);
}

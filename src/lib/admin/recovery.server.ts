/**
 * Revenue Recovery — admin analytics (server-only).
 * Reads the dunning ledger and turns it into the numbers the Recovery
 * dashboard shows. No writes, no side effects.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MAX_RECOVERY_ATTEMPTS } from "@/lib/billing/recovery/schedule";
import type {
  RecoveryCustomerRow,
  RecoveryMethodMetric,
  RecoveryOverview,
  RecoveryPhaseMetric,
  RecoveryReasonMetric,
} from "./recovery-types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const PHASE_LABEL: Record<string, string> = {
  immediate: "Primeiras 24 horas",
  grace: "Grace period (dias 2–3)",
  suspended: "Pós-suspensão (dias 4–90)",
};

type AttemptRow = {
  id: string;
  cycle_key: string | null;
  subscription_id: string;
  user_id: string;
  attempt_number: number;
  scheduled_for: string;
  attempted_at: string | null;
  created_at: string;
  recovered_at: string | null;
  status: string;
  phase: string;
  error_category: string | null;
  gateway_error_code: string | null;
  gateway_error_message: string | null;
  recovery_score: number | null;
  amount_cents: number;
  currency: string;
  method: string | null;
};

const REACHED_GATEWAY = ["attempted", "succeeded", "failed"];

export async function collectRecoveryOverview(): Promise<RecoveryOverview> {
  const since = new Date(Date.now() - 365 * DAY).toISOString();

  const [{ data: rawAttempts }, { data: subs }] = await Promise.all([
    supabaseAdmin
      .from("billing_dunning_attempts")
      .select(
        "id, cycle_key, subscription_id, user_id, attempt_number, scheduled_for, attempted_at, created_at, recovered_at, status, phase, error_category, gateway_error_code, gateway_error_message, recovery_score, amount_cents, currency, method",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabaseAdmin
      .from("billing_subscriptions")
      .select("id, user_id, status")
      .in("status", ["past_due", "grace_period", "suspended", "cancelled"]),
  ]);

  const attempts = (rawAttempts ?? []) as unknown as AttemptRow[];

  // ------------------------------------------------------------- by cycle
  const cycles = new Map<string, AttemptRow[]>();
  for (const a of attempts) {
    if (!a.cycle_key) continue;
    const list = cycles.get(a.cycle_key) ?? [];
    list.push(a);
    cycles.set(a.cycle_key, list);
  }

  let atRiskCents = 0;
  let recoveredCents = 0;
  let lostCents = 0;
  let recoveredCycles = 0;
  let recoveredWithin24h = 0;
  let closedCycles = 0;
  const durations: number[] = [];
  const byWindow = { h24: 0, d15: 0, d90: 0 };

  for (const [, rows] of cycles) {
    const sorted = [...rows].sort((a, b) => a.attempt_number - b.attempt_number);
    const opened = new Date(
      sorted[0]?.created_at ?? new Date().toISOString(),
    ).getTime();
    const win = sorted.find((r) => r.status === "succeeded");
    const stillOpen = sorted.some((r) => r.status === "scheduled");
    const amount = sorted[0]?.amount_cents ?? 0;

    if (win) {
      recoveredCycles += 1;
      closedCycles += 1;
      recoveredCents += win.amount_cents;
      const took = win.recovered_at
        ? new Date(win.recovered_at).getTime() - opened
        : null;
      if (took !== null) {
        durations.push(took);
        if (took <= DAY) {
          recoveredWithin24h += 1;
          byWindow.h24 += win.amount_cents;
        }
        if (took <= 15 * DAY) byWindow.d15 += win.amount_cents;
        if (took <= 90 * DAY) byWindow.d90 += win.amount_cents;
      }
    } else if (stillOpen) {
      atRiskCents += amount;
    } else {
      closedCycles += 1;
      lostCents += amount;
    }
  }

  // ------------------------------------------------------------- by phase
  const phases: RecoveryPhaseMetric[] = (
    ["immediate", "grace", "suspended"] as const
  ).map((phase) => {
    const rows = attempts.filter(
      (a) => a.phase === phase && REACHED_GATEWAY.includes(a.status),
    );
    const won = rows.filter((a) => a.status === "succeeded");
    const times = won
      .filter((a) => a.recovered_at)
      .map(
        (a) =>
          new Date(a.recovered_at as string).getTime() -
          new Date(a.created_at).getTime(),
      );
    return {
      phase,
      label: PHASE_LABEL[phase],
      attempts: rows.length,
      recovered: won.length,
      recoveredCents: won.reduce((s, a) => s + a.amount_cents, 0),
      rate: rows.length ? won.length / rows.length : 0,
      avgHoursToRecover: times.length
        ? times.reduce((s, t) => s + t, 0) / times.length / HOUR
        : null,
    };
  });

  // ------------------------------------------------------------ by reason
  const reasonMap = new Map<string, RecoveryReasonMetric>();
  for (const a of attempts) {
    if (!REACHED_GATEWAY.includes(a.status)) continue;
    const code = a.gateway_error_code ?? "unknown_reason";
    const entry = reasonMap.get(code) ?? {
      code,
      category: a.error_category ?? "unknown",
      label: a.gateway_error_message ?? code,
      attempts: 0,
      recovered: 0,
    };
    entry.attempts += 1;
    if (a.status === "succeeded") entry.recovered += 1;
    reasonMap.set(code, entry);
  }

  // ------------------------------------------------------------ by method
  const methodMap = new Map<string, RecoveryMethodMetric>();
  for (const a of attempts) {
    if (!REACHED_GATEWAY.includes(a.status)) continue;
    const method = a.method ?? "desconhecido";
    const entry = methodMap.get(method) ?? {
      method,
      attempts: 0,
      recovered: 0,
      recoveredCents: 0,
      rate: 0,
    };
    entry.attempts += 1;
    if (a.status === "succeeded") {
      entry.recovered += 1;
      entry.recoveredCents += a.amount_cents;
    }
    methodMap.set(method, entry);
  }
  const methods = [...methodMap.values()].map((m) => ({
    ...m,
    rate: m.attempts ? m.recovered / m.attempts : 0,
  }));

  // ----------------------------------------------------------- per client
  const openCycles = [...cycles.entries()].filter(([, rows]) =>
    rows.some((r) => r.status === "scheduled"),
  );

  const userIds = [...new Set(openCycles.map(([, rows]) => rows[0].user_id))];
  const { data: profiles } = userIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds)
    : { data: [] as { id: string; display_name: string }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const subStatus = new Map((subs ?? []).map((s) => [s.id, s.status]));

  const customers: RecoveryCustomerRow[] = openCycles
    .map(([cycleKey, rows]) => {
      const sorted = [...rows].sort((a, b) => a.attempt_number - b.attempt_number);
      const first = sorted[0];
      const pending = sorted.filter((r) => r.status === "scheduled");
      const done = sorted.filter((r) => REACHED_GATEWAY.includes(r.status));
      const lastFailure = [...done]
        .reverse()
        .find((r) => r.status === "failed");
      const openedAt = new Date(first.created_at).getTime();
      return {
        userId: first.user_id,
        name: names.get(first.user_id) ?? "—",
        subscriptionId: first.subscription_id,
        subscriptionStatus: subStatus.get(first.subscription_id) ?? "—",
        cycleKey,
        score: first.recovery_score,
        category: first.error_category,
        attemptsUsed: done.length,
        maxAttempts: MAX_RECOVERY_ATTEMPTS,
        nextAttemptAt: pending[0]?.scheduled_for ?? null,
        lastFailureAt: lastFailure?.attempted_at ?? null,
        lastFailureMessage: lastFailure?.gateway_error_message ?? null,
        debtAgeDays: Math.max(0, Math.round((Date.now() - openedAt) / DAY)),
        amountCents: pending[0]?.amount_cents ?? first.amount_cents,
        currency: first.currency,
      };
    })
    .sort((a, b) => b.debtAgeDays - a.debtAgeDays);

  return {
    atRiskCents,
    recoveredCents,
    lostCents,
    recoveryRate: closedCycles ? recoveredCycles / closedCycles : 0,
    rateFirst24h: recoveredCycles ? recoveredWithin24h / recoveredCycles : 0,
    avgHoursToRecover: durations.length
      ? durations.reduce((s, d) => s + d, 0) / durations.length / HOUR
      : null,
    recoveredByWindow: byWindow,
    counts: {
      pastDue: (subs ?? []).filter((s) => s.status === "past_due").length,
      gracePeriod: (subs ?? []).filter((s) => s.status === "grace_period").length,
      suspended: (subs ?? []).filter((s) => s.status === "suspended").length,
      cancelled: (subs ?? []).filter((s) => s.status === "cancelled").length,
    },
    phases,
    reasons: [...reasonMap.values()].sort((a, b) => b.attempts - a.attempts),
    methods: methods.sort((a, b) => b.attempts - a.attempts),
    customers,
  };
}

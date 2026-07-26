/**
 * Revenue Intelligence — admin analytics (server-only).
 * Read-only aggregation over the dunning ledger and the customer payment
 * profiles. Every number here can be traced back to a stored row.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  decideStrategy,
  type ScoreFactor,
} from "@/lib/billing/recovery/intelligence";
import { mapProfileRow } from "@/lib/billing/recovery/profile.server";
import type {
  FactorImpact,
  IntelligenceCustomer,
  IntelligenceOverview,
  ScoreTrendPoint,
  SegmentMetric,
} from "./intelligence-types";

const DAY = 86_400_000;

type Attempt = {
  id: string;
  cycle_key: string | null;
  user_id: string;
  attempt_number: number;
  status: string;
  created_at: string;
  scheduled_for: string;
  recovered_at: string | null;
  recovery_score: number | null;
  score_factors: ScoreFactor[] | null;
  strategy: string | null;
  error_category: string | null;
  amount_cents: number;
  currency: string;
};

function segmentOf(p: {
  monthsAsCustomer: number;
  suspensions: number;
  cancellations: number;
}): { key: string; label: string } {
  if (p.suspensions > 0 || p.cancellations > 0)
    return { key: "reincidente", label: "Reincidentes (já suspensos/cancelados)" };
  if (p.monthsAsCustomer >= 12) return { key: "fiel", label: "Fiéis (12+ meses)" };
  if (p.monthsAsCustomer < 3) return { key: "novo", label: "Novos (< 3 meses)" };
  return { key: "regular", label: "Regulares (3–12 meses)" };
}

export async function collectIntelligenceOverview(): Promise<IntelligenceOverview> {
  const since = new Date(Date.now() - 365 * DAY).toISOString();

  const [{ data: rawAttempts }, { data: rawProfiles }] = await Promise.all([
    supabaseAdmin
      .from("billing_dunning_attempts")
      .select(
        "id, cycle_key, user_id, attempt_number, status, created_at, scheduled_for, recovered_at, recovery_score, score_factors, strategy, error_category, amount_cents, currency",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000),
    supabaseAdmin.from("billing_customer_profiles").select("*").limit(2000),
  ]);

  const attempts = (rawAttempts ?? []) as unknown as Attempt[];
  const profiles = (rawProfiles ?? []).map((r) =>
    mapProfileRow(r as Record<string, unknown>),
  );
  const profileById = new Map(profiles.map((p) => [p.userId, p]));

  const userIds = [...new Set(attempts.map((a) => a.user_id))].slice(0, 500);
  const { data: people } = userIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds)
    : { data: [] as { id: string; display_name: string }[] };
  const nameById = new Map(
    (people ?? []).map((p) => [p.id, p.display_name ?? "Membro"]),
  );

  // ------------------------------------------------------------ per cycle
  const cycles = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (!a.cycle_key) continue;
    const list = cycles.get(a.cycle_key) ?? [];
    list.push(a);
    cycles.set(a.cycle_key, list);
  }

  let highPredicted = 0;
  let highRecovered = 0;
  let lowPredicted = 0;
  let lowNeverRecovered = 0;
  const recoverHours: number[] = [];
  const segments = new Map<string, SegmentMetric>();

  for (const list of cycles.values()) {
    const first = list[0];
    const recovered = list.find((a) => a.status === "succeeded");
    const open = list.some((a) => a.status === "scheduled");
    const score = first.recovery_score ?? 0;

    if (!open) {
      if (score >= 60) {
        highPredicted += 1;
        if (recovered) highRecovered += 1;
      } else if (score < 40) {
        lowPredicted += 1;
        if (!recovered) lowNeverRecovered += 1;
      }
    }
    if (recovered) {
      const start = new Date(first.created_at).getTime();
      const end = new Date(recovered.recovered_at ?? recovered.created_at).getTime();
      if (end > start) recoverHours.push((end - start) / 3_600_000);
    }

    const p = profileById.get(first.user_id);
    const seg = segmentOf({
      monthsAsCustomer: p?.monthsAsCustomer ?? 0,
      suspensions: p?.suspensions ?? 0,
      cancellations: p?.cancellations ?? 0,
    });
    const entry =
      segments.get(seg.key) ??
      ({
        key: seg.key,
        label: seg.label,
        cycles: 0,
        recovered: 0,
        rate: 0,
        avgScore: 0,
      } as SegmentMetric);
    entry.cycles += 1;
    if (recovered) entry.recovered += 1;
    entry.avgScore += score;
    segments.set(seg.key, entry);
  }

  for (const s of segments.values()) {
    s.rate = s.cycles > 0 ? s.recovered / s.cycles : 0;
    s.avgScore = s.cycles > 0 ? Math.round(s.avgScore / s.cycles) : 0;
  }

  // ------------------------------------------------------- score evolution
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const a of attempts) {
    if (a.recovery_score == null) continue;
    const key = a.created_at.slice(0, 10);
    const e = byDay.get(key) ?? { sum: 0, n: 0 };
    e.sum += a.recovery_score;
    e.n += 1;
    byDay.set(key, e);
  }
  const scoreTrend: ScoreTrendPoint[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-60)
    .map(([date, e]) => ({
      date,
      avgScore: Math.round(e.sum / e.n),
      samples: e.n,
    }));

  // ------------------------------------------------------- factor impact
  const factorAgg = new Map<string, { label: string; sum: number; n: number }>();
  for (const a of attempts) {
    for (const f of a.score_factors ?? []) {
      if (!f?.key || f.key === "baseline") continue;
      const e = factorAgg.get(f.key) ?? { label: f.label, sum: 0, n: 0 };
      e.sum += f.points;
      e.n += 1;
      e.label = f.label;
      factorAgg.set(f.key, e);
    }
  }
  const factors: FactorImpact[] = [...factorAgg.entries()]
    .map(([key, e]) => ({
      key,
      label: e.label,
      avgPoints: Math.round((e.sum / e.n) * 10) / 10,
      occurrences: e.n,
    }))
    .sort((a, b) => Math.abs(b.avgPoints) - Math.abs(a.avgPoints))
    .slice(0, 10);

  // --------------------------------------------------------- open worklist
  const openRows: IntelligenceCustomer[] = [];
  for (const [cycleKey, list] of cycles) {
    const scheduled = list
      .filter((a) => a.status === "scheduled")
      .sort((a, b) => a.attempt_number - b.attempt_number);
    if (scheduled.length === 0) continue;
    const next = scheduled[0];
    const p = profileById.get(next.user_id);
    const score = next.recovery_score ?? 0;
    const strategy = p
      ? decideStrategy({
          score,
          category:
            (next.error_category as "recoverable" | "permanent" | "fraud") ??
            "recoverable",
          profile: p,
          amountCents: next.amount_cents,
        })
      : null;

    openRows.push({
      userId: next.user_id,
      name: nameById.get(next.user_id) ?? "Membro",
      score,
      strategy: next.strategy ?? strategy?.aggressiveness ?? null,
      category: next.error_category,
      amountCents: next.amount_cents,
      currency: next.currency,
      attemptsUsed: list.filter((a) =>
        ["attempted", "succeeded", "failed"].includes(a.status),
      ).length,
      nextAttemptAt: next.scheduled_for,
      monthsAsCustomer: p?.monthsAsCustomer ?? 0,
      consecutiveSuccesses: p?.consecutiveSuccesses ?? 0,
      recoveryRate: p?.recoveryRate ?? 0,
      suspensions: p?.suspensions ?? 0,
      cancellations: p?.cancellations ?? 0,
      typicalPayDay: p?.typicalPayDay ?? null,
      bestPayHour: p?.bestPayHour ?? null,
      preferredMethod: p?.preferredMethod ?? null,
      factors: (next.score_factors ?? []).slice().sort((a, b) => b.points - a.points),
      reason: strategy?.reason ?? "—",
    });
    void cycleKey;
  }

  const sorted = [...openRows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const scored = profiles.filter((p) => p.lastScore != null);

  return {
    profiles: profiles.length,
    avgScore:
      scored.length > 0
        ? Math.round(
            scored.reduce((s, p) => s + (p.lastScore ?? 0), 0) / scored.length,
          )
        : 0,
    precisionHigh: highPredicted > 0 ? highRecovered / highPredicted : 0,
    precisionLow: lowPredicted > 0 ? lowNeverRecovered / lowPredicted : 0,
    avgHoursToRecover:
      recoverHours.length > 0
        ? recoverHours.reduce((a, b) => a + b, 0) / recoverHours.length
        : null,
    scoreTrend,
    segments: [...segments.values()].sort((a, b) => b.cycles - a.cycles),
    factors,
    mostLikely: sorted.slice(0, 8),
    highRisk: sorted.slice(-8).reverse(),
  };
}

/**
 * Revenue Recovery — retry calendar.
 *
 * Pure module (no I/O). Produces the full list of attempts for one failed
 * billing cycle, already adjusted by the Recovery Score and jittered so that
 * thousands of members are never charged in the same second.
 */
import type { FailureCategory } from "./classify";
import { CATEGORY_MAX_ATTEMPTS } from "./classify";

/** Absolute ceiling of automatic attempts per invoice. Never exceeded. */
export const MAX_RECOVERY_ATTEMPTS = 15;

export type RecoveryPhase = "immediate" | "grace" | "suspended";

export type ScheduleStep = {
  attemptNumber: number;
  /** Hours after the original failure. */
  offsetHours: number;
  phase: RecoveryPhase;
};

const HOUR = 3_600_000;

/** Milestones, in hours from the original failure. */
export const GRACE_STARTS_AT_HOURS = 24;
export const SUSPEND_AT_HOURS = 3 * 24; // day 3 — grace livre de 3 dias após falha
export const CANCEL_AT_HOURS = 90 * 24; // day 90

/** 0–24h · days 2–3 (grace) · days 4–90 (pós-suspensão). */
const BASE_OFFSETS_HOURS = [
  0, 4, 8, 16, 24,
  2 * 24, 4 * 24, 7 * 24, 10 * 24, 15 * 24,
  21 * 24, 28 * 24, 35 * 24, 45 * 24, 60 * 24, 75 * 24, 90 * 24,
];

export function phaseForOffset(offsetHours: number): RecoveryPhase {
  if (offsetHours < GRACE_STARTS_AT_HOURS) return "immediate";
  if (offsetHours < SUSPEND_AT_HOURS) return "grace";
  return "suspended";
}

/**
 * Low scores get a sparser calendar (more time between tries, fewer tries):
 * hammering a hopeless card only burns gateway reputation.
 */
export function spacingMultiplier(score: number): number {
  if (score >= 80) return 1;
  if (score >= 40) return 1.35;
  return 1.8;
}

function stepLimit(category: FailureCategory, score: number): number {
  const byCategory = CATEGORY_MAX_ATTEMPTS[category];
  const byScore = score >= 80 ? MAX_RECOVERY_ATTEMPTS : score >= 40 ? 11 : 6;
  return Math.min(MAX_RECOVERY_ATTEMPTS, byCategory, byScore);
}

export function buildSchedule(input: {
  category: FailureCategory;
  score: number;
}): ScheduleStep[] {
  const limit = stepLimit(input.category, input.score);
  if (limit <= 0) return [];

  const mult = spacingMultiplier(input.score);
  return BASE_OFFSETS_HOURS.slice(0, limit).map((base, i) => {
    const offsetHours = i === 0 ? 0 : Math.round(base * mult);
    return {
      attemptNumber: i + 1,
      offsetHours,
      phase: phaseForOffset(offsetHours),
    };
  });
}

/** ±15% jitter. `rng` is injectable so tests are deterministic. */
export function jitterHours(offsetHours: number, rng: () => number = Math.random): number {
  if (offsetHours <= 0) return 0;
  const factor = 0.85 + rng() * 0.3;
  return offsetHours * factor;
}

export function scheduledAt(
  failedAt: Date,
  offsetHours: number,
  rng: () => number = Math.random,
): Date {
  return new Date(failedAt.getTime() + jitterHours(offsetHours, rng) * HOUR);
}

export type EscalationKind = "grace_period" | "suspend" | "cancel";

export const ESCALATIONS: { kind: EscalationKind; offsetHours: number }[] = [
  { kind: "grace_period", offsetHours: GRACE_STARTS_AT_HOURS },
  { kind: "suspend", offsetHours: SUSPEND_AT_HOURS },
  { kind: "cancel", offsetHours: CANCEL_AT_HOURS },
];

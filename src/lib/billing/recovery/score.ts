/**
 * Revenue Recovery — Recovery Score (0–100).
 *
 * Pure module (no I/O). Estimates how likely this debt is to be collected,
 * and therefore how aggressive the retry calendar should be.
 */
import type { FailureCategory } from "./classify";

export type ScoreInputs = {
  category: FailureCategory;
  /** How long the member has been paying, in months. */
  monthsAsMember: number;
  /** Lifetime successful payments. */
  successfulPayments: number;
  /** Failed charges in a row for this cycle. */
  consecutiveFailures: number;
  /** Hours since the previous attempt (0 for the first one). */
  hoursSinceLastAttempt: number;
  /** The member added/updated a card in the last 7 days. */
  methodUpdatedRecently: boolean;
  /** Amount still owed, in cents. */
  amountCents: number;
  /** Age of the debt, in days. */
  debtAgeDays: number;
};

export type ScoreBand = "high" | "medium" | "low";

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

export function computeRecoveryScore(i: ScoreInputs): number {
  // Baseline by failure category: a dead card is not a funding problem.
  let score =
    i.category === "recoverable" ? 62 : i.category === "permanent" ? 34 : 0;
  if (i.category === "fraud") return 0;

  // Loyalty: long-standing members almost always come back.
  score += Math.min(12, i.monthsAsMember * 1.2);
  score += Math.min(10, i.successfulPayments * 1.5);

  // Each repeated failure makes the next one less likely to work.
  score -= Math.min(28, i.consecutiveFailures * 6);

  // Letting the card breathe helps (funds get topped up).
  if (i.hoursSinceLastAttempt >= 48) score += 6;
  else if (i.hoursSinceLastAttempt >= 12) score += 3;
  else if (i.hoursSinceLastAttempt > 0) score -= 4;

  // Strongest positive signal we have: they just fixed their card.
  if (i.methodUpdatedRecently) score += 18;

  // Large amounts fail more often on the same card.
  if (i.amountCents > 20_000) score -= 6;
  else if (i.amountCents > 10_000) score -= 3;

  // Debt decays: after three months, recovery odds collapse.
  score -= Math.min(22, i.debtAgeDays * 0.25);

  return Math.round(clamp(score));
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export const SCORE_BAND_LABEL: Record<ScoreBand, string> = {
  high: "Recuperação provável — calendário agressivo",
  medium: "Recuperação possível — tentativas espaçadas",
  low: "Recuperação improvável — foco em atualizar o método",
};

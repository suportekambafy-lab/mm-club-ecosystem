/** Revenue Intelligence — view models shared with the admin UI (client-safe). */
import type { ScoreFactor } from "@/lib/billing/recovery/intelligence";

export type IntelligenceCustomer = {
  userId: string;
  name: string;
  score: number | null;
  strategy: string | null;
  category: string | null;
  amountCents: number;
  currency: string;
  attemptsUsed: number;
  nextAttemptAt: string | null;
  monthsAsCustomer: number;
  consecutiveSuccesses: number;
  recoveryRate: number;
  suspensions: number;
  cancellations: number;
  typicalPayDay: number | null;
  bestPayHour: number | null;
  preferredMethod: string | null;
  factors: ScoreFactor[];
  reason: string;
};

export type ScoreTrendPoint = {
  /** ISO date (day granularity). */
  date: string;
  avgScore: number;
  samples: number;
};

export type SegmentMetric = {
  key: string;
  label: string;
  cycles: number;
  recovered: number;
  rate: number;
  avgScore: number;
};

export type FactorImpact = {
  key: string;
  label: string;
  /** Average points contributed across all scored attempts. */
  avgPoints: number;
  occurrences: number;
};

export type IntelligenceOverview = {
  profiles: number;
  avgScore: number;
  /** Recovered cycles where the score was ≥ 60 vs. total predicted-high. */
  precisionHigh: number;
  /** Cycles scored < 40 that indeed never recovered. */
  precisionLow: number;
  avgHoursToRecover: number | null;
  scoreTrend: ScoreTrendPoint[];
  segments: SegmentMetric[];
  factors: FactorImpact[];
  mostLikely: IntelligenceCustomer[];
  highRisk: IntelligenceCustomer[];
};

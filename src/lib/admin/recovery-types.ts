/** Revenue Recovery — view models shared with the admin UI (client-safe). */

export type RecoveryPhaseMetric = {
  phase: "immediate" | "grace" | "suspended";
  label: string;
  attempts: number;
  recovered: number;
  recoveredCents: number;
  rate: number;
  avgHoursToRecover: number | null;
};

export type RecoveryReasonMetric = {
  code: string;
  category: string;
  label: string;
  attempts: number;
  recovered: number;
};

export type RecoveryMethodMetric = {
  method: string;
  attempts: number;
  recovered: number;
  recoveredCents: number;
  rate: number;
};

export type RecoveryCustomerRow = {
  userId: string;
  name: string;
  subscriptionId: string;
  subscriptionStatus: string;
  cycleKey: string;
  score: number | null;
  category: string | null;
  attemptsUsed: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  debtAgeDays: number;
  amountCents: number;
  currency: string;
};

export type RecoveryOverview = {
  atRiskCents: number;
  recoveredCents: number;
  lostCents: number;
  recoveryRate: number;
  /** Share of recovered cycles settled within the first 24h. */
  rateFirst24h: number;
  avgHoursToRecover: number | null;
  recoveredByWindow: { h24: number; d15: number; d90: number };
  counts: {
    pastDue: number;
    gracePeriod: number;
    suspended: number;
    cancelled: number;
  };
  phases: RecoveryPhaseMetric[];
  reasons: RecoveryReasonMetric[];
  methods: RecoveryMethodMetric[];
  customers: RecoveryCustomerRow[];
};

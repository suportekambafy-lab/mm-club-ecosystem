/**
 * MM Club Revenue Intelligence Engine (V3) — pure decision core.
 *
 * No I/O, no LLM, no black box: every number produced here comes with the
 * list of reasons that produced it, so any decision can be audited later.
 */
import type { FailureCategory } from "./classify";
import { CATEGORY_MAX_ATTEMPTS } from "./classify";
import { MAX_RECOVERY_ATTEMPTS, phaseForOffset, type ScheduleStep } from "./schedule";

// ------------------------------------------------------------------- profile

/** Permanent payment behaviour profile. Never deleted, only refreshed. */
export type CustomerPaymentProfile = {
  userId: string;
  customerSince: string | null;
  monthsAsCustomer: number;
  invoicesTotal: number;
  paymentsSucceeded: number;
  paymentsFailed: number;
  consecutiveSuccesses: number;
  recoveriesSucceeded: number;
  recoveriesFailed: number;
  /** 0–1, historical share of failed cycles that ended up collected. */
  recoveryRate: number;
  avgHoursToRecover: number | null;
  avgDaysFailureToPayment: number | null;
  chargebacks: number;
  refunds: number;
  /** Day of month (1–31) the member usually settles. */
  typicalPayDay: number | null;
  /** Hour of day (0–23) with the highest success rate. */
  bestPayHour: number | null;
  preferredMethod: string | null;
  bestMethod: string | null;
  bestMethodRate: number | null;
  cardChanges: number;
  expiredCards: number;
  suspensions: number;
  cancellations: number;
  avgHoursSuspensionToRecovery: number | null;
  lastPaymentAt: string | null;
  lastFailureAt: string | null;
  lastMethodChangeAt: string | null;
  lastLoginAt: string | null;
  lastScore: number | null;
  lastScoreAt: string | null;
  refreshedAt: string | null;
};

export function emptyProfile(userId: string): CustomerPaymentProfile {
  return {
    userId,
    customerSince: null,
    monthsAsCustomer: 0,
    invoicesTotal: 0,
    paymentsSucceeded: 0,
    paymentsFailed: 0,
    consecutiveSuccesses: 0,
    recoveriesSucceeded: 0,
    recoveriesFailed: 0,
    recoveryRate: 0,
    avgHoursToRecover: null,
    avgDaysFailureToPayment: null,
    chargebacks: 0,
    refunds: 0,
    typicalPayDay: null,
    bestPayHour: null,
    preferredMethod: null,
    bestMethod: null,
    bestMethodRate: null,
    cardChanges: 0,
    expiredCards: 0,
    suspensions: 0,
    cancellations: 0,
    avgHoursSuspensionToRecovery: null,
    lastPaymentAt: null,
    lastFailureAt: null,
    lastMethodChangeAt: null,
    lastLoginAt: null,
    lastScore: null,
    lastScoreAt: null,
    refreshedAt: null,
  };
}

// --------------------------------------------------------------------- score

export type ScoreFactor = {
  key: string;
  /** pt-PT sentence shown verbatim in the admin panel. */
  label: string;
  points: number;
};

export type ScoreContext = {
  category: FailureCategory;
  /** Failures already recorded for this cycle. */
  consecutiveFailures: number;
  hoursSinceLastAttempt: number;
  amountCents: number;
  debtAgeDays: number;
};

export type ScoreResult = {
  score: number;
  factors: ScoreFactor[];
};

export const SCORE_BASELINE = 40;

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const round = (n: number) => Math.round(n * 10) / 10;

function push(out: ScoreFactor[], key: string, label: string, points: number) {
  const p = round(points);
  if (p === 0) return;
  out.push({ key, label, points: p });
}

/**
 * Dynamic Recovery Score: the estimated probability (0–100) that this specific
 * invoice gets collected, given everything we know about the member.
 */
export function scoreRecovery(
  profile: CustomerPaymentProfile,
  ctx: ScoreContext,
): ScoreResult {
  if (ctx.category === "fraud") {
    return {
      score: 0,
      factors: [
        {
          key: "fraud",
          label: "Falha classificada como fraude — recuperação interrompida",
          points: 0,
        },
      ],
    };
  }

  const f: ScoreFactor[] = [];
  push(f, "baseline", "Base do modelo", SCORE_BASELINE);

  // Failure nature: a dead card is not a funding problem.
  if (ctx.category === "recoverable") {
    push(f, "category", "Falha temporária (saldo/recusa do banco)", 15);
  } else {
    push(f, "category", "Método de pagamento inválido ou expirado", -12);
  }

  // Tenure.
  const tenure = Math.min(20, profile.monthsAsCustomer * 0.7);
  const years = profile.monthsAsCustomer / 12;
  push(
    f,
    "tenure",
    years >= 1
      ? `Cliente há ${years.toFixed(1)} anos`
      : `Cliente há ${Math.max(0, Math.round(profile.monthsAsCustomer))} meses`,
    tenure,
  );

  // Payment track record.
  push(
    f,
    "consecutive_successes",
    `${profile.consecutiveSuccesses} pagamentos consecutivos sem falha`,
    Math.min(20, profile.consecutiveSuccesses * 0.8),
  );
  push(
    f,
    "successful_payments",
    `${profile.paymentsSucceeded} pagamentos bem-sucedidos no histórico`,
    Math.min(8, profile.paymentsSucceeded * 0.4),
  );

  // Historical recovery behaviour — the strongest learned signal.
  const closedCycles = profile.recoveriesSucceeded + profile.recoveriesFailed;
  if (closedCycles >= 1) {
    const delta = (profile.recoveryRate - 0.5) * 24;
    push(
      f,
      "recovery_history",
      profile.recoveryRate >= 0.5
        ? `Recuperou ${profile.recoveriesSucceeded} de ${closedCycles} dívidas anteriores`
        : `Só recuperou ${profile.recoveriesSucceeded} de ${closedCycles} dívidas anteriores`,
      delta,
    );
  }

  // Fresh signals.
  if (profile.lastMethodChangeAt) {
    const days = daysSince(profile.lastMethodChangeAt);
    if (days <= 1) push(f, "method_updated", "Atualizou o método de pagamento hoje", 15);
    else if (days <= 7) push(f, "method_updated", "Atualizou o método esta semana", 9);
  }
  if (profile.lastLoginAt && daysSince(profile.lastLoginAt) <= 1) {
    push(f, "recent_login", "Login nas últimas 24 horas", 8);
  }

  // Negative history.
  push(f, "chargebacks", `${profile.chargebacks} chargebacks`, -profile.chargebacks * 14);
  push(f, "refunds", `${profile.refunds} reembolsos`, -profile.refunds * 4);
  push(f, "suspensions", `${profile.suspensions} suspensões anteriores`, -Math.min(15, profile.suspensions * 5));
  push(
    f,
    "cancellations",
    `${profile.cancellations} cancelamentos anteriores`,
    -Math.min(12, profile.cancellations * 6),
  );
  push(f, "expired_cards", `${profile.expiredCards} cartões expirados`, -Math.min(8, profile.expiredCards * 3));

  // This cycle.
  push(
    f,
    "consecutive_failures",
    `${ctx.consecutiveFailures} tentativas falhadas nesta dívida`,
    -Math.min(28, ctx.consecutiveFailures * 6),
  );
  if (ctx.hoursSinceLastAttempt >= 48) push(f, "cooldown", "Mais de 48h desde a última tentativa", 6);
  else if (ctx.hoursSinceLastAttempt >= 12) push(f, "cooldown", "Mais de 12h desde a última tentativa", 3);
  else if (ctx.hoursSinceLastAttempt > 0) push(f, "cooldown", "Tentativa muito recente", -4);

  if (ctx.amountCents > 20_000) push(f, "amount", "Valor elevado da fatura", -6);
  else if (ctx.amountCents > 10_000) push(f, "amount", "Valor acima da média", -3);

  push(
    f,
    "debt_age",
    `Dívida com ${Math.round(ctx.debtAgeDays)} dias`,
    -Math.min(22, ctx.debtAgeDays * 0.25),
  );

  const raw = f.reduce((sum, x) => sum + x.points, 0);
  return { score: Math.round(clamp(raw)), factors: f };
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

// ------------------------------------------------------------------ strategy

export type Aggressiveness = "aggressive" | "balanced" | "conservative" | "communicate";

export type RecoveryStrategy = {
  aggressiveness: Aggressiveness;
  /** Multiplier applied to the base calendar spacing. */
  spacing: number;
  /** Hard cap on automatic attempts for this cycle. */
  maxAttempts: number;
  /** 0–100 — used to order the admin worklist. */
  priority: number;
  /** Align retries with the day of month the member usually pays. */
  preferDayOfMonth: number | null;
  /** Align retries with the hour of day that historically works. */
  preferHour: number | null;
  reason: string;
};

export function decideStrategy(args: {
  score: number;
  category: FailureCategory;
  profile: CustomerPaymentProfile;
  amountCents: number;
}): RecoveryStrategy {
  const { score, category, profile } = args;
  const categoryCap = CATEGORY_MAX_ATTEMPTS[category];

  let aggressiveness: Aggressiveness;
  let spacing: number;
  let maxAttempts: number;
  let reason: string;

  if (category === "fraud") {
    return {
      aggressiveness: "communicate",
      spacing: 1,
      maxAttempts: 0,
      priority: 0,
      preferDayOfMonth: null,
      preferHour: null,
      reason: "Fraude — cobrança automática interrompida.",
    };
  }

  const neverRecovers =
    profile.recoveriesSucceeded === 0 && profile.recoveriesFailed >= 2;

  if (score >= 80 && category === "recoverable") {
    aggressiveness = "aggressive";
    spacing = 0.75;
    maxAttempts = MAX_RECOVERY_ATTEMPTS;
    reason = "Histórico muito forte — concentrar tentativas nas primeiras 24 horas.";
  } else if (neverRecovers || score < 25 || category === "permanent") {
    aggressiveness = "communicate";
    spacing = 2.2;
    maxAttempts = Math.min(3, categoryCap);
    reason =
      category === "permanent"
        ? "Método inválido — privilegiar a atualização do cartão em vez de insistir."
        : "Histórico sem recuperações — reduzir cobranças e privilegiar comunicação.";
  } else if (score >= 50) {
    aggressiveness = "balanced";
    spacing = 1;
    maxAttempts = Math.min(11, categoryCap);
    reason = "Perfil médio — calendário padrão.";
  } else {
    aggressiveness = "conservative";
    spacing = 1.6;
    maxAttempts = Math.min(6, categoryCap);
    reason = "Probabilidade baixa — espaçar tentativas para não queimar o cartão.";
  }

  maxAttempts = Math.min(MAX_RECOVERY_ATTEMPTS, maxAttempts, categoryCap);

  // Amount weighs on priority, not on how hard we push the card.
  const priority = Math.round(
    clamp(score * 0.7 + Math.min(30, args.amountCents / 1000)),
  );

  return {
    aggressiveness,
    spacing,
    maxAttempts,
    priority,
    preferDayOfMonth: profile.typicalPayDay,
    preferHour: profile.bestPayHour,
    reason,
  };
}

export const AGGRESSIVENESS_LABEL: Record<Aggressiveness, string> = {
  aggressive: "Agressiva",
  balanced: "Equilibrada",
  conservative: "Conservadora",
  communicate: "Comunicação",
};

// ------------------------------------------------------------ adaptive plan

const HOUR = 3_600_000;

/**
 * Turns the base calendar into an adaptive one: spacing from the strategy,
 * and retries pulled towards the day/hour this member historically pays.
 * Business limits (max attempts, 90-day window) are never crossed.
 */
export function adaptSchedule(
  steps: ScheduleStep[],
  strategy: RecoveryStrategy,
  failedAt: Date,
  windowHours: number,
): ScheduleStep[] {
  const out: ScheduleStep[] = [];
  let previous = -1;

  for (const step of steps.slice(0, strategy.maxAttempts)) {
    let offset = step.offsetHours === 0 ? 0 : step.offsetHours * strategy.spacing;

    // Only shift retries that already sit outside the first day: the first
    // 24h burst must stay immediate.
    if (offset >= 24) {
      offset = alignToPreference(failedAt, offset, strategy);
    }
    offset = Math.min(offset, windowHours);
    if (offset <= previous) offset = previous + 1;
    if (offset > windowHours) break;
    previous = offset;

    out.push({
      attemptNumber: out.length + 1,
      offsetHours: Math.round(offset),
      phase: phaseForOffset(offset),
    });
  }
  return out;
}

/** Nudges an offset (max ±3 days) toward the member's usual pay day/hour. */
function alignToPreference(
  failedAt: Date,
  offsetHours: number,
  strategy: RecoveryStrategy,
): number {
  let target = new Date(failedAt.getTime() + offsetHours * HOUR);

  if (strategy.preferDayOfMonth) {
    const candidate = new Date(target);
    candidate.setDate(strategy.preferDayOfMonth);
    let diff = candidate.getTime() - target.getTime();
    if (Math.abs(diff) > 15 * 24 * HOUR) {
      // Wrong side of the month boundary — try the next month's occurrence.
      candidate.setMonth(candidate.getMonth() + (diff < 0 ? 1 : -1));
      diff = candidate.getTime() - target.getTime();
    }
    if (Math.abs(diff) <= 3 * 24 * HOUR) target = candidate;
  }

  if (strategy.preferHour != null) {
    const withHour = new Date(target);
    withHour.setHours(strategy.preferHour, 0, 0, 0);
    if (Math.abs(withHour.getTime() - target.getTime()) <= 12 * HOUR) target = withHour;
  }

  const adjusted = (target.getTime() - failedAt.getTime()) / HOUR;
  return Math.max(24, adjusted);
}

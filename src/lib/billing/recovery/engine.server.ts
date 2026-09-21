/**
 * Revenue Recovery Engine — orchestration (server-only).
 *
 * Principles enforced here, without exception:
 *  1. never charge twice for the same cycle;
 *  2. never charge while a payment is pending;
 *  3. never exceed MAX_RECOVERY_ATTEMPTS;
 *  4. never remove Premium before the grace period ends;
 *  5. never delete billing history;
 *  6. every decision lands in Timeline + Ledger + Dunning;
 *  7. every operation is idempotent and concurrency-safe;
 *  8. recovery always comes before cancellation.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emitEvent } from "../events.server";
import { getGateway } from "../gateway/index.server";
import { assertTransition } from "../state-machine";
import type { SubscriptionStatus } from "../types";
import { classifyFailure, type FailureCategory } from "./classify";
import {
  buildSchedule,
  CANCEL_AT_HOURS,
  escalationsFor,
  MAX_RECOVERY_ATTEMPTS,
  scheduledAt,
  type RecoveryPhase,
} from "./schedule";
import {
  adaptSchedule,
  decideStrategy,
  scoreRecovery,
  type RecoveryStrategy,
  type ScoreContext,
  type ScoreFactor,
} from "./intelligence";
import {
  getCustomerProfile,
  refreshCustomerProfile,
  storeLastScore,
  type ProfileTrigger,
} from "./profile.server";

const HOUR = 3_600_000;
/** Gateway states that mean "money may still land" — never charge on top. */
const PENDING_STATUSES = ["pending", "authorized"] as const;

export type RecoveryJobPayload = {
  cycleKey: string;
  subscriptionId: string;
  userId: string;
  attemptNumber?: number;
  kind?: "grace_period" | "suspend" | "cancel";
};

export function cycleKeyFor(subscriptionId: string, anchor: string): string {
  return `${subscriptionId}:${anchor}`;
}

// ------------------------------------------------------------------ helpers

async function enqueue(
  jobType: "recovery.attempt" | "recovery.escalate",
  payload: RecoveryJobPayload,
  runAfter: Date,
) {
  await supabaseAdmin.from("job_queue").insert({
    consumer: "recovery",
    job_type: jobType,
    payload: payload as never,
    run_after: runAfter.toISOString(),
    max_attempts: 4,
  });
}

/** Principle 2: a pending payment freezes the whole plan. */
export async function hasPendingPayment(subscriptionId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("billing_payments")
    .select("id")
    .eq("subscription_id", subscriptionId)
    .in("status", PENDING_STATUSES)
    .gte("created_at", new Date(Date.now() - 3 * 24 * HOUR).toISOString())
    .limit(1);
  return (data ?? []).length > 0;
}

/** Principle 3: counts every attempt that actually reached the gateway. */
export async function attemptsUsed(cycleKey: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .select("id", { count: "exact", head: true })
    .eq("cycle_key", cycleKey)
    .in("status", ["attempted", "succeeded", "failed"]);
  return count ?? 0;
}

async function isCycleClosed(cycleKey: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .select("id")
    .eq("cycle_key", cycleKey)
    .in("status", ["succeeded", "cancelled"])
    .limit(1);
  return (data ?? []).length > 0;
}

async function cancelPendingJobs(cycleKey: string) {
  await supabaseAdmin
    .from("job_queue")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("consumer", "recovery")
    .eq("status", "pending")
    .contains("payload", { cycleKey } as never);
}

/** Cycle-specific inputs of the score (everything else comes from the profile). */
async function scoreContextFor(args: {
  cycleKey: string;
  category: FailureCategory;
  amountCents: number;
  failedAt: Date;
}): Promise<ScoreContext> {
  const { data: prior } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .select("attempted_at, status")
    .eq("cycle_key", args.cycleKey)
    .in("status", ["attempted", "failed"])
    .order("attempted_at", { ascending: false });

  const lastAttemptAt = prior?.[0]?.attempted_at
    ? new Date(prior[0].attempted_at as string)
    : null;

  return {
    category: args.category,
    consecutiveFailures: (prior ?? []).filter((p) => p.status === "failed").length,
    hoursSinceLastAttempt: lastAttemptAt
      ? (Date.now() - lastAttemptAt.getTime()) / HOUR
      : 0,
    amountCents: args.amountCents,
    debtAgeDays: Math.max(0, (Date.now() - args.failedAt.getTime()) / (24 * HOUR)),
  };
}

/**
 * Continuous learning: recompute the profile and the score of every open
 * cycle, then adapt the remaining calendar. Called after every billing event.
 * Business limits are re-applied on each pass — nothing here can widen them.
 */
export async function rescoreOpenCycles(
  userId: string,
  trigger: ProfileTrigger,
): Promise<{ cycles: number }> {
  const profile = await refreshCustomerProfile(userId, trigger);

  const { data: rows } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .select(
      "id, cycle_key, attempt_number, scheduled_for, created_at, status, error_category, amount_cents, currency",
    )
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .order("attempt_number");

  const cycles = new Map<string, typeof rows>();
  for (const r of rows ?? []) {
    const key = r.cycle_key as string;
    if (!key) continue;
    const list = cycles.get(key) ?? [];
    list!.push(r);
    cycles.set(key, list);
  }

  let touched = 0;
  for (const [cycleKey, list] of cycles) {
    if (!list || list.length === 0) continue;
    const category = (list[0].error_category as FailureCategory) ?? "recoverable";
    const amountCents = list[0].amount_cents ?? 0;
    const failedAt = new Date(list[0].created_at as string);

    const ctx = await scoreContextFor({ cycleKey, category, amountCents, failedAt });
    const { score, factors } = scoreRecovery(profile, ctx);
    const strategy = decideStrategy({ score, category, profile, amountCents });

    // Re-plan only the attempts that have not run yet, never adding attempts
    // beyond the strategy cap or the 90-day window.
    const plan = adaptSchedule(
      buildSchedule({ category, score }),
      strategy,
      failedAt,
      CANCEL_AT_HOURS,
    );

    for (const row of list) {
      const step = plan.find((s) => s.attemptNumber === row.attempt_number);
      if (!step) {
        // Strategy shrank: drop the surplus attempt (never delete history).
        await supabaseAdmin
          .from("billing_dunning_attempts")
          .update({ status: "skipped", error: "strategy_reduced_attempts" })
          .eq("id", row.id)
          .eq("status", "scheduled");
        continue;
      }
      const when = scheduledAt(failedAt, step.offsetHours);
      await supabaseAdmin
        .from("billing_dunning_attempts")
        .update({
          recovery_score: score,
          score_factors: factors as never,
          strategy: strategy.aggressiveness,
          phase: step.phase,
          scheduled_for: when.toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "scheduled");
    }

    await storeLastScore(userId, score);
    touched += 1;
  }

  return { cycles: touched };
}


// ------------------------------------------------------------------ startup

export type StartRecoveryInput = {
  subscriptionId: string;
  userId: string;
  amountCents: number;
  currency: string;
  failureReason: string | null;
  gatewayPaymentId: string;
  method?: string | null;
  isChargeback?: boolean;
};

/**
 * Entry point after a renewal fails. Idempotent per (subscription, payment):
 * calling it twice never produces a second plan.
 */
export async function startRecovery(input: StartRecoveryInput): Promise<void> {
  const cycleKey = cycleKeyFor(input.subscriptionId, input.gatewayPaymentId);
  if (await isCycleClosed(cycleKey)) return;

  const { data: existing } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .select("id")
    .eq("cycle_key", cycleKey)
    .limit(1);
  if ((existing ?? []).length > 0) return; // plan already exists

  const classification = classifyFailure(input.failureReason, {
    isChargeback: input.isChargeback,
  });

  const failedAt = new Date();
  // V3 — Revenue Intelligence: the profile learns, the score follows it.
  const profile = await refreshCustomerProfile(input.userId, "payment_failed");
  const ctx = await scoreContextFor({
    cycleKey,
    category: classification.category,
    amountCents: input.amountCents,
    failedAt,
  });
  const { score, factors } = scoreRecovery(profile, ctx);
  await storeLastScore(input.userId, score);
  const strategy = decideStrategy({
    score,
    category: classification.category,
    profile,
    amountCents: input.amountCents,
  });

  // Fraud never gets retried — it gets escalated to a human.
  if (classification.category === "fraud") {
    await supabaseAdmin.from("security_alerts").insert({
      category: "billing",
      level: "critical",
      title: "Cobrança bloqueada por suspeita de fraude",
      detail: classification.message,
      subject: input.gatewayPaymentId,
      user_id: input.userId,
      dedupe_key: `fraud:${input.gatewayPaymentId}`,
      metadata: { subscriptionId: input.subscriptionId, code: classification.code } as never,
    });
    await recordAttemptRow({
      cycleKey,
      subscriptionId: input.subscriptionId,
      userId: input.userId,
      attemptNumber: 0,
      scheduledFor: failedAt,
      phase: "immediate",
      status: "cancelled",
      classification,
      score,
      factors,
      strategy,
      amountCents: input.amountCents,
      currency: input.currency,
      method: input.method ?? null,
      gatewayPaymentId: input.gatewayPaymentId,
    });
    await emitEvent({
      type: "DunningEscalated",
      aggregateType: "subscription",
      aggregateId: input.subscriptionId,
      idempotencyKey: `recovery_fraud:${input.gatewayPaymentId}`,
      payload: {
        userId: input.userId,
        subscriptionId: input.subscriptionId,
        stage: "fraud_stop",
        reason: classification.message,
      },
    });
    return;
  }

  const steps = adaptSchedule(
    buildSchedule({ category: classification.category, score }),
    strategy,
    failedAt,
    CANCEL_AT_HOURS,
  );

  for (const step of steps) {
    const when = scheduledAt(failedAt, step.offsetHours);
    await recordAttemptRow({
      cycleKey,
      subscriptionId: input.subscriptionId,
      userId: input.userId,
      attemptNumber: step.attemptNumber,
      scheduledFor: when,
      phase: step.phase,
      status: "scheduled",
      classification,
      score,
      factors,
      strategy,
      amountCents: input.amountCents,
      currency: input.currency,
      method: input.method ?? null,
      gatewayPaymentId: input.gatewayPaymentId,
    });
    await enqueue(
      "recovery.attempt",
      {
        cycleKey,
        subscriptionId: input.subscriptionId,
        userId: input.userId,
        attemptNumber: step.attemptNumber,
      },
      when,
    );
  }

  // Suspensão = X dias após a recusa: 3 dias em trial, 7 dias em ativo.
  const { data: subRow } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("status, trial_end")
    .eq("id", input.subscriptionId)
    .maybeSingle();
  const wasTrialing =
    subRow?.status === "trialing" ||
    (!!subRow?.trial_end && new Date(subRow.trial_end as string).getTime() > failedAt.getTime());

  // Phase transitions run on the clock, independently of the attempts.
  for (const esc of escalationsFor(wasTrialing)) {
    await enqueue(
      "recovery.escalate",
      {
        cycleKey,
        subscriptionId: input.subscriptionId,
        userId: input.userId,
        kind: esc.kind,
      },
      new Date(failedAt.getTime() + esc.offsetHours * HOUR),
    );
  }

  await emitEvent({
    type: "DunningEscalated",
    aggregateType: "subscription",
    aggregateId: input.subscriptionId,
    idempotencyKey: `recovery_started:${input.gatewayPaymentId}`,
    payload: {
      userId: input.userId,
      subscriptionId: input.subscriptionId,
      stage: "recovery_started",
      category: classification.category,
      reason: classification.message,
      score,
      attempts: steps.length,
    },
  });
}

async function recordAttemptRow(args: {
  cycleKey: string;
  subscriptionId: string;
  userId: string;
  attemptNumber: number;
  scheduledFor: Date;
  phase: RecoveryPhase;
  status: string;
  classification: ReturnType<typeof classifyFailure>;
  score: number;
  factors?: ScoreFactor[];
  strategy?: RecoveryStrategy | null;
  amountCents: number;
  currency: string;
  method: string | null;
  gatewayPaymentId: string;
}) {
  const { error } = await supabaseAdmin.from("billing_dunning_attempts").upsert(
    {
      cycle_key: args.cycleKey,
      subscription_id: args.subscriptionId,
      user_id: args.userId,
      attempt_number: args.attemptNumber,
      scheduled_for: args.scheduledFor.toISOString(),
      phase: args.phase,
      status: args.status,
      error_category: args.classification.category,
      gateway_error_code: args.classification.code,
      gateway_error_message: args.classification.message,
      recovery_score: args.score,
      score_factors: (args.factors ?? []) as never,
      strategy: args.strategy?.aggressiveness ?? null,
      amount_cents: args.amountCents,
      currency: args.currency,
      method: args.method,
      idempotency_key: `recovery:${args.cycleKey}:${args.attemptNumber}`,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  // Sem esta linha, uma falha aqui deixava o plano de recuperação vazio e
  // nenhuma tentativa de cobrança chegava a correr (falha silenciosa).
  if (error) {
    throw new Error(`recordAttemptRow failed: ${error.message}`);
  }
}


// ------------------------------------------------------------------ attempts

/** Executes a single scheduled attempt. Every guard lives here. */
export async function runRecoveryAttempt(payload: RecoveryJobPayload): Promise<void> {
  const { cycleKey, subscriptionId, userId, attemptNumber } = payload;
  if (!cycleKey || !subscriptionId || !attemptNumber) return;

  const idempotencyKey = `recovery:${cycleKey}:${attemptNumber}`;

  const { data: row } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (!row || row.status !== "scheduled") return; // already handled

  if (await isCycleClosed(cycleKey)) {
    await skip(idempotencyKey, "cycle_closed");
    return;
  }

  // Principle 3 — absolute ceiling.
  if ((await attemptsUsed(cycleKey)) >= MAX_RECOVERY_ATTEMPTS) {
    await skip(idempotencyKey, "max_attempts_reached");
    await emitEvent({
      type: "DunningEscalated",
      aggregateType: "subscription",
      aggregateId: subscriptionId,
      idempotencyKey: `recovery_capped:${cycleKey}`,
      payload: { userId, subscriptionId, stage: "max_attempts_reached" },
    });
    return;
  }

  const { data: sub } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("id, status, gateway, customer_id")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub || ["active", "cancelled", "expired"].includes(sub.status)) {
    await skip(idempotencyKey, sub ? `subscription_${sub.status}` : "subscription_missing");
    return;
  }

  // Principle 2 — a payment is in flight: wait, do not stack charges.
  if (await hasPendingPayment(subscriptionId)) {
    const retryAt = new Date(Date.now() + 30 * 60_000);
    await supabaseAdmin
      .from("billing_dunning_attempts")
      .update({ scheduled_for: retryAt.toISOString() })
      .eq("idempotency_key", idempotencyKey);
    await enqueue("recovery.attempt", payload, retryAt);
    return;
  }

  // Principle 1 — claim the row before touching the gateway. Only one worker
  // can flip `scheduled` → `attempted`.
  const { data: claimed } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .update({ status: "attempted", attempted_at: new Date().toISOString() })
    .eq("idempotency_key", idempotencyKey)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const outstanding = row.amount_cents ?? 0;
  if (outstanding <= 0) {
    await skip(idempotencyKey, "nothing_owed");
    return;
  }

  try {
    const charged = await chargeBestMandate({
      userId,
      subscriptionId,
      cycleKey,
      attemptNumber,
      amountCents: outstanding,
      currency: row.currency ?? "EUR",
      gatewayName: sub.gateway,
    });

    if (!charged) {
      await fail(idempotencyKey, "no_payment_method", "Sem método de pagamento válido.");
      return;
    }

    await supabaseAdmin
      .from("billing_dunning_attempts")
      .update({
        gateway_payment_id: charged.gatewayPaymentId,
        mandate_id: charged.mandateId,
        method: charged.method,
      })
      .eq("idempotency_key", idempotencyKey);
    // The webhook resolves the outcome (see `resolveRecoveryForPayment`).
  } catch (err) {
    await fail(
      idempotencyKey,
      "gateway_error",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function skip(idempotencyKey: string, reason: string) {
  await supabaseAdmin
    .from("billing_dunning_attempts")
    .update({ status: "skipped", error: reason })
    .eq("idempotency_key", idempotencyKey)
    .eq("status", "scheduled");
}

async function fail(idempotencyKey: string, code: string, message: string) {
  await supabaseAdmin
    .from("billing_dunning_attempts")
    .update({
      status: "failed",
      error: message,
      gateway_error_code: code,
      gateway_error_message: message,
    })
    .eq("idempotency_key", idempotencyKey);
}

/** Rotates through the member's saved mandates, least recently tried first. */
async function chargeBestMandate(args: {
  userId: string;
  subscriptionId: string;
  cycleKey: string;
  attemptNumber: number;
  amountCents: number;
  currency: string;
  gatewayName: string | null;
}): Promise<{ gatewayPaymentId: string; mandateId: string; method: string | null } | null> {
  const gw = getGateway(args.gatewayName ?? undefined);

  const { data: customer } = await supabaseAdmin
    .from("billing_customers")
    .select("id, gateway_customer_id")
    .eq("user_id", args.userId)
    .maybeSingle();
  if (!customer?.gateway_customer_id) return null;

  let mandates: { id: string; method: string | null }[] = [];
  try {
    mandates = await gw.listMandates(customer.gateway_customer_id);
  } catch {
    return null;
  }
  if (mandates.length === 0) return null;

  const { data: tried } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .select("mandate_id")
    .eq("cycle_key", args.cycleKey)
    .not("mandate_id", "is", null);
  const triedIds = (tried ?? []).map((t) => t.mandate_id as string);

  // Prefer a card we have not burned yet in this cycle; otherwise round-robin.
  const fresh = mandates.filter((m) => !triedIds.includes(m.id));
  const pool = fresh.length > 0 ? fresh : mandates;
  const start = (args.attemptNumber - 1) % pool.length;
  // Rotate through every mandate: a single card can be rejected for reasons
  // that have nothing to do with funds (mandate revoked by the bank, wrong
  // mandate scope). Burning the whole attempt on it would be wasteful.
  const order = pool.map((_, i) => pool[(start + i) % pool.length]);

  const origin = process.env.PUBLIC_APP_URL ?? "https://mmclub.pt";
  let chosen: { id: string; method: string | null } | null = null;
  let payment: Awaited<ReturnType<typeof gw.chargeWithMandate>> | null = null;
  let lastError: unknown = null;

  for (const candidate of order) {
    try {
      payment = await gw.chargeWithMandate({
        customerId: customer.gateway_customer_id,
        mandateId: candidate.id,
        amountCents: args.amountCents,
        currency: args.currency,
        description: "MM Club — recuperação de pagamento",
        webhookUrl: `${origin}/api/public/payments/gateway-webhook`,
        metadata: {
          userId: args.userId,
          subscriptionId: args.subscriptionId,
          recoveryCycle: args.cycleKey,
          recoveryAttempt: args.attemptNumber,
          origin,
        },
      });
      chosen = candidate;
      break;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Mandate is gone or unusable at the gateway — stop trusting it locally.
      if (/410|no longer available|mandate scope|invalid.*mandate/i.test(msg)) {
        await supabaseAdmin
          .from("billing_payment_methods")
          .update({ status: "revoked", is_default: false })
          .eq("user_id", args.userId)
          .eq("gateway_mandate_id", candidate.id);
      }
      console.error("[recovery] mandate charge failed", candidate.id, msg);
    }
  }

  if (!payment || !chosen) {
    if (lastError) console.error("[recovery] all mandates failed", args.userId);
    return null;
  }


  await supabaseAdmin.from("billing_payments").upsert(
    {
      customer_id: customer.id,
      user_id: args.userId,
      subscription_id: args.subscriptionId,
      gateway: gw.name,
      gateway_payment_id: payment.id,
      status: payment.status,
      amount_cents: payment.amountCents,
      currency: payment.currency,
      method: payment.method,
      metadata: {
        recoveryCycle: args.cycleKey,
        recoveryAttempt: args.attemptNumber,
        mandateId: chosen.id,
      } as never,
    },
    { onConflict: "gateway,gateway_payment_id" },
  );

  return {
    gatewayPaymentId: payment.id,
    mandateId: chosen.id,
    method: payment.method ?? chosen.method ?? null,
  };
}

// --------------------------------------------------------------- resolution

/**
 * Called from the gateway reconciliation point for every terminal state of a
 * payment that belongs to a recovery cycle.
 */
export async function resolveRecoveryForPayment(args: {
  gatewayPaymentId: string;
  outcome: "paid" | "partially_paid" | "failed" | "refunded" | "chargeback";
  paidCents?: number;
  failureReason?: string | null;
  paymentRowId?: string | null;
}): Promise<void> {
  const { data: attempt } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .select("*")
    .eq("gateway_payment_id", args.gatewayPaymentId)
    .maybeSingle();
  if (!attempt?.cycle_key) return;

  const cycleKey = attempt.cycle_key as string;
  const subscriptionId = attempt.subscription_id as string;
  const userId = attempt.user_id as string;

  const owedForCycle = attempt.amount_cents ?? 0;
  const settledShort =
    args.outcome === "paid" &&
    typeof args.paidCents === "number" &&
    owedForCycle > 0 &&
    args.paidCents < owedForCycle;
  const outcome = settledShort ? "partially_paid" : args.outcome;

  if (outcome === "paid") {
    await supabaseAdmin
      .from("billing_dunning_attempts")
      .update({
        status: "succeeded",
        recovered_at: new Date().toISOString(),
        payment_id: args.paymentRowId ?? null,
      })
      .eq("id", attempt.id);
    await closeCycle(cycleKey, subscriptionId, userId, "recovered");
    return;
  }


  if (outcome === "partially_paid") {
    const owed = Math.max(0, (attempt.amount_cents ?? 0) - (args.paidCents ?? 0));
    await supabaseAdmin
      .from("billing_dunning_attempts")
      .update({
        status: "failed",
        error: `Pagamento parcial: faltam ${(owed / 100).toFixed(2)} ${attempt.currency}`,
        payment_id: args.paymentRowId ?? null,
      })
      .eq("id", attempt.id);
    // Keep collecting only what is still owed.
    await supabaseAdmin
      .from("billing_dunning_attempts")
      .update({ amount_cents: owed })
      .eq("cycle_key", cycleKey)
      .eq("status", "scheduled");
    if (owed === 0) await closeCycle(cycleKey, subscriptionId, userId, "recovered");
    return;
  }

  if (outcome === "refunded" || outcome === "chargeback") {
    await supabaseAdmin
      .from("billing_dunning_attempts")
      .update({
        status: "cancelled",
        error: outcome === "chargeback" ? "chargeback" : "refunded",
      })
      .eq("id", attempt.id);
    await cancelRecovery(cycleKey, outcome);
    if (outcome === "chargeback") {
      await supabaseAdmin.from("security_alerts").insert({
        category: "billing",
        level: "critical",
        title: "Chargeback recebido",
        detail: `Pagamento ${args.gatewayPaymentId} revertido pelo banco.`,
        subject: args.gatewayPaymentId,
        user_id: userId,
        dedupe_key: `chargeback:${args.gatewayPaymentId}`,
        metadata: { subscriptionId, cycleKey } as never,
      });
    }
    return;
  }

  // Plain failure → reclassify and let the calendar continue.
  const classification = classifyFailure(args.failureReason);
  await supabaseAdmin
    .from("billing_dunning_attempts")
    .update({
      status: "failed",
      error_category: classification.category,
      gateway_error_code: classification.code,
      gateway_error_message: classification.message,
      error: args.failureReason ?? classification.message,
      payment_id: args.paymentRowId ?? null,
    })
    .eq("id", attempt.id);

  if (classification.category === "fraud") {
    await cancelRecovery(cycleKey, "fraud");
    await refreshCustomerProfile(userId, "payment_failed");
    return;
  }

  // Continuous learning: the next attempts adapt to what just happened.
  await rescoreOpenCycles(userId, "payment_failed");

  await emitEvent({
    type: "DunningEscalated",
    aggregateType: "subscription",
    aggregateId: subscriptionId,
    idempotencyKey: `recovery_failed:${args.gatewayPaymentId}`,
    payload: {
      userId,
      subscriptionId,
      stage: "attempt_failed",
      attempt: attempt.attempt_number,
      reason: classification.message,
    },
  });
}

async function closeCycle(
  cycleKey: string,
  subscriptionId: string,
  userId: string,
  reason: "recovered" | "cancelled",
) {
  await supabaseAdmin
    .from("billing_dunning_attempts")
    .update({ status: "cancelled", error: reason })
    .eq("cycle_key", cycleKey)
    .eq("status", "scheduled");
  await cancelPendingJobs(cycleKey);

  await refreshCustomerProfile(userId, reason === "recovered" ? "debt_recovered" : "manual");

  if (reason === "recovered") {
    await emitEvent({
      type: "PaymentRecovered",
      aggregateType: "subscription",
      aggregateId: subscriptionId,
      idempotencyKey: `recovered:${cycleKey}`,
      payload: { userId, subscriptionId, cycleKey },
    });
  }
}

export async function cancelRecovery(cycleKey: string, reason: string): Promise<void> {
  await supabaseAdmin
    .from("billing_dunning_attempts")
    .update({ status: "cancelled", error: reason })
    .eq("cycle_key", cycleKey)
    .eq("status", "scheduled");
  await cancelPendingJobs(cycleKey);
}

/** Refunds/chargebacks arriving on the *original* payment stop recovery too. */
export async function cancelRecoveryForSubscription(
  subscriptionId: string,
  reason: string,
): Promise<void> {
  const { data } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .select("cycle_key")
    .eq("subscription_id", subscriptionId)
    .eq("status", "scheduled");
  const keys = [...new Set((data ?? []).map((r) => r.cycle_key as string))];
  for (const key of keys) await cancelRecovery(key, reason);
}

// -------------------------------------------------------------- escalations

export async function runRecoveryEscalation(payload: RecoveryJobPayload): Promise<void> {
  const { cycleKey, subscriptionId, userId, kind } = payload;
  if (!cycleKey || !subscriptionId || !kind) return;
  if (await isCycleClosed(cycleKey)) return;

  const { data: sub } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("status")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub) return;

  const from = sub.status as SubscriptionStatus;
  if (["active", "cancelled", "expired"].includes(from)) return;

  if (kind === "grace_period") {
    // Principle 4: Premium is untouched here — this only opens the window.
    if (from !== "past_due") return;
    assertTransition(from, "grace_period");
    await supabaseAdmin
      .from("billing_subscriptions")
      .update({ status: "grace_period" })
      .eq("id", subscriptionId);
    await emitEvent({
      type: "DunningEscalated",
      aggregateType: "subscription",
      aggregateId: subscriptionId,
      idempotencyKey: `grace:${cycleKey}`,
      payload: { userId, subscriptionId, stage: "grace_period" },
    });
    return;
  }

  if (kind === "suspend") {
    if (from === "suspended") return;
    assertTransition(from, "suspended");
    await supabaseAdmin
      .from("billing_subscriptions")
      .update({ status: "suspended" })
      .eq("id", subscriptionId);
    // Entitlements consumer revokes Premium — never before this point.
    await emitEvent({
      type: "SubscriptionSuspended",
      aggregateType: "subscription",
      aggregateId: subscriptionId,
      idempotencyKey: `suspend:${cycleKey}`,
      payload: { userId, subscriptionId, stage: "suspended" },
    });
    await refreshCustomerProfile(userId, "suspended");
    return;
  }

  // kind === "cancel" — day 90. Nothing is deleted, ever.
  assertTransition(from, "cancelled");
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("billing_subscriptions")
    .update({ status: "cancelled", cancelled_at: now, ended_at: now })
    .eq("id", subscriptionId);
  await cancelRecovery(cycleKey, "recovery_window_exhausted");
  await emitEvent({
    type: "SubscriptionCancelled",
    aggregateType: "subscription",
    aggregateId: subscriptionId,
    idempotencyKey: `recovery_cancel:${cycleKey}`,
    payload: {
      userId,
      subscriptionId,
      immediate: true,
      reason: "recovery_window_exhausted",
      endsAt: now,
    },
  });
  await refreshCustomerProfile(userId, "cancelled");
}

// ----------------------------------------------------------- event triggers

/**
 * Pulls the next scheduled attempt forward when something good happens
 * (new card, login, opening the billing page, before a new checkout).
 * Respects every guard: it only moves the clock.
 */
export async function triggerRecoveryNow(
  userId: string,
  trigger: string,
): Promise<{ triggered: number }> {
  if (await isUserBlockedByPending(userId)) return { triggered: 0 };

  // Every trigger is also a learning event: refresh the profile and re-score
  // the open debt before deciding when to charge again.
  await rescoreOpenCycles(userId, profileTriggerFor(trigger));

  const { data: rows } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .select("cycle_key, subscription_id, attempt_number, scheduled_for")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .order("attempt_number")
    .limit(20);

  const seen = new Set<string>();
  let triggered = 0;
  const soon = new Date(Date.now() + 20_000);

  for (const r of rows ?? []) {
    const key = r.cycle_key as string;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (new Date(r.scheduled_for as string) <= soon) continue; // already due

    await supabaseAdmin
      .from("billing_dunning_attempts")
      .update({ scheduled_for: soon.toISOString() })
      .eq("cycle_key", key)
      .eq("attempt_number", r.attempt_number)
      .eq("status", "scheduled");

    await enqueue(
      "recovery.attempt",
      {
        cycleKey: key,
        subscriptionId: r.subscription_id as string,
        userId,
        attemptNumber: r.attempt_number as number,
      },
      soon,
    );
    triggered += 1;
  }

  if (triggered > 0) {
    await supabaseAdmin.from("audit_log").insert({
      actor_id: userId,
      action: "recovery.triggered",
      entity_type: "user",
      entity_id: userId,
      after: { trigger, triggered } as never,
    });
  }
  return { triggered };
}

function profileTriggerFor(trigger: string): ProfileTrigger {
  if (trigger === "login") return "login";
  if (trigger.includes("payment_method")) return "method_updated";
  if (trigger.includes("plan")) return "plan_changed";
  return "manual";
}

async function isUserBlockedByPending(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("billing_payments")
    .select("id")
    .eq("user_id", userId)
    .in("status", PENDING_STATUSES)
    .gte("created_at", new Date(Date.now() - 2 * HOUR).toISOString())
    .limit(1);
  return (data ?? []).length > 0;
}

export const RECOVERY_WINDOW_DAYS = CANCEL_AT_HOURS / 24;

// ------------------------------------------------- reopen stalled recoveries

/**
 * Regra do clube: uma dívida só sai da recuperação quando é paga, quando a
 * subscrição é cancelada, ou quando passam 90 dias desde a falha. Ciclos que
 * ficaram sem tentativas agendadas (por estratégias antigas mais curtas) são
 * reabertos aqui: as tentativas descartadas voltam a ser agendadas, espaçadas
 * até ao fim da janela.
 */
export async function reopenStalledRecoveries(): Promise<{
  cycles: number;
  attempts: number;
}> {
  const windowStart = new Date(Date.now() - CANCEL_AT_HOURS * HOUR);

  const { data: rows } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .select(
      "id, cycle_key, subscription_id, user_id, attempt_number, status, created_at, phase",
    )
    .gte("created_at", windowStart.toISOString())
    .order("attempt_number");

  const cycles = new Map<string, NonNullable<typeof rows>>();
  for (const r of rows ?? []) {
    const key = r.cycle_key as string;
    if (!key) continue;
    const list = cycles.get(key) ?? [];
    list.push(r);
    cycles.set(key, list);
  }

  let touchedCycles = 0;
  let touchedAttempts = 0;

  for (const [cycleKey, list] of cycles) {
    if (list.some((r) => ["succeeded", "cancelled", "scheduled"].includes(r.status)))
      continue;

    const revivable = list
      .filter((r) => r.status === "skipped")
      .sort((a, b) => (a.attempt_number as number) - (b.attempt_number as number));
    if (revivable.length === 0) continue;

    const subscriptionId = list[0].subscription_id as string;
    const userId = list[0].user_id as string;

    const { data: sub } = await supabaseAdmin
      .from("billing_subscriptions")
      .select("id, status")
      .eq("id", subscriptionId)
      .maybeSingle();
    if (!sub || ["active", "trialing", "cancelled", "expired"].includes(sub.status))
      continue;

    const failedAt = new Date(list[0].created_at as string).getTime();
    const deadline = failedAt + CANCEL_AT_HOURS * HOUR;
    const from = Date.now() + 5 * 60_000;
    if (deadline <= from) continue; // janela de 90 dias esgotada

    const slots = revivable.length;
    const span = deadline - from;

    for (let i = 0; i < slots; i += 1) {
      const when = new Date(
        from + (slots === 1 ? span : (span * i) / (slots - 1)),
      );
      const row = revivable[i];
      const { data: updated } = await supabaseAdmin
        .from("billing_dunning_attempts")
        .update({
          status: "scheduled",
          error: null,
          scheduled_for: when.toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "skipped")
        .select("id")
        .maybeSingle();
      if (!updated) continue;

      await enqueue(
        "recovery.attempt",
        {
          cycleKey,
          subscriptionId,
          userId,
          attemptNumber: row.attempt_number as number,
        },
        when,
      );
      touchedAttempts += 1;
    }

    touchedCycles += 1;
  }

  return { cycles: touchedCycles, attempts: touchedAttempts };
}


// ------------------------------------------------- cobrança imediata (admin)

/**
 * Cobrança forçada agora, sem calendário: tenta o cartão do membro no
 * momento. Mantém a guarda de pagamento pendente (nunca empilha cobranças)
 * e registra a tentativa no histórico de dunning para auditoria.
 */
export async function forceChargeNow(
  userId: string,
): Promise<{ charged: boolean; reason?: string }> {
  if (await isUserBlockedByPending(userId)) {
    return { charged: false, reason: "pending_payment" };
  }

  const { data: sub } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("id, status, gateway, price_id")
    .eq("user_id", userId)
    .in("status", ["past_due", "grace_period", "suspended"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return { charged: false, reason: "no_open_subscription" };

  if (await hasPendingPayment(sub.id)) {
    return { charged: false, reason: "pending_payment" };
  }

  const { data: price } = await supabaseAdmin
    .from("catalog_prices")
    .select("amount_cents, currency")
    .eq("id", sub.price_id)
    .maybeSingle();
  const amountCents = price?.amount_cents ?? 0;
  if (amountCents <= 0) return { charged: false, reason: "nothing_owed" };

  const cycleKey = `force:${sub.id}:${new Date().toISOString().slice(0, 13)}`;
  const attemptNumber = (await attemptsUsed(cycleKey)) + 1;
  const idempotencyKey = `recovery:${cycleKey}:${attemptNumber}`;

  const { error: insertError } = await supabaseAdmin
    .from("billing_dunning_attempts")
    .upsert(
      {
        cycle_key: cycleKey,
        subscription_id: sub.id,
        user_id: userId,
        attempt_number: attemptNumber,
        scheduled_for: new Date().toISOString(),
        phase: "immediate",
        status: "attempted",
        attempted_at: new Date().toISOString(),
        amount_cents: amountCents,
        currency: price?.currency ?? "EUR",
        idempotency_key: idempotencyKey,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    );
  if (insertError) return { charged: false, reason: insertError.message };

  try {
    const charged = await chargeBestMandate({
      userId,
      subscriptionId: sub.id,
      cycleKey,
      attemptNumber,
      amountCents,
      currency: price?.currency ?? "EUR",
      gatewayName: sub.gateway,
    });
    if (!charged) {
      await fail(idempotencyKey, "no_payment_method", "Sem método de pagamento válido.");
      return { charged: false, reason: "no_payment_method" };
    }
    await supabaseAdmin
      .from("billing_dunning_attempts")
      .update({
        gateway_payment_id: charged.gatewayPaymentId,
        mandate_id: charged.mandateId,
        method: charged.method,
      })
      .eq("idempotency_key", idempotencyKey);
    return { charged: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await fail(idempotencyKey, "gateway_error", message);
    return { charged: false, reason: message };
  }
}

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
  ESCALATIONS,
  MAX_RECOVERY_ATTEMPTS,
  scheduledAt,
  type RecoveryPhase,
} from "./schedule";
import { computeRecoveryScore } from "./score";

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

async function scoreInputsFor(args: {
  userId: string;
  cycleKey: string;
  category: FailureCategory;
  amountCents: number;
  failedAt: Date;
}) {
  const [{ count: successes }, { data: firstPayment }, { data: methods }, { data: prior }] =
    await Promise.all([
      supabaseAdmin
        .from("billing_payments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", args.userId)
        .eq("status", "paid"),
      supabaseAdmin
        .from("billing_payments")
        .select("created_at")
        .eq("user_id", args.userId)
        .eq("status", "paid")
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("billing_payment_methods")
        .select("created_at")
        .eq("user_id", args.userId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabaseAdmin
        .from("billing_dunning_attempts")
        .select("attempted_at, status")
        .eq("cycle_key", args.cycleKey)
        .in("status", ["attempted", "failed"])
        .order("attempted_at", { ascending: false }),
    ]);

  const memberSince = firstPayment?.created_at
    ? new Date(firstPayment.created_at)
    : args.failedAt;
  const lastMethodAt = methods?.[0]?.created_at
    ? new Date(methods[0].created_at)
    : null;
  const lastAttemptAt = prior?.[0]?.attempted_at
    ? new Date(prior[0].attempted_at as string)
    : null;

  return {
    category: args.category,
    monthsAsMember: Math.max(
      0,
      (Date.now() - memberSince.getTime()) / (30 * 24 * HOUR),
    ),
    successfulPayments: successes ?? 0,
    consecutiveFailures: (prior ?? []).filter((p) => p.status === "failed").length,
    hoursSinceLastAttempt: lastAttemptAt
      ? (Date.now() - lastAttemptAt.getTime()) / HOUR
      : 0,
    methodUpdatedRecently: lastMethodAt
      ? Date.now() - lastMethodAt.getTime() < 7 * 24 * HOUR
      : false,
    amountCents: args.amountCents,
    debtAgeDays: Math.max(0, (Date.now() - args.failedAt.getTime()) / (24 * HOUR)),
  };
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
  const score = computeRecoveryScore(
    await scoreInputsFor({
      userId: input.userId,
      cycleKey,
      category: classification.category,
      amountCents: input.amountCents,
      failedAt,
    }),
  );

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

  const steps = buildSchedule({ category: classification.category, score });

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

  // Phase transitions run on the clock, independently of the attempts.
  for (const esc of ESCALATIONS) {
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
  amountCents: number;
  currency: string;
  method: string | null;
  gatewayPaymentId: string;
}) {
  await supabaseAdmin.from("billing_dunning_attempts").upsert(
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
      amount_cents: args.amountCents,
      currency: args.currency,
      method: args.method,
      idempotency_key: `recovery:${args.cycleKey}:${args.attemptNumber}`,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
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
  const chosen = pool[(args.attemptNumber - 1) % pool.length];

  const origin = process.env.PUBLIC_APP_URL ?? "https://mmclub.pt";
  const payment = await gw.chargeWithMandate({
    customerId: customer.gateway_customer_id,
    mandateId: chosen.id,
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


  if (args.outcome === "partially_paid") {
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

  if (args.outcome === "refunded" || args.outcome === "chargeback") {
    await supabaseAdmin
      .from("billing_dunning_attempts")
      .update({
        status: "cancelled",
        error: args.outcome === "chargeback" ? "chargeback" : "refunded",
      })
      .eq("id", attempt.id);
    await cancelRecovery(cycleKey, args.outcome);
    if (args.outcome === "chargeback") {
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
    return;
  }

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

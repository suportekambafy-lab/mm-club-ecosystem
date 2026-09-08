/**
 * Domain event catalogue + emission (outbox pattern).
 * Server-only.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CONSUMERS_BY_EVENT } from "./consumers";

export type DomainEventType =
  | "SubscriptionCreated"
  | "SubscriptionActivated"
  | "SubscriptionUpgraded"
  | "SubscriptionDowngraded"
  | "SubscriptionSuspended"
  | "SubscriptionCancelled"
  | "SubscriptionExpired"
  | "SubscriptionResumed"
  | "SubscriptionRenewed"
  | "TrialStarted"
  | "TrialEnded"
  | "PaymentSucceeded"
  | "PaymentFailed"
  | "PaymentRefunded"
  | "PaymentRecovered"
  | "InvoiceIssued"
  | "LedgerEntryRecorded"
  | "DunningEscalated"
  | "ProductPurchased";

export type EmitInput = {
  type: DomainEventType;
  aggregateType: "subscription" | "payment" | "invoice" | "user" | "ledger";
  aggregateId?: string | null;
  payload?: Record<string, unknown>;
  actorId?: string | null;
  /** Guarantees the same real-world occurrence is never recorded twice. */
  idempotencyKey?: string | null;
};

/**
 * Appends an immutable domain event and enqueues one job per registered
 * consumer. Consumers run asynchronously — a failing email never fails a
 * payment.
 */
export async function emitEvent(input: EmitInput): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("domain_events")
    .insert({
      type: input.type,
      aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId ?? null,
      payload: (input.payload ?? {}) as never,
      actor_id: input.actorId ?? null,
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // Duplicate idempotency key → the occurrence was already recorded.
    if (error.code === "23505") return null;
    throw new Error(`emitEvent failed: ${error.message}`);
  }

  const eventId = data?.id ?? null;
  if (!eventId) return null;

  const consumers = CONSUMERS_BY_EVENT[input.type] ?? [];
  if (consumers.length > 0) {
    await supabaseAdmin.from("job_queue").insert(
      consumers.map((consumer) => ({
        event_id: eventId,
        consumer,
        job_type: input.type,
        payload: {
          eventType: input.type,
          aggregateId: input.aggregateId ?? null,
          ...(input.payload ?? {}),
        } as never,
      })),
    );
  }

  return eventId;
}

/**
 * Billing Ledger — append-only accounting book.
 * Entries are never edited or deleted; corrections are reversal entries.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { LedgerDirection, LedgerEntryType } from "./types";

export type RecordEntryInput = {
  userId: string;
  customerId?: string | null;
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amountCents: number;
  currency?: string;
  creditsDelta?: number;
  sourceType: string;
  sourceId?: string | null;
  eventId?: string | null;
  /** Same real-world movement always yields the same key. */
  idempotencyKey: string;
  reversesEntryId?: string | null;
  actorId?: string | null;
  memo?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordLedgerEntry(
  input: RecordEntryInput,
): Promise<string | null> {
  const signed =
    input.direction === "credit" ? input.amountCents : -input.amountCents;

  const { data: last } = await supabaseAdmin
    .from("billing_ledger_entries")
    .select("balance_after")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const balanceAfter = (last?.balance_after ?? 0) + signed;

  const { data, error } = await supabaseAdmin
    .from("billing_ledger_entries")
    .insert({
      user_id: input.userId,
      customer_id: input.customerId ?? null,
      entry_type: input.entryType,
      direction: input.direction,
      amount_cents: input.amountCents,
      currency: input.currency ?? "EUR",
      credits_delta: input.creditsDelta ?? 0,
      balance_after: balanceAfter,
      source_type: input.sourceType,
      source_id: input.sourceId ?? null,
      event_id: input.eventId ?? null,
      idempotency_key: input.idempotencyKey,
      reverses_entry_id: input.reversesEntryId ?? null,
      actor_id: input.actorId ?? null,
      memo: input.memo ?? null,
      metadata: (input.metadata ?? {}) as never,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // Already recorded — the ledger stays consistent under webhook retries.
    if (error.code === "23505") return null;
    throw new Error(`recordLedgerEntry failed: ${error.message}`);
  }
  return data?.id ?? null;
}

export async function getLedgerBalance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("billing_ledger_entries")
    .select("balance_after")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.balance_after ?? 0;
}

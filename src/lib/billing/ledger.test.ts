import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Minimal Supabase query-builder double: records inserts and replays the
 * responses the test queues up.
 */
type Result = { data: unknown; error: unknown };

const state = {
  lastBalance: null as number | null,
  insertResult: { data: { id: "entry_1" }, error: null } as Result,
  inserted: [] as Record<string, unknown>[],
};

vi.mock("@/integrations/supabase/client.server", () => {
  const from = () => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    Object.assign(builder, {
      select: chain,
      eq: chain,
      order: chain,
      limit: chain,
      maybeSingle: async () => {
        if ("__insert" in builder) return state.insertResult;
        return {
          data:
            state.lastBalance == null
              ? null
              : { balance_after: state.lastBalance },
          error: null,
        };
      },
      insert: (row: Record<string, unknown>) => {
        state.inserted.push(row);
        (builder as Record<string, unknown>).__insert = true;
        return builder;
      },
    });
    return builder;
  };
  return { supabaseAdmin: { from } };
});

const { recordLedgerEntry } = await import("./ledger.server");

beforeEach(() => {
  state.lastBalance = null;
  state.insertResult = { data: { id: "entry_1" }, error: null };
  state.inserted = [];
});

describe("billing ledger", () => {
  it("credits increase the running balance", async () => {
    state.lastBalance = 1000;
    await recordLedgerEntry({
      userId: "u1",
      entryType: "payment",
      direction: "credit",
      amountCents: 2990,
      sourceType: "payment",
      idempotencyKey: "payment:tr_1",
    });
    expect(state.inserted[0].balance_after).toBe(3990);
  });

  it("debits decrease the running balance", async () => {
    state.lastBalance = 5000;
    await recordLedgerEntry({
      userId: "u1",
      entryType: "refund",
      direction: "debit",
      amountCents: 1500,
      sourceType: "payment",
      idempotencyKey: "refund:tr_1",
    });
    expect(state.inserted[0].balance_after).toBe(3500);
  });

  it("starts from zero for a user with no history", async () => {
    state.lastBalance = null;
    await recordLedgerEntry({
      userId: "new",
      entryType: "payment",
      direction: "credit",
      amountCents: 990,
      sourceType: "payment",
      idempotencyKey: "payment:tr_new",
    });
    expect(state.inserted[0].balance_after).toBe(990);
  });

  it("is idempotent: a duplicate key is swallowed, not thrown", async () => {
    state.insertResult = { data: null, error: { code: "23505" } };
    await expect(
      recordLedgerEntry({
        userId: "u1",
        entryType: "payment",
        direction: "credit",
        amountCents: 2990,
        sourceType: "payment",
        idempotencyKey: "payment:tr_1",
      }),
    ).resolves.toBeNull();
  });

  it("surfaces real database errors", async () => {
    state.insertResult = { data: null, error: { code: "42501", message: "denied" } };
    await expect(
      recordLedgerEntry({
        userId: "u1",
        entryType: "payment",
        direction: "credit",
        amountCents: 100,
        sourceType: "payment",
        idempotencyKey: "x",
      }),
    ).rejects.toThrow(/denied/);
  });

  it("defaults currency to EUR and credits delta to zero", async () => {
    await recordLedgerEntry({
      userId: "u1",
      entryType: "payment",
      direction: "credit",
      amountCents: 100,
      sourceType: "payment",
      idempotencyKey: "y",
    });
    expect(state.inserted[0].currency).toBe("EUR");
    expect(state.inserted[0].credits_delta).toBe(0);
  });
});

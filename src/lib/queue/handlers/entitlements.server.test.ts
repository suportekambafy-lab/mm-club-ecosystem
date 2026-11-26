import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAccessState } from "@/lib/entitlements/access-state";

type GrantRow = {
  user_id: string;
  source: string;
  source_id: string;
  expires_at: string | null;
  revoked_at: string | null;
};

const store = vi.hoisted(() => ({ rows: [] as GrantRow[] }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "entitlement_grants") throw new Error(`Unexpected table: ${table}`);
      return {
        update: (values: { revoked_at: string }) => {
          const filters: Array<(row: GrantRow) => boolean> = [];
          const query = {
            eq: (key: keyof GrantRow, value: string) => {
              filters.push(row => row[key] === value);
              return query;
            },
            is: (key: keyof GrantRow, value: null) => {
              filters.push(row => row[key] === value);
              for (const row of store.rows) {
                if (filters.every(matches => matches(row))) row.revoked_at = values.revoked_at;
              }
              return Promise.resolve({ error: null });
            },
          };
          return query;
        },
      };
    },
  },
}));

import { entitlementsConsumer } from "./entitlements.server";

describe("billing events preserve independent three-month club access", () => {
  beforeEach(() => {
    store.rows = [
      {
        user_id: "member",
        source: "manual",
        source_id: "7d4b2e00-0000-4000-8000-202611260003",
        expires_at: "2027-02-26T23:59:59Z",
        revoked_at: null,
      },
      {
        user_id: "member",
        source: "subscription",
        source_id: "subscription",
        expires_at: "2026-12-26T23:59:59Z",
        revoked_at: null,
      },
    ];
  });

  it.each(["SubscriptionSuspended", "SubscriptionExpired", "SubscriptionCancelled"])(
    "%s cannot revoke the independent access grant",
    async eventType => {
      await entitlementsConsumer({ eventType, userId: "member", subscriptionId: "subscription", immediate: true });
      const manual = store.rows.find(row => row.source === "manual");
      const subscription = store.rows.find(row => row.source === "subscription");
      expect(manual?.revoked_at).toBeNull();
      expect(subscription?.revoked_at).toEqual(expect.any(String));
      expect(resolveAccessState(store.rows, Date.parse("2027-02-26T12:00:00Z"))).toMatchObject({
        hasAccess: true,
        expiresAt: "2027-02-26T23:59:59Z",
      });
      expect(resolveAccessState(store.rows, Date.parse("2027-02-27T00:00:00Z")).hasAccess).toBe(false);
    },
  );

  it("a failed payment does not change either access grant", async () => {
    const original = structuredClone(store.rows);
    await entitlementsConsumer({ eventType: "PaymentFailed", userId: "member", subscriptionId: "subscription" });
    expect(store.rows).toEqual(original);
    expect(resolveAccessState(store.rows, Date.parse("2027-02-26T12:00:00Z")).hasAccess).toBe(true);
  });
});
import { describe, expect, it, vi, beforeEach } from "vitest";
const state = vi.hoisted(() => ({ guestId: "11111111-1111-4111-8111-111111111111", filters: [] as Array<[string, unknown]>, updates: [] as unknown[] }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./live-guest-identity.server", () => ({ requireGuestIdentity: async () => state.guestId }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => { if (table === "live_participants") state.filters.push([column, value]); return query; },
    maybeSingle: async () => ({ data: { id: "22222222-2222-4222-8222-222222222222", guest_token: "test-code" } }),
    update: (patch: unknown) => { state.updates.push(patch); return query; },
  };
  return query;
} } }));
import { guestLeave } from "./live-guest.functions";

describe("guest leave ownership", () => {
  beforeEach(() => { state.filters = []; state.updates = []; });
  it("cannot target a different guest by supplying their identity", async () => {
    const leave = guestLeave as unknown as (args: { data: { liveId: string; code: string; guestId: string } }) => Promise<{ ok: boolean }>;
    const victim = "33333333-3333-4333-8333-333333333333";
    const result = await leave({ data: { liveId: "22222222-2222-4222-8222-222222222222", code: "test-code", guestId: victim } });
    expect(result.ok).toBe(true);
    expect(state.filters).toContainEqual(["user_id", state.guestId]);
    expect(state.filters).toContainEqual(["is_guest", true]);
    expect(state.filters).not.toContainEqual(["user_id", victim]);
  });
});
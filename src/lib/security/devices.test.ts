import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ filters: [] as Array<[string, unknown]>, writes: [] as Array<{ patch: Record<string, unknown>; options?: unknown }>, conflict: false }));
vi.mock("./runtime.server", () => ({ raiseAlert: vi.fn(), recordSecurityEvent: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  let operation = "read";
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => { if (table === "security_sessions") state.filters.push([column, value]); return query; },
    is: () => query, limit: () => query,
    upsert: (patch: Record<string, unknown>, options: unknown) => { operation = "insert"; if (table === "security_sessions") state.writes.push({ patch, options }); return query; },
    update: (patch: Record<string, unknown>) => { operation = "update"; state.writes.push({ patch }); return query; },
    maybeSingle: async () => ({ data: table === "security_devices" ? { id: "device" } : state.conflict ? null : { id: "session" }, error: null }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  void operation;
  return query;
} } }));
import { registerSession } from "./devices.server";
const input = { userId: "current-user", sessionToken: "submitted-token", fingerprint: "device-id", ip: null, userAgent: null, country: null, city: null };
describe("session owner integrity", () => {
  beforeEach(() => { state.filters = []; state.writes = []; state.conflict = false; });
  it("claims without overwriting and scopes updates to the authenticated owner", async () => {
    await registerSession(input);
    expect(state.writes[0]?.options).toEqual({ onConflict: "session_token", ignoreDuplicates: true });
    expect(state.writes[1]?.patch).not.toHaveProperty("user_id");
    expect(state.filters).toContainEqual(["user_id", "current-user"]);
    expect(state.filters).toContainEqual(["session_token", "submitted-token"]);
  });
  it("rejects a token not owned by the caller", async () => {
    state.conflict = true;
    await expect(registerSession(input)).rejects.toThrow("Sessão inválida.");
  });
});
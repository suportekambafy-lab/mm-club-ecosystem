import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createMemberWithPassword, sendNewMemberAccess } from "./member-onboarding.server";

const { send } = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue({ sent: true }) }));
vi.mock("@/lib/email-templates/send-email", () => ({ sendTemplateEmail: send }));

function client(createUser: ReturnType<typeof vi.fn>) {
  return { auth: { admin: { createUser } } } as unknown as SupabaseClient<Database>;
}

describe("new member access", () => {
  it("creates a usable account with a generated password rather than an invitation", async () => {
    const createUser = vi.fn().mockResolvedValue({ data: { user: { id: "new-member" } }, error: null });
    const result = await createMemberWithPassword(client(createUser), " ANA@example.com ", "Ana");
    expect(createUser).toHaveBeenCalledWith({ email: "ana@example.com", password: result.password, email_confirm: true, user_metadata: { display_name: "Ana" } });
    expect(result.password.length).toBeGreaterThanOrEqual(16);
    expect(result.id).toBe("new-member");
  });
  it("does not overwrite an existing account when creation reports a duplicate", async () => {
    const error = new Error("already registered");
    const createUser = vi.fn().mockResolvedValue({ data: { user: null }, error });
    await expect(createMemberWithPassword(client(createUser), "existing@example.com")).rejects.toBe(error);
    expect(createUser).toHaveBeenCalledTimes(1);
  });
  it("sends the same generated credentials with a fixed welcome template and event key", async () => {
    await sendNewMemberAccess({ email: "ana@example.com", name: "Ana Silva", password: "test-only-password", eventId: "manual-new-member" });
    expect(send).toHaveBeenCalledWith("club-welcome", "ana@example.com", { templateData: { email: "ana@example.com", name: "Ana", password: "test-only-password", accessDescription: undefined }, idempotencyKey: "club-welcome-manual-new-member" });
  });
});
import { describe, expect, it, vi } from "vitest";
import { isCardUpdateEmailDisabled } from "./card-update-policy";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

describe("card update emails", () => {
  it.each([
    "payment_method_update", "winback", "billing.card_expired",
    "billing.payment_failed", "recovery.card_expired", "recovery.grace_period",
    "recovery.last_warning", "recovery.suspended",
  ])("blocks %s", (key) => {
    expect(isCardUpdateEmailDisabled(key)).toBe(true);
  });

  it.each(["billing.payment_succeeded", "billing.invoice_created", "account.welcome", "community_post", "legacy_winback"])(
    "preserves %s", (key) => {
      expect(isCardUpdateEmailDisabled(key)).toBe(false);
    },
  );

  it("blocks legacy migration mail before accessing recipients or delivery", async () => {
    const { sendEmail } = await import("@/lib/email.server");
    await expect(sendEmail({
      to: "test@example.com", subject: "test", html: "test",
      userId: "test-user", kind: "payment_method_update", ref: "test",
    })).resolves.toEqual({ sent: false, skipped: true });
  });

  it("blocks forced resend of a card reminder before accessing recipients or delivery", async () => {
    const { notify } = await import("./engine.server");
    await expect(notify({
      templateKey: "recovery.card_expired", userId: "test-user", force: true,
    })).resolves.toEqual({ sent: false, skipped: true, reason: "card_update_disabled" });
  });
});
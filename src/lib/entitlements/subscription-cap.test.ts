import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { capSubscriptionExpiry } from "./grants.server";
describe("assinatura não prolonga para além de 26/02/2027", () => {
  it("corta renovação", () => expect(capSubscriptionExpiry("subscription", "2027-05-01T00:00:00Z")).toBe("2027-02-26T23:59:59Z"));
  it("corta sem fim", () => expect(capSubscriptionExpiry("subscription", null)).toBe("2027-02-26T23:59:59Z"));
  it("compras não mudam", () => expect(capSubscriptionExpiry("purchase", "2027-05-01T00:00:00Z")).toBe("2027-05-01T00:00:00Z"));
});

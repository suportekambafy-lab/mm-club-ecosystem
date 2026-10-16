import { describe, expect, it } from "vitest";
import { canUseCommercial, canManageCommercialTeam, manualAccessSchema } from "./rules";
describe("commercial permissions", () => {
  it.each(["sdr", "closer", "admin"])("allows %s into commercial area", (role) => expect(canUseCommercial([role])).toBe(true));
  it("denies ordinary members and moderators", () => { expect(canUseCommercial(["user"])).toBe(false); expect(canUseCommercial(["moderator"])).toBe(false); });
  it("only admins assign staff", () => { expect(canManageCommercialTeam(["admin"])).toBe(true); expect(canManageCommercialTeam(["sdr", "closer"])).toBe(false); });
  it.each([1, 3, 6, 12, "lifetime"])("accepts access duration %s", months => expect(manualAccessSchema.safeParse({userId:"1f99a727-8210-49bb-a848-7cc5d77e8c89",months,reason:"Venda manual"}).success).toBe(true));
  it.each([0, 2, 24, null])("rejects unapproved duration %s", months => expect(manualAccessSchema.safeParse({userId:"1f99a727-8210-49bb-a848-7cc5d77e8c89",months,reason:"Venda manual"}).success).toBe(false));
});
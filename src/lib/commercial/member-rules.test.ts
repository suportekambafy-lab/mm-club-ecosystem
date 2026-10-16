import { describe, expect, it } from "vitest";
import { canManageMemberAccounts, canDeleteMemberAccount, deleteMemberSchema, memberDetailsSchema } from "./member-rules";
describe("member account safeguards", () => {
 it("reserves account changes for admins", () => { expect(canManageMemberAccounts(false)).toBe(false); expect(canManageMemberAccounts(true)).toBe(true); });
 it("blocks deleting your own account", () => expect(canDeleteMemberAccount("a", "a", false, false)).toBe(false));
 it("protects staff accounts", () => expect(canDeleteMemberAccount("a", "b", true, false)).toBe(false));
 it("blocks accounts with ongoing billing", () => expect(canDeleteMemberAccount("a", "b", false, true)).toBe(false));
 it("permits deletion of ordinary accounts without ongoing billing", () => expect(canDeleteMemberAccount("a", "b", false, false)).toBe(true));
 it("requires explicit deletion confirmation", () => expect(deleteMemberSchema.safeParse({userId:"e78f7368-de84-4550-aefc-1d5c41192c86",confirmation:""}).success).toBe(false));
 it("validates corrected email", () => expect(memberDetailsSchema.safeParse({name:"Nome",email:"invalid"}).success).toBe(false));
});

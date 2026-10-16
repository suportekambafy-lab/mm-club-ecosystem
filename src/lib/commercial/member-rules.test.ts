import { describe, expect, it } from "vitest";
import { canManageMemberAccounts, canDeleteMemberAccount, deleteMemberSchema, memberDetailsSchema, createMemberSchema } from "./member-rules";
describe("member account safeguards", () => {
 it("reserves account changes for admins", () => { expect(canManageMemberAccounts(false)).toBe(false); expect(canManageMemberAccounts(true)).toBe(true); });
 it("blocks deleting your own account", () => expect(canDeleteMemberAccount("a", "a", false, false)).toBe(false));
 it("protects staff accounts", () => expect(canDeleteMemberAccount("a", "b", true, false)).toBe(false));
 it("blocks accounts with ongoing billing", () => expect(canDeleteMemberAccount("a", "b", false, true)).toBe(false));
 it("permits deletion of ordinary accounts without ongoing billing", () => expect(canDeleteMemberAccount("a", "b", false, false)).toBe(true));
 it("requires explicit deletion confirmation", () => expect(deleteMemberSchema.safeParse({userId:"e78f7368-de84-4550-aefc-1d5c41192c86",confirmation:""}).success).toBe(false));
 it("validates corrected email", () => expect(memberDetailsSchema.safeParse({name:"Nome",email:"invalid"}).success).toBe(false));
 it("requires duration when creating a member", () => expect(createMemberSchema.safeParse({name:"Nome",email:"member@example.com"}).success).toBe(false));
 it.each([1,3,6,12,"lifetime"])("creates a member with duration %s", months => expect(createMemberSchema.safeParse({name:"Nome",email:"member@example.com",months}).success).toBe(true));
});

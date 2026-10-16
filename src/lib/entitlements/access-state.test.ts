import { describe, expect, it } from "vitest";
import { resolveAccessState } from "./access-state";
const grant = { expires_at: "2026-11-16T22:00:00Z", revoked_at: null, source: "manual", metadata: { origin: "commercial" } };
describe("manual club expiry", () => {
 it("allows access before the exact expiry", () => expect(resolveAccessState([grant], Date.parse("2026-11-16T21:59:59Z")).hasAccess).toBe(true));
 it("blocks and marks expired at the exact expiry", () => expect(resolveAccessState([grant], Date.parse("2026-11-16T22:00:00Z"))).toMatchObject({hasAccess:false,expired:true}));
 it("lifetime access never expires", () => expect(resolveAccessState([{...grant,expires_at:null}], Date.parse("2099-01-01T00:00:00Z"))).toMatchObject({hasAccess:true,expiresAt:null,expired:false}));
 it("preserves another valid subscription after manual expiry", () => expect(resolveAccessState([grant,{...grant,source:"subscription",expires_at:"2026-12-16T22:00:00Z"}],Date.parse("2026-11-17T00:00:00Z"))).toMatchObject({hasAccess:true,expired:false,expiresAt:"2026-12-16T22:00:00Z"}));
 it("does not allow revoked lifetime access", () => expect(resolveAccessState([{...grant,expires_at:null,revoked_at:"2026-10-16T22:00:00Z"}],Date.parse("2026-11-17T00:00:00Z")).hasAccess).toBe(false));
});
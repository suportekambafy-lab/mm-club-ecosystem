import { describe, expect, it } from "vitest";
import { isLeadLocked, leadAttribution } from "./lead-presentation";

describe("lead ownership", () => {
  it("locks contact and status actions for staff other than the responsible person", () => {
    expect(isLeadLocked({ responsavel_id: "guadalupe" }, "elizangela")).toBe(true);
    expect(isLeadLocked({ responsavel_id: "guadalupe" }, "guadalupe")).toBe(false);
    expect(isLeadLocked({ responsavel_id: null }, "elizangela")).toBe(false);
  });
  it("attributes scheduled calls to the responsible person", () => {
    expect(leadAttribution({ status: "call_marcada", responsavel_id: "guadalupe", responsavel: "Guadalupe" })).toEqual({ kind: "call", actorId: "guadalupe", name: "Guadalupe" });
  });
  it("attributes a sale to its recorded closer even if the current owner differs", () => {
    expect(leadAttribution({ status: "fechou", sale_closed_by: "guadalupe", responsavel_id: "elizangela", responsavel: "Elizângela" }, { guadalupe: "Guadalupe" })).toEqual({ kind: "sale", actorId: "guadalupe", name: "Guadalupe" });
    expect(leadAttribution({ status: "novo", responsavel_id: "guadalupe" })).toBeNull();
  });
});
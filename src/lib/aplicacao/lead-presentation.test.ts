import { describe, expect, it } from "vitest";
import { canScheduleCall, isLeadLocked, leadAttribution } from "./lead-presentation";

describe("lead ownership", () => {
  it("locks contact and status actions for staff other than the responsible person", () => {
    expect(isLeadLocked({ responsavel_id: "guadalupe" }, "elizangela")).toBe(true);
    expect(isLeadLocked({ responsavel_id: "guadalupe" }, "guadalupe")).toBe(false);
    expect(isLeadLocked({ responsavel_id: null }, "elizangela")).toBe(false);
  });
  it("attributes scheduled calls to the responsible person", () => {
    expect(leadAttribution({ status: "call_marcada", responsavel_id: "guadalupe", responsavel: "Guadalupe" })).toEqual({ kind: "call", actorId: "guadalupe", name: "Guadalupe" });
  });
  it("attributes a call to the SDR who scheduled it, not the assigned closer", () => {
    expect(leadAttribution({ status: "call_marcada", call_scheduled_by: "eliza", responsavel_id: "lupe", responsavel: "Guadalupe" }, { eliza: "Elizângela" })).toEqual({ kind: "call", actorId: "eliza", name: "Elizângela" });
  });
  it("only SDRs and admins can schedule calls", () => {
    expect(canScheduleCall(["sdr"])).toBe(true);
    expect(canScheduleCall(["admin"])).toBe(true);
    expect(canScheduleCall(["closer"])).toBe(false);
  });
  it("attributes a sale to its recorded closer even if the current owner differs", () => {
    expect(leadAttribution({ status: "fechou", sale_closed_by: "guadalupe", responsavel_id: "elizangela", responsavel: "Elizângela" }, { guadalupe: "Guadalupe" })).toEqual({ kind: "sale", actorId: "guadalupe", name: "Guadalupe" });
    expect(leadAttribution({ status: "novo", responsavel_id: "guadalupe" })).toBeNull();
  });
});
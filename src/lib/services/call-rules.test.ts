import { describe, expect, it } from "vitest";
import { serviceUpdateSchema, canScheduleServiceCall } from "./call-rules";

const id = "11111111-1111-4111-8111-111111111111";
describe("service calls", () => {
  it("requires date and closer when scheduling", () => {
    expect(serviceUpdateSchema.safeParse({ id, status: "call_marcada" }).success).toBe(false);
    expect(serviceUpdateSchema.safeParse({ id, status: "call_marcada", callScheduledAt: "2026-12-01T20:30:00.000Z" }).success).toBe(false);
    expect(serviceUpdateSchema.safeParse({ id, status: "call_marcada", closerId: id, callScheduledAt: "2026-12-01T20:30:00.000Z" }).success).toBe(true);
  });
  it("only SDR/admin can schedule", () => {
    expect(canScheduleServiceCall(null, id, ["closer"])).toBe(false);
    expect(canScheduleServiceCall(null, id, ["sdr"])).toBe(true);
    expect(canScheduleServiceCall(null, id, ["admin"])).toBe(true);
  });
  it("allows only the scheduler to reschedule another closer's call", () => {
    const lead = { status: "call_marcada", responsavel_id: "closer", call_scheduled_by: id };
    expect(canScheduleServiceCall(lead, id, ["sdr"])).toBe(true);
    expect(canScheduleServiceCall(lead, "other", ["sdr"])).toBe(false);
  });
  it("does not reschedule a closed sale", () => {
    expect(canScheduleServiceCall({ status: "fechou" }, id, ["admin"])).toBe(false);
  });
});
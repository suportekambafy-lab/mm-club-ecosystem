import { describe, it, expect } from "vitest";
import { leadUpdateSchema } from "./sale-rules";
import { parseCallDateTime, callCountdown, callReminderStage } from "./call-rules";
const id = "00000000-0000-4000-8000-000000000001";
describe("scheduled calls", () => {
  it("requires date and time when marking a call", () => {
    expect(leadUpdateSchema.safeParse({ id, status: "call_marcada" }).success).toBe(false);
    expect(leadUpdateSchema.safeParse({ id, status: "call_marcada", callScheduledAt: "2026-12-01T10:00:00.000Z" }).success).toBe(true);
  });
  it("uses Lisbon time in summer and winter", () => {
    expect(parseCallDateTime("2026-10-17T10:00")).toBe("2026-10-17T09:00:00.000Z");
    expect(parseCallDateTime("2026-12-01T10:00")).toBe("2026-12-01T10:00:00.000Z");
    expect(parseCallDateTime("2026-02-30T10:00")).toBeNull();
  });
  it("counts down to the scheduled time", () => {
    expect(callCountdown("2026-12-01T10:00:00Z", Date.parse("2026-12-01T09:58:55Z"))).toBe("00:01:05");
  });
  it("reminds fifteen minutes before and at the start, not old calls", () => {
    const at = "2026-12-01T10:00:00Z";
    expect(callReminderStage(at, Date.parse("2026-12-01T09:44:00Z"))).toBeNull();
    expect(callReminderStage(at, Date.parse("2026-12-01T09:45:00Z"))).toBe("soon");
    expect(callReminderStage(at, Date.parse(at))).toBe("now");
    expect(callReminderStage(at, Date.parse("2026-12-01T10:06:00Z"))).toBeNull();
  });
});
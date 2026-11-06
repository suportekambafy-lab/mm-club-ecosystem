import { describe, expect, it } from "vitest";
import { bucketRevenue, dayWindow, last7DaysStartIso, previousMonthWindow } from "./goal-rules";

const now = new Date("2026-11-06T12:30:00Z");
describe("faturamento por período", () => {
  it("dia de Lisboa", () => expect(dayWindow(now)).toEqual({ startIso: "2026-11-06T00:00:00.000Z", endIso: "2026-11-07T00:00:00.000Z" }));
  it("últimos 7 dias começam 6 dias antes de hoje", () => expect(last7DaysStartIso(now)).toBe("2026-10-31T00:00:00.000Z"));
  it("último mês é outubro (horário de verão)", () => expect(previousMonthWindow(now)).toMatchObject({ monthKey: "2026-10", startIso: "2026-09-30T23:00:00.000Z" }));
  it("soma cada venda nos períodos certos", () => {
    const r = bucketRevenue([
      { at: "2026-11-06T09:00:00Z", cents: 100 },
      { at: "2026-11-01T09:00:00Z", cents: 200 },
      { at: "2026-10-31T09:00:00Z", cents: 400 },
      { at: "2026-10-20T09:00:00Z", cents: 800 },
    ], now);
    expect(r).toEqual({ todayCents: 100, last7DaysCents: 700, monthCents: 300, lastMonthCents: 1200 });
  });
});

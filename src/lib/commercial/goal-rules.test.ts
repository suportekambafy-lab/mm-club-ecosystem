import { describe, expect, it } from "vitest";
import { DEFAULT_MONTHLY_GOAL_EUR_CENTS, monthlyGoalEurCents, monthlyWindow, summarizeGoal } from "./goal-rules";

describe("meta do mês", () => {
  it("tem 20.000 € de objetivo em novembro de 2026", () => {
    expect(monthlyGoalEurCents("2026-11")).toBe(2_000_000);
  });

  it("aplica o objetivo por omissão aos meses sem objetivo próprio", () => {
    expect(monthlyGoalEurCents("2026-12")).toBe(DEFAULT_MONTHLY_GOAL_EUR_CENTS);
    expect(DEFAULT_MONTHLY_GOAL_EUR_CENTS).toBe(2_000_000);
  });

  it("usa o mês de Lisboa com as fronteiras do mês", () => {
    const november = monthlyWindow(new Date("2026-11-06T12:30:00Z"));
    expect(november.monthKey).toBe("2026-11");
    expect(november.startIso).toBe("2026-11-01T00:00:00.000Z");
    expect(november.endIso).toBe("2026-12-01T00:00:00.000Z");
  });

  it("muda de mês à meia-noite de Lisboa, não à de UTC", () => {
    const july = monthlyWindow(new Date("2026-06-30T23:30:00Z"));
    expect(july.monthKey).toBe("2026-07");
    expect(july.startIso).toBe("2026-06-30T23:00:00.000Z");
    expect(july.endIso).toBe("2026-07-31T23:00:00.000Z");
  });

  it("mostra 22% e faltam 15.562 € com 4.438 € de 20.000 €", () => {
    expect(summarizeGoal(443_800, 2_000_000)).toEqual({ percent: 22, remainingCents: 1_556_200, reached: false });
  });

  it("dá a meta como atingida sem passar dos 100%", () => {
    expect(summarizeGoal(2_000_000, 2_000_000)).toEqual({ percent: 100, remainingCents: 0, reached: true });
    expect(summarizeGoal(2_500_000, 2_000_000)).toEqual({ percent: 100, remainingCents: 0, reached: true });
  });

  it("começa em 0% com zero vendas", () => {
    expect(summarizeGoal(0, 2_000_000)).toEqual({ percent: 0, remainingCents: 2_000_000, reached: false });
  });
});

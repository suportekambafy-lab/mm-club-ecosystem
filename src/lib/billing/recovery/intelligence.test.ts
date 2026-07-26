import { describe, expect, it } from "vitest";
import {
  adaptSchedule,
  decideStrategy,
  emptyProfile,
  scoreRecovery,
  type CustomerPaymentProfile,
} from "./intelligence";
import { buildSchedule, CANCEL_AT_HOURS, MAX_RECOVERY_ATTEMPTS } from "./schedule";

function profile(over: Partial<CustomerPaymentProfile> = {}): CustomerPaymentProfile {
  return { ...emptyProfile("u1"), ...over };
}

const ctx = {
  category: "recoverable" as const,
  consecutiveFailures: 1,
  hoursSinceLastAttempt: 0,
  amountCents: 2990,
  debtAgeDays: 0,
};

describe("Revenue Intelligence — score", () => {
  it("is explainable: factors always add up to the score", () => {
    const { score, factors } = scoreRecovery(profile({ monthsAsCustomer: 24 }), ctx);
    const sum = factors.reduce((s, f) => s + f.points, 0);
    expect(Math.round(Math.max(0, Math.min(100, sum)))).toBe(score);
    expect(factors.some((f) => f.key === "baseline")).toBe(true);
  });

  it("customer A — long history, one insufficient-funds failure → high score", () => {
    const { score } = scoreRecovery(
      profile({
        monthsAsCustomer: 36,
        consecutiveSuccesses: 36,
        paymentsSucceeded: 36,
        recoveriesSucceeded: 2,
        recoveryRate: 1,
      }),
      ctx,
    );
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it("customer B — new account, expired card → low score and no insistence", () => {
    const p = profile({ monthsAsCustomer: 0.1, expiredCards: 1 });
    const { score } = scoreRecovery(p, { ...ctx, category: "permanent" });
    expect(score).toBeLessThan(50);
    const strategy = decideStrategy({
      score,
      category: "permanent",
      profile: p,
      amountCents: 2990,
    });
    expect(strategy.aggressiveness).toBe("communicate");
    expect(strategy.maxAttempts).toBeLessThanOrEqual(3);
  });

  it("customer D — never recovers, several suspensions → communication only", () => {
    const p = profile({
      monthsAsCustomer: 20,
      recoveriesSucceeded: 0,
      recoveriesFailed: 4,
      suspensions: 3,
      cancellations: 2,
    });
    const { score } = scoreRecovery(p, ctx);
    const strategy = decideStrategy({
      score,
      category: "recoverable",
      profile: p,
      amountCents: 2990,
    });
    expect(strategy.aggressiveness).toBe("communicate");
  });

  it("fraud always scores zero and stops the engine", () => {
    const { score } = scoreRecovery(profile(), { ...ctx, category: "fraud" });
    expect(score).toBe(0);
    expect(
      decideStrategy({
        score,
        category: "fraud",
        profile: profile(),
        amountCents: 100,
      }).maxAttempts,
    ).toBe(0);
  });
});

describe("Revenue Intelligence — adaptive calendar", () => {
  const failedAt = new Date("2026-03-01T10:00:00.000Z");

  it("never exceeds the strategy cap nor the absolute ceiling", () => {
    const p = profile({ monthsAsCustomer: 48, consecutiveSuccesses: 48, recoveryRate: 1 });
    const { score } = scoreRecovery(p, ctx);
    const strategy = decideStrategy({
      score,
      category: "recoverable",
      profile: p,
      amountCents: 2990,
    });
    const plan = adaptSchedule(
      buildSchedule({ category: "recoverable", score }),
      strategy,
      failedAt,
      CANCEL_AT_HOURS,
    );
    expect(plan.length).toBeLessThanOrEqual(strategy.maxAttempts);
    expect(plan.length).toBeLessThanOrEqual(MAX_RECOVERY_ATTEMPTS);
  });

  it("never schedules past the 90-day recovery window", () => {
    const p = profile({ monthsAsCustomer: 2 });
    const { score } = scoreRecovery(p, ctx);
    const strategy = decideStrategy({
      score,
      category: "recoverable",
      profile: p,
      amountCents: 2990,
    });
    const plan = adaptSchedule(
      buildSchedule({ category: "recoverable", score }),
      strategy,
      failedAt,
      CANCEL_AT_HOURS,
    );
    for (const step of plan) expect(step.offsetHours).toBeLessThanOrEqual(CANCEL_AT_HOURS);
  });

  it("keeps attempts strictly ordered in time", () => {
    const p = profile({ typicalPayDay: 28, bestPayHour: 9, monthsAsCustomer: 14 });
    const { score } = scoreRecovery(p, ctx);
    const strategy = decideStrategy({
      score,
      category: "recoverable",
      profile: p,
      amountCents: 2990,
    });
    const plan = adaptSchedule(
      buildSchedule({ category: "recoverable", score }),
      strategy,
      failedAt,
      CANCEL_AT_HOURS,
    );
    for (let i = 1; i < plan.length; i += 1) {
      expect(plan[i].offsetHours).toBeGreaterThan(plan[i - 1].offsetHours);
    }
  });

  it("customer C — concentrates retries around the usual pay day", () => {
    const p = profile({ typicalPayDay: 28, monthsAsCustomer: 18, consecutiveSuccesses: 10 });
    const { score } = scoreRecovery(p, ctx);
    const strategy = decideStrategy({
      score,
      category: "recoverable",
      profile: p,
      amountCents: 2990,
    });
    const plan = adaptSchedule(
      buildSchedule({ category: "recoverable", score }),
      strategy,
      failedAt,
      CANCEL_AT_HOURS,
    );
    const days = plan
      .filter((s) => s.offsetHours >= 24)
      .map((s) =>
        new Date(failedAt.getTime() + s.offsetHours * 3_600_000).getDate(),
      );
    expect(days.some((d) => d >= 27 && d <= 30)).toBe(true);
  });

  it("the first attempt is always immediate", () => {
    const p = profile();
    const { score } = scoreRecovery(p, ctx);
    const strategy = decideStrategy({
      score,
      category: "recoverable",
      profile: p,
      amountCents: 2990,
    });
    const plan = adaptSchedule(
      buildSchedule({ category: "recoverable", score }),
      strategy,
      failedAt,
      CANCEL_AT_HOURS,
    );
    expect(plan[0].offsetHours).toBe(0);
  });
});

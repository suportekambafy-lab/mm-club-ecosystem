import { describe, expect, it } from "vitest";
import { classifyFailure, normalizeFailureCode } from "./classify";
import {
  buildSchedule,
  CANCEL_AT_HOURS,
  GRACE_STARTS_AT_HOURS,
  jitterHours,
  MAX_RECOVERY_ATTEMPTS,
  phaseForOffset,
  scheduledAt,
  SUSPEND_AT_HOURS,
} from "./schedule";
import { computeRecoveryScore, scoreBand, type ScoreInputs } from "./score";

const baseScore: ScoreInputs = {
  category: "recoverable",
  monthsAsMember: 6,
  successfulPayments: 6,
  consecutiveFailures: 1,
  hoursSinceLastAttempt: 0,
  methodUpdatedRecently: false,
  amountCents: 2990,
  debtAgeDays: 0,
};

describe("classifyFailure", () => {
  it("normalises free-form gateway reasons", () => {
    expect(normalizeFailureCode("Insufficient Funds")).toBe("insufficient_funds");
    expect(normalizeFailureCode(null)).toBe("unknown_reason");
  });

  it("treats funding problems as recoverable", () => {
    const c = classifyFailure("insufficient_funds");
    expect(c.category).toBe("recoverable");
    expect(c.requiresNewMethod).toBe(false);
    expect(c.maxAttempts).toBeGreaterThan(1);
  });

  it("treats dead instruments as permanent and asks for a new card", () => {
    const c = classifyFailure("card_expired");
    expect(c.category).toBe("permanent");
    expect(c.requiresNewMethod).toBe(true);
  });

  it("stops immediately on fraud", () => {
    expect(classifyFailure("suspected_fraud").category).toBe("fraud");
    expect(buildSchedule({ category: "fraud", score: 0 })).toHaveLength(0);
  });

  it("falls back to recoverable for unknown reasons", () => {
    expect(classifyFailure("something_new_from_gateway").category).toBe(
      "recoverable",
    );
  });

  it("never exceeds the global attempt ceiling", () => {
    for (const reason of ["insufficient_funds", "card_expired", "fraud"]) {
      expect(classifyFailure(reason).maxAttempts).toBeLessThanOrEqual(
        MAX_RECOVERY_ATTEMPTS,
      );
    }
  });
});

describe("buildSchedule", () => {
  it("caps every calendar at 15 attempts", () => {
    const steps = buildSchedule({ category: "recoverable", score: 100 });
    expect(steps.length).toBeLessThanOrEqual(MAX_RECOVERY_ATTEMPTS);
  });

  it("retries immediately on the first attempt", () => {
    const steps = buildSchedule({ category: "recoverable", score: 90 });
    expect(steps[0].offsetHours).toBe(0);
    expect(steps[0].phase).toBe("immediate");
  });

  it("is strictly increasing in time", () => {
    const steps = buildSchedule({ category: "recoverable", score: 90 });
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].offsetHours).toBeGreaterThan(steps[i - 1].offsetHours);
    }
  });

  it("spaces out low scores and gives them fewer attempts", () => {
    const high = buildSchedule({ category: "recoverable", score: 90 });
    const low = buildSchedule({ category: "recoverable", score: 20 });
    expect(low.length).toBeLessThan(high.length);
    expect(low[1].offsetHours).toBeGreaterThan(high[1].offsetHours);
  });

  it("gives permanent failures a short calendar", () => {
    const permanent = buildSchedule({ category: "permanent", score: 90 });
    const recoverable = buildSchedule({ category: "recoverable", score: 90 });
    expect(permanent.length).toBeLessThan(recoverable.length);
  });

  it("never schedules past the 90-day cancellation milestone", () => {
    const steps = buildSchedule({ category: "recoverable", score: 100 });
    for (const s of steps) {
      expect(s.offsetHours).toBeLessThanOrEqual(CANCEL_AT_HOURS);
    }
  });
});

describe("phaseForOffset", () => {
  it("maps the three phases to their milestones", () => {
    expect(phaseForOffset(0)).toBe("immediate");
    expect(phaseForOffset(GRACE_STARTS_AT_HOURS - 1)).toBe("immediate");
    expect(phaseForOffset(GRACE_STARTS_AT_HOURS)).toBe("grace");
    expect(phaseForOffset(SUSPEND_AT_HOURS - 1)).toBe("grace");
    expect(phaseForOffset(SUSPEND_AT_HOURS)).toBe("suspended");
  });
});

describe("jitter", () => {
  it("keeps the first attempt immediate", () => {
    expect(jitterHours(0, () => 0.5)).toBe(0);
  });

  it("stays within ±15% of the planned offset", () => {
    for (const r of [0, 0.5, 0.999]) {
      const j = jitterHours(100, () => r);
      expect(j).toBeGreaterThanOrEqual(85);
      expect(j).toBeLessThanOrEqual(115);
    }
  });

  it("produces a date after the failure", () => {
    const failedAt = new Date("2026-01-01T00:00:00Z");
    const at = scheduledAt(failedAt, 24, () => 0.5);
    expect(at.getTime()).toBeGreaterThan(failedAt.getTime());
  });
});

describe("computeRecoveryScore", () => {
  it("is always inside 0–100", () => {
    const extremes: ScoreInputs[] = [
      { ...baseScore, monthsAsMember: 500, successfulPayments: 500 },
      { ...baseScore, consecutiveFailures: 50, debtAgeDays: 500 },
    ];
    for (const i of extremes) {
      const s = computeRecoveryScore(i);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("zeroes fraud", () => {
    expect(computeRecoveryScore({ ...baseScore, category: "fraud" })).toBe(0);
  });

  it("rewards a freshly updated payment method", () => {
    const before = computeRecoveryScore(baseScore);
    const after = computeRecoveryScore({
      ...baseScore,
      methodUpdatedRecently: true,
    });
    expect(after).toBeGreaterThan(before);
  });

  it("penalises repeated failures and ageing debt", () => {
    const fresh = computeRecoveryScore(baseScore);
    expect(
      computeRecoveryScore({ ...baseScore, consecutiveFailures: 5 }),
    ).toBeLessThan(fresh);
    expect(computeRecoveryScore({ ...baseScore, debtAgeDays: 60 })).toBeLessThan(
      fresh,
    );
  });

  it("scores loyal members above brand-new ones", () => {
    const loyal = computeRecoveryScore({
      ...baseScore,
      monthsAsMember: 24,
      successfulPayments: 24,
    });
    const newbie = computeRecoveryScore({
      ...baseScore,
      monthsAsMember: 0,
      successfulPayments: 0,
    });
    expect(loyal).toBeGreaterThan(newbie);
  });

  it("bands the score consistently", () => {
    expect(scoreBand(85)).toBe("high");
    expect(scoreBand(50)).toBe("medium");
    expect(scoreBand(10)).toBe("low");
  });
});

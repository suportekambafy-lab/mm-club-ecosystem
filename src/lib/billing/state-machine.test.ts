import { describe, expect, it } from "vitest";
import {
  ACTIVE_LIKE,
  assertTransition,
  canTransition,
  TRANSITIONS,
} from "./state-machine";
import type { SubscriptionStatus } from "./types";

const ALL = Object.keys(TRANSITIONS) as SubscriptionStatus[];

describe("subscription state machine", () => {
  it("allows the documented happy path", () => {
    expect(canTransition("trialing", "active")).toBe(true);
    expect(canTransition("active", "past_due")).toBe(true);
    expect(canTransition("past_due", "grace_period")).toBe(true);
    expect(canTransition("grace_period", "active")).toBe(true);
    expect(canTransition("active", "cancelled")).toBe(true);
    expect(canTransition("cancelled", "expired")).toBe(true);
  });

  it("treats a no-op transition as valid (idempotent webhooks)", () => {
    for (const s of ALL) expect(canTransition(s, s)).toBe(true);
  });

  it("refuses resurrection from expired", () => {
    for (const s of ALL) {
      if (s === "expired") continue;
      expect(canTransition("expired", s)).toBe(false);
    }
  });

  it("refuses illegal jumps", () => {
    expect(canTransition("cancelled", "active")).toBe(false);
    expect(canTransition("trialing", "grace_period")).toBe(false);
    expect(canTransition("suspended", "past_due")).toBe(false);
  });

  it("throws with a readable message on an illegal transition", () => {
    expect(() => assertTransition("expired", "active")).toThrow(
      /expired → active/,
    );
    expect(() => assertTransition("active", "expired")).not.toThrow();
  });

  it("never lists a status as a transition target of itself", () => {
    for (const s of ALL) expect(TRANSITIONS[s]).not.toContain(s);
  });

  it("only marks pre-cancellation states as active-like", () => {
    expect(ACTIVE_LIKE).toEqual([
      "trialing",
      "active",
      "past_due",
      "grace_period",
    ]);
    expect(ACTIVE_LIKE).not.toContain("cancelled");
    expect(ACTIVE_LIKE).not.toContain("expired");
    expect(ACTIVE_LIKE).not.toContain("suspended");
  });
});

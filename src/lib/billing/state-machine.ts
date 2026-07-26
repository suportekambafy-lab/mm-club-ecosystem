import type { SubscriptionStatus } from "./types";

/** Allowed transitions. A state change outside this table is a bug. */
export const TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trialing: ["active", "cancelled", "expired", "past_due"],
  active: ["past_due", "cancelled", "expired", "suspended"],
  past_due: ["active", "grace_period", "cancelled", "suspended"],
  grace_period: ["active", "suspended", "cancelled"],
  suspended: ["active", "cancelled", "expired"],
  cancelled: ["expired"],
  expired: [],
};

export function canTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): boolean {
  if (from === to) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid subscription transition: ${from} → ${to}`);
  }
}

/** A status grants nothing by itself — Entitlements decides. This is only for UI copy. */
export const ACTIVE_LIKE: SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "grace_period",
];

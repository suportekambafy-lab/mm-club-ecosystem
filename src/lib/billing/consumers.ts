/**
 * Which async consumers react to which domain event.
 * Adding a consumer here never requires touching the Billing Engine.
 */
import type { DomainEventType } from "./events.server";

export const CONSUMERS = [
  "entitlements",
  "credits",
  "timeline",
  "email",
  "notifications",
] as const;

export type ConsumerName = (typeof CONSUMERS)[number];

export const CONSUMERS_BY_EVENT: Record<DomainEventType, ConsumerName[]> = {
  SubscriptionCreated: ["timeline"],
  SubscriptionActivated: ["entitlements", "timeline", "email", "notifications"],
  SubscriptionUpgraded: ["entitlements", "timeline", "email"],
  SubscriptionDowngraded: ["entitlements", "timeline", "email"],
  SubscriptionSuspended: ["entitlements", "timeline", "email"],
  SubscriptionCancelled: ["timeline", "email"],
  SubscriptionExpired: ["entitlements", "timeline", "email"],
  SubscriptionResumed: ["entitlements", "timeline"],
  TrialStarted: ["entitlements", "timeline"],
  TrialEnded: ["timeline", "email"],
  PaymentSucceeded: ["timeline"],
  PaymentFailed: ["timeline", "email"],
  PaymentRefunded: ["entitlements", "timeline", "email"],
  PaymentRecovered: ["entitlements", "timeline", "email"],
  InvoiceIssued: ["timeline", "email"],
  LedgerEntryRecorded: [],
  DunningEscalated: ["timeline", "email"],
  ProductPurchased: ["entitlements", "credits", "timeline", "email"],
};

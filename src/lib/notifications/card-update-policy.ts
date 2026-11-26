/** Card-update requests are disabled; billing and access are independent. */
const CARD_UPDATE_EMAILS = new Set([
  "payment_method_update",
  "winback",
  "billing.card_expired",
  "billing.payment_failed",
  "recovery.card_expired",
  "recovery.grace_period",
  "recovery.last_warning",
  "recovery.suspended",
]);

export function isCardUpdateEmailDisabled(key: string): boolean {
  return CARD_UPDATE_EMAILS.has(key);
}
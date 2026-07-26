/**
 * Builds the description shown on the gateway checkout page (Mollie).
 * For trial prices it must be explicit that the charge is only a card
 * validation and state when/how much the first real charge will be.
 */

type DescPrice = {
  amountCents: number;
  currency: string;
  interval: string;
  intervalCount: number;
  trialDays: number;
  displayLabel?: string | null;
  product: { name: string };
};

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currency?.toUpperCase() || "EUR",
  }).format(cents / 100);
}

function dateLabel(d: Date): string {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function addInterval(from: Date, interval: string, count: number): Date {
  const d = new Date(from);
  const n = Math.max(1, count || 1);
  if (interval === "year") d.setFullYear(d.getFullYear() + n);
  else if (interval === "month") d.setMonth(d.getMonth() + n);
  else if (interval === "week") d.setDate(d.getDate() + 7 * n);
  else if (interval === "day") d.setDate(d.getDate() + n);
  return d;
}

export function buildCheckoutDescription(price: DescPrice, now = new Date()): string {
  const plan = price.displayLabel?.trim() || price.product.name;
  const amount = money(price.amountCents, price.currency);

  if (price.trialDays > 0) {
    const renews = new Date(now);
    renews.setDate(renews.getDate() + price.trialDays);
    return `${plan} — Validação do cartão (${money(1, price.currency)}). Renova a ${dateLabel(renews)} por ${amount}.`;
  }

  const recurring = price.interval !== "one_time" && price.interval !== "lifetime";
  if (!recurring) return `${plan} — ${amount}`;

  const next = addInterval(now, price.interval, price.intervalCount);
  return `${plan} — ${amount}. Renova a ${dateLabel(next)} por ${amount}.`;
}

/**
 * Dívida em aberto de um membro suspenso.
 *
 * Não apagamos nem escondemos o plano de quem não pagou: o plano continua a
 * existir, mas fica suspenso. A dívida é contada por ciclos de 30 dias desde o
 * fim do último período pago — cada 30 dias sem pagamento soma outra
 * mensalidade, exactamente como uma conta em atraso.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CYCLE_DAYS = 30;
const DAY_MS = 86_400_000;

export type OutstandingBalance = {
  /** Estado real da subscrição (suspended, grace_period, past_due, ...). */
  status: string | null;
  /** Ciclos de 30 dias já vencidos e não pagos (mínimo 1 quando há dívida). */
  cycles: number;
  amountCents: number;
  currency: string;
  /** Valor de cada ciclo (mensalidade equivalente do plano). */
  cycleAmountCents: number;
  /** Desde quando está em falta. */
  dueSince: string | null;
  /** Quando a dívida sobe outra vez, se não pagar. */
  nextIncreaseAt: string | null;
  /** Plano a pagar para regularizar. */
  priceSlug: string | null;
  planName: string | null;
  /** Faturas emitidas e ainda não pagas (raro, mas mostramos se existirem). */
  unpaidInvoices: {
    id: string;
    number: string | null;
    totalCents: number;
    currency: string;
    issuedAt: string | null;
  }[];
};

const EMPTY: OutstandingBalance = {
  status: null,
  cycles: 0,
  amountCents: 0,
  currency: "EUR",
  cycleAmountCents: 0,
  dueSince: null,
  nextIncreaseAt: null,
  priceSlug: null,
  planName: null,
  unpaidInvoices: [],
};

export async function getOutstanding(
  userId: string,
): Promise<OutstandingBalance> {
  const { data: sub } = await supabaseAdmin
    .from("billing_subscriptions")
    .select(
      "status, current_period_end, price:catalog_prices!billing_subscriptions_price_id_fkey(slug, amount_cents, currency, interval, interval_count), product:catalog_products(name)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return EMPTY;

  const status = sub.status as string;
  const price = sub.price as
    | {
        slug: string;
        amount_cents: number;
        currency: string;
        interval: string;
        interval_count: number | null;
      }
    | null;

  const { data: invoices } = await supabaseAdmin
    .from("billing_invoices")
    .select("id, number, total_cents, currency, issued_at, status")
    .eq("user_id", userId)
    .in("status", ["issued", "draft", "uncollectible"])
    .order("issued_at", { ascending: false })
    .limit(12);

  const unpaidInvoices = (invoices ?? []).map((i) => ({
    id: i.id as string,
    number: (i.number as string | null) ?? null,
    totalCents: (i.total_cents as number) ?? 0,
    currency: (i.currency as string) ?? "EUR",
    issuedAt: (i.issued_at as string | null) ?? null,
  }));

  const inDebt = ["past_due", "grace_period", "suspended", "expired"].includes(
    status,
  );
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end as string)
    : null;

  if (!inDebt || !periodEnd || !price) {
    return {
      ...EMPTY,
      status,
      currency: price?.currency ?? "EUR",
      priceSlug: price?.slug ?? null,
      planName: (sub.product as { name?: string } | null)?.name ?? null,
      unpaidInvoices,
    };
  }

  // Mensalidade equivalente: um plano semestral/anual em atraso conta por mês.
  const months =
    (price.interval === "year" ? 12 : price.interval === "month" ? 1 : 1) *
    (price.interval_count || 1);
  const cycleAmountCents = Math.round(price.amount_cents / Math.max(months, 1));

  const elapsedDays = (Date.now() - periodEnd.getTime()) / DAY_MS;
  const cycles = Math.max(1, Math.floor(elapsedDays / CYCLE_DAYS) + 1);
  const nextIncreaseAt = new Date(
    periodEnd.getTime() + cycles * CYCLE_DAYS * DAY_MS,
  ).toISOString();

  return {
    status,
    cycles,
    amountCents: cycleAmountCents * cycles,
    currency: price.currency,
    cycleAmountCents,
    dueSince: periodEnd.toISOString(),
    nextIncreaseAt,
    priceSlug: price.slug,
    planName: (sub.product as { name?: string } | null)?.name ?? null,
    unpaidInvoices,
  };
}

export type MmpayRevenuePayment = {
  id: string; link_id: string; email: string | null; name: string | null;
  status: string; amount_cents: number; currency: string;
  payment_method: string | null; paid_at: string | null; created_at: string;
};

/** Only settled euros enter the euro dashboard; the first recurring cycle is already a payment. */
export function mmpayRevenueRows(
  payments: MmpayRevenuePayment[],
  charges: { id: string; subscription_id: string; cycle_number: number; status: string; amount_cents: number; finished_at: string | null; created_at: string }[],
  subscriptions: { id: string; customer_email: string; customer_name: string | null; product_title: string; currency: string }[],
  links: { id: string; title: string }[],
) {
  const titles = new Map(links.map(l => [l.id, l.title]));
  const subs = new Map(subscriptions.map(s => [s.id, s]));
  const rows = payments.filter(p => p.status === 'paid' && p.paid_at && p.currency.toUpperCase() === 'EUR').map(p => ({
    id: `mmpay:${p.id}`, paymentId: p.id, user_id: `mmpay:${p.email?.trim().toLowerCase() ?? p.id}`,
    subscription_id: null, price_id: null, status: 'paid', amount_cents: p.amount_cents,
    refunded_cents: 0, currency: p.currency, method: p.payment_method,
    paid_at: p.paid_at, created_at: p.created_at, product_title: titles.get(p.link_id) ?? 'Produto MMpay',
    buyer_name: p.name, buyer_email: p.email,
  }));
  for (const c of charges) {
    const s = subs.get(c.subscription_id);
    if (!s || c.cycle_number <= 1 || c.status !== 'paid' || !c.finished_at || s.currency.toUpperCase() !== 'EUR') continue;
    rows.push({ id: `mmpay-charge:${c.id}`, paymentId: '', user_id: `mmpay:${s.customer_email.trim().toLowerCase()}`,
      subscription_id: null, price_id: null, status: 'paid', amount_cents: c.amount_cents, refunded_cents: 0,
      currency: s.currency, method: 'card', paid_at: c.finished_at, created_at: c.created_at,
      product_title: s.product_title, buyer_name: s.customer_name, buyer_email: s.customer_email });
  }
  return rows;
}
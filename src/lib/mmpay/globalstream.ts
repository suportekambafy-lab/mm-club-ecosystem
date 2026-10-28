export function globalstreamSalePayload(input: {
  id: string; amount_cents: number; currency: string; paid_at: string;
  email: string | null; name: string | null; product_title: string;
  sale_type: string; payment_method: string | null;
}) {
  return {
    event: "purchase", event_id: `mmpay:${input.id}`, source: "mmpay",
    order_id: input.id, email: input.email, name: input.name,
    amount: input.amount_cents / 100, amount_cents: input.amount_cents,
    currency: input.currency.toUpperCase(), product: input.product_title,
    sale_type: input.sale_type, payment_method: input.payment_method,
    paid_at: input.paid_at,
  };
}
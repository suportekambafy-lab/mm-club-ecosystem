export function globalstreamSalePayload(input: {
  id: string; amount_cents: number; currency: string;
  email: string | null; name: string | null; product_title: string;
  phone: string | null; product_id: string;
}) {
  return {
    id: input.id, email: input.email, name: input.name, phone: input.phone,
    amount: input.amount_cents / 100,
    currency: input.currency.toUpperCase(), product: input.product_title,
    product_id: input.product_id, status: "approved" as const,
  };
}
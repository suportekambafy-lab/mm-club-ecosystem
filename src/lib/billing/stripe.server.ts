/**
 * Cliente mínimo da API Stripe (fetch + form-encoding) — compatível com Workers.
 * Usa a chave da conta Stripe própria do MM Club (STRIPE_SECRET_KEY).
 */
type Params = Record<string, string | number | boolean | null | undefined | Params | Array<string | Params>>;

function encode(params: Params, prefix = "", out: string[] = []): string[] {
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object") encode(item, `${key}[${i}]`, out);
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof v === "object") encode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export async function stripeRequest<T = any>(
  method: "GET" | "POST",
  path: string,
  params?: Params,
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe não está configurada.");
  const body = params ? encode(params).join("&") : undefined;
  const url = method === "GET" && body ? `https://api.stripe.com/v1${path}?${body}` : `https://api.stripe.com/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2025-08-27.basil",
    },
    body: method === "POST" ? body : undefined,
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe ${res.status}`);
  return json as T;
}

export async function createStripeProduct(input: {
  name: string;
  description: string | null;
  imageUrl: string | null;
  amountCents: number;
  linkId: string;
}): Promise<{ productId: string; priceId: string }> {
  const product = await stripeRequest<{ id: string; default_price: string }>("POST", "/products", {
    name: input.name,
    description: input.description || undefined,
    images: input.imageUrl ? [input.imageUrl] : undefined,
    metadata: { mmpay_link_id: input.linkId },
    default_price_data: { currency: "eur", unit_amount: input.amountCents },
  });
  return { productId: product.id, priceId: product.default_price };
}

/** Cartão (inclui Apple Pay e Google Pay automaticamente) + MB WAY. */
export const MMPAY_PAYMENT_METHODS = ["card", "mb_way"];

export async function createStripeCheckout(input: {
  priceId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<{ id: string; url: string }> {
  const base = {
    mode: "payment",
    line_items: [{ price: input.priceId, quantity: "1" }],
    customer_email: input.email,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    locale: "pt",
    metadata: input.metadata,
    payment_intent_data: { metadata: input.metadata },
  } as Params;
  try {
    return await stripeRequest("POST", "/checkout/sessions", {
      ...base,
      payment_method_types: MMPAY_PAYMENT_METHODS,
    });
  } catch (err) {
    // MB WAY ainda não ativo na conta → segue só com cartão/carteiras.
    console.warn("[mmpay] MB WAY indisponível, a usar só cartão:", err);
    return await stripeRequest("POST", "/checkout/sessions", { ...base, payment_method_types: ["card"] });
  }
}

export async function getStripeCheckout(id: string) {
  return stripeRequest<{
    id: string;
    payment_status: string;
    amount_total: number | null;
    currency: string | null;
    metadata: Record<string, string> | null;
    customer_details: { email: string | null; name: string | null } | null;
    payment_intent: { payment_method?: { type?: string } | null } | string | null;
  }>("GET", `/checkout/sessions/${id}`, { expand: ["payment_intent.payment_method"] });
}

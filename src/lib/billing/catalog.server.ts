import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { CatalogEntry, CatalogPrice, CatalogProduct } from "./types";

type PriceRow = {
  id: string;
  product_id: string;
  slug: string;
  version: number;
  amount_cents: number;
  currency: string;
  interval: string;
  interval_count: number;
  trial_days: number;
  grants_credits: number;
  display_label: string | null;
};

function toPrice(r: PriceRow): CatalogPrice {
  return {
    id: r.id,
    productId: r.product_id,
    slug: r.slug,
    version: r.version,
    amountCents: r.amount_cents,
    currency: r.currency,
    interval: r.interval as CatalogPrice["interval"],
    intervalCount: r.interval_count,
    trialDays: r.trial_days,
    grantsCredits: r.grants_credits,
    displayLabel: r.display_label,
  };
}

export async function listCatalog(
  kinds?: CatalogProduct["kind"][],
): Promise<CatalogEntry[]> {
  let productQuery = supabaseAdmin
    .from("catalog_products")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (kinds && kinds.length > 0) productQuery = productQuery.in("kind", kinds);

  const { data: products, error } = await productQuery;
  if (error) throw new Error(error.message);

  const { data: prices } = await supabaseAdmin
    .from("catalog_prices")
    .select("*")
    .eq("active", true)
    .order("amount_cents");

  return (products ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    kind: p.kind as CatalogProduct["kind"],
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    imageUrl: p.image_url,
    sortOrder: p.sort_order,
    metadata: (p.metadata ?? {}) as Record<string, unknown>,
    prices: ((prices ?? []) as PriceRow[])
      .filter((pr) => pr.product_id === p.id)
      .map(toPrice),
  }));
}

export type PriceWithProduct = CatalogPrice & {
  product: {
    id: string;
    slug: string;
    name: string;
    kind: CatalogProduct["kind"];
  };
};

export async function getPriceBySlug(
  slug: string,
): Promise<PriceWithProduct | null> {
  const { data } = await supabaseAdmin
    .from("catalog_prices")
    .select("*, product:catalog_products(id, slug, name, kind)")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as PriceRow & {
    product: { id: string; slug: string; name: string; kind: string };
  };
  return {
    ...toPrice(row),
    product: {
      id: row.product.id,
      slug: row.product.slug,
      name: row.product.name,
      kind: row.product.kind as CatalogProduct["kind"],
    },
  };
}

export async function getPriceById(
  id: string,
): Promise<PriceWithProduct | null> {
  const { data } = await supabaseAdmin
    .from("catalog_prices")
    .select("*, product:catalog_products(id, slug, name, kind)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as PriceRow & {
    product: { id: string; slug: string; name: string; kind: string };
  };
  return {
    ...toPrice(row),
    product: {
      id: row.product.id,
      slug: row.product.slug,
      name: row.product.name,
      kind: row.product.kind as CatalogProduct["kind"],
    },
  };
}

export async function listProductFeatures(
  productId: string,
): Promise<{ featureKey: string; quota: number | null }[]> {
  const { data } = await supabaseAdmin
    .from("catalog_product_features")
    .select("feature_key, quota")
    .eq("product_id", productId);
  return (data ?? []).map((r) => ({
    featureKey: r.feature_key,
    quota: r.quota,
  }));
}

/** Human interval string for gateways that take one ("1 month", "12 months"). */
export function gatewayInterval(price: CatalogPrice): string {
  const unit = price.interval === "year" ? "months" : `${price.interval}s`;
  const count = price.interval === "year" ? 12 * price.intervalCount : price.intervalCount;
  return `${count} ${unit}`;
}

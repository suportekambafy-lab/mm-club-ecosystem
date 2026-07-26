/**
 * Entitlements — decides ACCESS. Completely independent of Billing.
 * Billing emits events; this domain grants and revokes.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { EntitlementSource } from "@/lib/billing/types";

export type GrantInput = {
  userId: string;
  featureKey: string;
  source: EntitlementSource;
  sourceId?: string | null;
  quota?: number | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

export async function grantFeature(input: GrantInput): Promise<void> {
  // The uniqueness index on entitlement_grants uses COALESCE(source_id, ...),
  // an expression index PostgREST cannot target with ON CONFLICT — so we do an
  // explicit find-then-update/insert instead of upsert.
  const row = {
    user_id: input.userId,
    feature_key: input.featureKey,
    source: input.source,
    source_id: input.sourceId ?? null,
    quota: input.quota ?? null,
    expires_at: input.expiresAt ?? null,
    revoked_at: null,
    metadata: (input.metadata ?? {}) as never,
  };

  let existing = supabaseAdmin
    .from("entitlement_grants")
    .select("id")
    .eq("user_id", input.userId)
    .eq("feature_key", input.featureKey)
    .eq("source", input.source);
  existing = input.sourceId
    ? existing.eq("source_id", input.sourceId)
    : existing.is("source_id", null);

  const { data: found } = await existing.maybeSingle();

  if (found?.id) {
    const { error } = await supabaseAdmin
      .from("entitlement_grants")
      .update(row)
      .eq("id", found.id);
    if (error) throw new Error(`grantFeature failed: ${error.message}`);
    return;
  }

  const { error } = await supabaseAdmin.from("entitlement_grants").insert(row);
  // 23505 = concurrent insert won the race; the row exists, which is the goal.
  if (error && error.code !== "23505") {
    throw new Error(`grantFeature failed: ${error.message}`);
  }
}


export async function grantProductFeatures(input: {
  userId: string;
  productId: string;
  source: EntitlementSource;
  sourceId?: string | null;
  expiresAt?: string | null;
}): Promise<void> {
  const { data } = await supabaseAdmin
    .from("catalog_product_features")
    .select("feature_key, quota")
    .eq("product_id", input.productId);

  for (const f of data ?? []) {
    await grantFeature({
      userId: input.userId,
      featureKey: f.feature_key,
      source: input.source,
      sourceId: input.sourceId ?? null,
      quota: f.quota,
      expiresAt: input.expiresAt ?? null,
    });
  }
}

export async function revokeBySource(input: {
  userId: string;
  source: EntitlementSource;
  sourceId: string;
}): Promise<void> {
  await supabaseAdmin
    .from("entitlement_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("source", input.source)
    .eq("source_id", input.sourceId)
    .is("revoked_at", null);
}

export async function resolveFeatures(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.rpc("resolve_entitlements", {
    _user_id: userId,
  });
  return (data ?? []).map((r) => r.feature_key);
}

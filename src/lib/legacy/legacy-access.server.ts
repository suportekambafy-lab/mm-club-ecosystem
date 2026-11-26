import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { LEGACY_ACCESS_EXPIRES_AT, LEGACY_ACCESS_SOURCE_ID, LEGACY_STUDENTS } from "./legacy-students.server";

export function legacyStudentName(email: string): string | null {
  const key = email.trim().toLowerCase();
  return key in LEGACY_STUDENTS ? (LEGACY_STUDENTS[key] ?? "") : null;
}

/** Idempotent: 3-month club grant for an external Legacy buyer (fixed end date). */
export async function grantLegacyAccess(db: SupabaseClient<Database>, userId: string) {
  const { data: feats, error } = await db
    .from("catalog_product_features")
    .select("feature_key, quota, product:catalog_products!inner(kind, id)")
    .eq("product.kind", "subscription");
  if (error) throw error;
  const keys = new Map<string, number | null>();
  for (const f of feats ?? []) keys.set(f.feature_key, Math.max(keys.get(f.feature_key) ?? 0, f.quota ?? 0) || null);
  if (!keys.has("academy.access")) keys.set("academy.access", null);
  const { data: existing } = await db.from("entitlement_grants").select("feature_key").eq("user_id", userId).eq("source_id", LEGACY_ACCESS_SOURCE_ID);
  const have = new Set((existing ?? []).map(g => g.feature_key));
  const rows = [...keys].filter(([k]) => !have.has(k)).map(([feature_key, quota]) => ({
    user_id: userId, feature_key, quota, source: "manual" as const, source_id: LEGACY_ACCESS_SOURCE_ID,
    expires_at: LEGACY_ACCESS_EXPIRES_AT, metadata: { origin: "legacy_import", reason: "Comprador externo Marca Milionária Legacy — 3 meses" },
  }));
  if (rows.length) { const r = await db.from("entitlement_grants").insert(rows); if (r.error && r.error.code !== "23505") throw r.error; }
}

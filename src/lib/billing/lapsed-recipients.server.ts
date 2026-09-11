// Server-only: quem está com conta suspensa / em dívida (sem acesso às aulas).
// Usado nos envios em massa para trocar o email pela versão "regulariza pagamento".
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LAPSED_STATUSES = ["suspended", "expired", "cancelled", "past_due"] as const;

/**
 * IDs de membros que devem receber a versão bloqueada dos emails:
 * subscrição em estado suspenso/expirado/cancelado/atrasado E sem grant
 * válido de `academy.access`. Trial e grace_period ficam de fora.
 *
 * Uma leitura por difusão (não por destinatário).
 */
export async function lapsedUserIds(): Promise<Set<string>> {
  const lapsed = new Set<string>();

  const { data: subs, error } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("user_id,status")
    .in("status", LAPSED_STATUSES as unknown as string[]);
  if (error) {
    console.error("[lapsed-recipients] subs read failed", error.message);
    return lapsed;
  }
  for (const row of subs ?? []) {
    if (row.user_id) lapsed.add(row.user_id as string);
  }
  if (lapsed.size === 0) return lapsed;

  // Remove quem ainda tem acesso válido (ex.: outra subscrição activa, grant manual).
  const nowIso = new Date().toISOString();
  const { data: grants, error: grantErr } = await supabaseAdmin
    .from("entitlement_grants")
    .select("user_id,feature,expires_at,revoked_at")
    .eq("feature", "academy.access")
    .in("user_id", Array.from(lapsed));
  if (grantErr) {
    console.error("[lapsed-recipients] grants read failed", grantErr.message);
    return lapsed;
  }
  for (const g of grants ?? []) {
    const revoked = (g as { revoked_at?: string | null }).revoked_at;
    const expires = (g as { expires_at?: string | null }).expires_at;
    const stillValid = !revoked && (!expires || expires > nowIso);
    if (stillValid) lapsed.delete((g as { user_id: string }).user_id);
  }

  return lapsed;
}

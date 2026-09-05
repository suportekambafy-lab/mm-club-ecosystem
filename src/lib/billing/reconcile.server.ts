/**
 * Reconciliação de subscrições com o gateway (Mollie).
 *
 * Problema real que isto resolve: uma subscrição pode ficar `active` na nossa
 * base com `current_period_end` no passado (por exemplo quando o membro
 * refez o mandato e o Mollie criou uma NOVA subscrição, deixando a antiga
 * cancelada). As grants de acesso expiram e o membro — com pagamento em
 * ordem — é atirado para /planos.
 *
 * Esta rotina compara cada subscrição ativa/em trial já fora de período com o
 * que o Mollie diz e, quando existe uma subscrição ativa no gateway, adota o
 * id real, avança o período e volta a conceder os acessos.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { grantProductFeatures } from "@/lib/entitlements/grants.server";

type MollieSubscription = {
  id: string;
  status: string;
  nextPaymentDate?: string | null;
  createdAt?: string | null;
};

async function listMollieSubscriptions(
  customerId: string,
): Promise<MollieSubscription[]> {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) throw new Error("MOLLIE_API_KEY is not configured");
  const res = await fetch(
    `https://api.mollie.com/v2/customers/${encodeURIComponent(customerId)}/subscriptions?limit=50`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mollie subscriptions failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as {
    _embedded?: { subscriptions?: MollieSubscription[] };
  };
  return json._embedded?.subscriptions ?? [];
}

export type ReconcileResult = {
  checked: number;
  repaired: number;
  lapsed: number;
  details: Array<{ subscriptionId: string; adopted: string; periodEnd: string }>;
};

/** Dias de tolerância antes de assumir que a subscrição caiu de facto. */
const LAPSE_GRACE_DAYS = 2;

export async function reconcileLapsedSubscriptions(
  limit = 25,
): Promise<ReconcileResult> {
  const nowIso = new Date().toISOString();
  const { data: rows } = await supabaseAdmin
    .from("billing_subscriptions")
    .select(
      "id, user_id, product_id, price_id, status, gateway, gateway_subscription_id, current_period_end, customer_id",
    )
    .in("status", ["active", "trialing"])
    .lt("current_period_end", nowIso)
    .limit(limit);

  const result: ReconcileResult = {
    checked: 0,
    repaired: 0,
    lapsed: 0,
    details: [],
  };
  if (!rows?.length) return result;

  for (const row of rows) {
    if (row.gateway !== "mollie" || !row.customer_id) continue;
    result.checked += 1;

    try {
      const { data: customer } = await supabaseAdmin
        .from("billing_customers")
        .select("gateway_customer_id")
        .eq("id", row.customer_id)
        .maybeSingle();
      const gatewayCustomerId = customer?.gateway_customer_id;
      if (!gatewayCustomerId) continue;

      const subs = await listMollieSubscriptions(gatewayCustomerId);
      const active = subs
        .filter((s) => s.status === "active" || s.status === "pending")
        .sort((a, b) =>
          String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
        )[0];
      if (!active) {
        // O gateway confirma que já não existe subscrição a pagar: a conta
        // não pode ficar "ativa" sem acesso — entra na recuperação (que trata
        // avisos, retentativas, grace period e suspensão pelo calendário).
        const endedAt = row.current_period_end
          ? new Date(row.current_period_end).getTime()
          : 0;
        const graceOver =
          endedAt > 0 &&
          Date.now() - endedAt > LAPSE_GRACE_DAYS * 86400000;
        if (!graceOver) continue;

        const { data: price } = await supabaseAdmin
          .from("catalog_prices")
          .select("amount_cents, currency")
          .eq("id", row.price_id)
          .maybeSingle();

        await supabaseAdmin
          .from("billing_subscriptions")
          .update({ status: "past_due" })
          .eq("id", row.id)
          .in("status", ["active", "trialing"]);

        const { startRecovery } = await import(
          "@/lib/billing/recovery/engine.server"
        );
        await startRecovery({
          subscriptionId: row.id,
          userId: row.user_id,
          amountCents: price?.amount_cents ?? 0,
          currency: price?.currency ?? "EUR",
          failureReason: "subscription_missing_at_gateway",
          gatewayPaymentId: `lapsed:${row.id}:${row.current_period_end ?? ""}`,
        });

        result.lapsed += 1;
        continue;
      }


      const next = active.nextPaymentDate
        ? new Date(`${active.nextPaymentDate}T00:00:00Z`)
        : null;
      if (!next || Number.isNaN(next.getTime())) continue;

      await supabaseAdmin
        .from("billing_subscriptions")
        .update({
          gateway_subscription_id: active.id,
          current_period_end: next.toISOString(),
          status: "active",
        })
        .eq("id", row.id);

      await grantProductFeatures({
        userId: row.user_id,
        productId: row.product_id,
        source: "subscription",
        sourceId: row.id,
        expiresAt: new Date(next.getTime() + 3 * 86400000).toISOString(),
      });

      result.repaired += 1;
      result.details.push({
        subscriptionId: row.id,
        adopted: active.id,
        periodEnd: next.toISOString(),
      });
    } catch (err) {
      console.error("[reconcile] failed", row.id, err);
    }
  }

  return result;
}

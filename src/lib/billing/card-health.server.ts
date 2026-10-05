/**
 * Cartão em arquivo — garantia de que todo o membro com plano tem um método
 * de pagamento reutilizável guardado.
 *
 * O gateway pode revogar um mandato a qualquer momento (cartão expirado,
 * substituído pelo banco, contestação). Quando isso acontece a cobrança
 * automática deixa de ser possível, por isso:
 *  1. re-sincronizamos os mandatos do gateway;
 *  2. se não sobrar nenhum válido, avisamos o membro para guardar um cartão
 *     novo (email + notificação), com cooldown para não insistir todos os dias;
 *  3. registamos o estado para o admin ver quem está sem cartão.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyMember } from "@/lib/notifications/dispatch.server";
import { syncPaymentMethods } from "./payment-methods.server";

const HOUR = 3_600_000;
/** Não pedimos cartão novo mais de uma vez a cada 3 dias. */
const NUDGE_COOLDOWN_HOURS = 72;

/** Estados em que a cobrança automática tem de funcionar. */
const BILLABLE_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "grace_period",
  "suspended",
] as const;

export type CardHealth = {
  userId: string;
  hasCard: boolean;
  nudged: boolean;
};

async function nudgedRecently(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - NUDGE_COOLDOWN_HOURS * HOUR).toISOString();
  const { data } = await supabaseAdmin
    .from("notification_log")
    .select("id")
    .eq("user_id", userId)
    .eq("template_key", "recovery.card_expired")
    .gte("created_at", since)
    .limit(1);
  return (data ?? []).length > 0;
}

/**
 * Confirma se o membro tem cartão guardado utilizável. Quando não tem,
 * pede-lhe um cartão novo (respeitando o cooldown).
 */
export async function ensureCardOnFile(userId: string): Promise<CardHealth> {
  await syncPaymentMethods(userId).catch((err) =>
    console.error("[card-health] sync", userId, err),
  );

  const { data: methods } = await supabaseAdmin
    .from("billing_payment_methods")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["active", "pending"])
    .limit(1);

  const hasCard = (methods ?? []).length > 0;
  if (hasCard) return { userId, hasCard: true, nudged: false };

  if (await nudgedRecently(userId)) {
    return { userId, hasCard: false, nudged: false };
  }

  try {
    const res = await notifyMember("recovery.card_expired", userId);
    return { userId, hasCard: false, nudged: Boolean(res.sent) };
  } catch (err) {
    console.error("[card-health] nudge", userId, err);
    return { userId, hasCard: false, nudged: false };
  }
}

/**
 * Varre todos os membros com plano e garante o cartão em arquivo.
 * Chamado pelo tick de faturação — é aqui que se apanha um cartão revogado
 * antes de a renovação falhar.
 */
export async function sweepCardOnFile(limit = 500, offset = 0): Promise<{
  checked: number;
  withoutCard: number;
  nudged: number;
  members: string[];
}> {
  const { data: subs } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("user_id, status")
    .in("status", [...BILLABLE_STATUSES])
    .order("user_id")
    .range(offset, offset + limit - 1);

  const userIds = Array.from(new Set((subs ?? []).map((s) => s.user_id as string)));
  let withoutCard = 0;
  let nudged = 0;
  const members: string[] = [];

  for (const userId of userIds) {
    const health = await ensureCardOnFile(userId);
    if (!health.hasCard) {
      withoutCard += 1;
      members.push(userId);
    }
    if (health.nudged) nudged += 1;
  }

  return { checked: userIds.length, withoutCard, nudged, members };
}

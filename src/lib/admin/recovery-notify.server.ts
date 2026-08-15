/**
 * Aviso manual aos membros com cobrança falhada: pede a atualização do método
 * de pagamento antes da suspensão. Escolhe o template pelo motivo da recusa.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyMember } from "@/lib/notifications/dispatch.server";

const HARD_DECLINE = new Set([
  "card_declined",
  "card_expired",
  "invalid_card_number",
  "invalid_card_type",
  "invalid_cvv",
  "card_not_supported",
  "authentication_failed",
  "inactive_card",
  "pending_customer_action",
]);

export type NotifyFailedResult = {
  notified: number;
  skipped: number;
  members: { userId: string; reason: string | null; template: string; sent: boolean }[];
};

export async function notifyFailedPaymentMembers(
  onlyUserId?: string,
): Promise<NotifyFailedResult> {
  let q = supabaseAdmin
    .from("billing_subscriptions")
    .select("id, user_id, status")
    .in("status", ["past_due", "grace_period", "suspended"]);
  if (onlyUserId) q = q.eq("user_id", onlyUserId);
  const { data: subs } = await q;

  const out: NotifyFailedResult = { notified: 0, skipped: 0, members: [] };

  for (const sub of subs ?? []) {
    const { data: payment } = await supabaseAdmin
      .from("billing_payments")
      .select("failure_reason, status")
      .eq("user_id", sub.user_id)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const reason = payment?.failure_reason ?? null;
    const template =
      reason && HARD_DECLINE.has(reason)
        ? "recovery.card_expired"
        : "recovery.grace_period";

    try {
      const res = await notifyMember(template, sub.user_id);
      if (res.sent) out.notified += 1;
      else out.skipped += 1;
      out.members.push({
        userId: sub.user_id,
        reason,
        template,
        sent: Boolean(res.sent),
      });
    } catch (err) {
      console.error("[recovery-notify]", sub.user_id, err);
      out.skipped += 1;
      out.members.push({ userId: sub.user_id, reason, template, sent: false });
    }
  }

  return out;
}

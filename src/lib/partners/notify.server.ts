/**
 * MM Partners — avisos ao membro: sino (in-app) + email.
 * Falhas aqui nunca quebram o fluxo principal (candidatura/decisão).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Kind = "partner_pending" | "partner_approved" | "partner_rejected";

async function bell(userId: string, kind: Kind): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .insert({ user_id: userId, kind });
  if (error) console.error("[mm-partners] bell failed", kind, error.message);
}

export async function notifyPartnerApplicationReceived(
  userId: string,
  accountId: string,
): Promise<void> {
  try {
    await bell(userId, "partner_pending");
    const { emailTemplates, getUserEmailAndName, sendEmail } = await import(
      "@/lib/email.server"
    );
    const who = await getUserEmailAndName(userId);
    if (!who) return;
    const tpl = emailTemplates.partnerApplicationReceived(who.name);
    await sendEmail({
      to: who.email,
      userId,
      kind: "partner_pending",
      ref: accountId,
      subject: tpl.subject,
      html: tpl.html,
    });
  } catch (err) {
    console.error("[mm-partners] notify received failed", err);
  }
}

export async function notifyPartnerDecision(input: {
  userId: string;
  accountId: string;
  code: string;
  decision: "active" | "rejected";
  note?: string | null;
}): Promise<void> {
  try {
    const approved = input.decision === "active";
    await bell(input.userId, approved ? "partner_approved" : "partner_rejected");
    const { emailTemplates, getUserEmailAndName, sendEmail } = await import(
      "@/lib/email.server"
    );
    const who = await getUserEmailAndName(input.userId);
    if (!who) return;
    const tpl = approved
      ? emailTemplates.partnerApproved(who.name, input.code)
      : emailTemplates.partnerRejected(who.name, input.note ?? null);
    await sendEmail({
      to: who.email,
      userId: input.userId,
      kind: approved ? "partner_approved" : "partner_rejected",
      ref: `${input.accountId}:${input.decision}`,
      subject: tpl.subject,
      html: tpl.html,
    });
  } catch (err) {
    console.error("[mm-partners] notify decision failed", err);
  }
}

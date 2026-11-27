import { supabaseAdmin as db } from "@/integrations/supabase/client.server";

export async function sendCallConfirmation(lead: { id: string; nome: string | null; responsavel_id: string | null; call_scheduled_at: string | null }) {
  if (!lead.responsavel_id || !lead.call_scheduled_at) return;
  try {
    const [{ data: userRes }, { data: profile }] = await Promise.all([
      db.auth.admin.getUserById(lead.responsavel_id),
      db.from("profiles").select("display_name").eq("id", lead.responsavel_id).maybeSingle(),
    ]);
    const email = userRes?.user?.email;
    if (!email) return;
    const whenLabel = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(lead.call_scheduled_at));
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail("call-reminder", email, {
      templateData: { closerName: profile?.display_name ?? "Equipa", leadName: lead.nome ?? "o contacto", whenLabel: `${whenLabel} (Lisboa)`, kind: "confirm" },
      idempotencyKey: `call-reminder-confirm-${lead.id}-${lead.call_scheduled_at}`,
    });
  } catch {
    console.error("[call-confirmation] Delivery failed");
  }
}
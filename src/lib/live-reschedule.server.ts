/**
 * "Novo horário" — avisa todos os membros quando uma live agendada muda de hora.
 * Server-only. Email (dedupe por user+kind+ref) + notificação no sino (push
 * segue no drain já existente).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function notifyLiveRescheduled(args: {
  liveId: string;
  oldStartsAt: string;
  newStartsAt: string;
}): Promise<{ sent: number; skipped: number; failed: number }> {
  const { liveId, oldStartsAt, newStartsAt } = args;

  const { data: live } = await supabaseAdmin
    .from("lives")
    .select("id,title,description,starts_at,cover_url,is_test,status")
    .eq("id", liveId)
    .maybeSingle();
  // Lives de teste nunca notificam membros.
  if (!live || live.is_test) return { sent: 0, skipped: 0, failed: 0 };

  const { sendEmail, emailTemplates } = await import("@/lib/email.server");
  const { optedOutUserIds } = await import("@/lib/community-email.server");
  const optedOut = await optedOutUserIds("lives");

  // Só membros com subscrição activa ou em trial.
  const { data: subs } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("user_id,status")
    .in("status", ["active", "trialing"]);
  const allowed = new Set((subs ?? []).map((s) => s.user_id as string));
  if (allowed.size === 0) return { sent: 0, skipped: 0, failed: 0 };

  // Uma vez por (membro, live, novo horário).
  const ref = `${liveId}:${new Date(newStartsAt).toISOString()}`;

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let page = 1;

  for (let i = 0; i < 20; i++) {
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error || !list?.users?.length) break;

    for (const u of list.users) {
      if (!allowed.has(u.id)) continue;

      // Sino + push para todos os membros elegíveis.
      await supabaseAdmin
        .from("notifications")
        .insert({ user_id: u.id, kind: "live", live_id: liveId } as never)
        .then(({ error: e }) => {
          if (e) console.error("[live-reschedule] notif failed", u.id, e.message);
        });

      if (!u.email || !u.email_confirmed_at || optedOut.has(u.id)) {
        skipped += 1;
        continue;
      }
      const name =
        (u.user_metadata as { display_name?: string } | null)?.display_name ??
        u.email.split("@")[0] ??
        "amigo";
      const tpl = emailTemplates.liveRescheduled({
        name,
        title: (live.title as string) ?? "Live MM Club",
        description: (live.description as string | null) ?? null,
        oldStartsAt,
        startsAt: newStartsAt,
        coverUrl: (live.cover_url as string | null) ?? null,
        liveId,
      });
      try {
        const r = await sendEmail({
          to: u.email,
          subject: tpl.subject,
          html: tpl.html,
          userId: u.id,
          kind: "live_rescheduled",
          ref,
        });
        if (r.sent) sent += 1;
        else skipped += 1;
      } catch (e) {
        failed += 1;
        console.error("[live-reschedule] send failed", u.email, e);
      }
    }
    if (list.users.length < 100) break;
    page += 1;
  }

  console.log("[live-reschedule]", { liveId, sent, skipped, failed });
  return { sent, skipped, failed };
}

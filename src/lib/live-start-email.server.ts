/**
 * "Estamos AO VIVO" — email blast quando o host entra em direto.
 * Server-only. Dedupe por (user_id, kind, ref) no email_log.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, emailTemplates, getUserEmailAndName } from "@/lib/email.server";
import { optedOutUserIds } from "@/lib/community-email.server";


const MAX_BATCH = 500;

export async function sendLiveStartEmails(liveId: string) {
  const { data: live } = await supabaseAdmin
    .from("lives")
    .select("id, title, description, starts_at, went_live_at, cover_url, is_test")
    .eq("id", liveId)
    .maybeSingle();
  // Test lives never email members.
  if (!live || live.is_test) return { sent: 0, skipped: 0, failed: 0 };

  const { data: subs, error } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("user_id, status")
    .in("status", ["trialing", "active"])
    .limit(MAX_BATCH);
  if (error) {
    console.error("[live-start-email] subs failed", error);
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const userIds = Array.from(new Set((subs ?? []).map((s) => s.user_id as string)));
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const optedOut = await optedOutUserIds("lives");

  for (const userId of userIds) {
    if (optedOut.has(userId)) {
      skipped += 1;
      continue;
    }
    const user = await getUserEmailAndName(userId);
    if (!user) {
      skipped += 1;
      continue;
    }
    const tpl = emailTemplates.liveAnnouncement({
      name: user.name,
      title: (live.title as string) ?? "Live MM Club",
      description: (live.description as string | null) ?? null,
      startsAt: (live.went_live_at as string | null) ?? (live.starts_at as string),
      coverUrl: (live.cover_url as string | null) ?? null,
      liveId,
      isScheduled: false,
    });
    try {
      const r = await sendEmail({
        to: user.email,
        subject: tpl.subject,
        html: tpl.html,
        userId,
        kind: "live_started",
        ref: liveId,
      });
      if (r.sent) sent += 1;
      else if (r.skipped) skipped += 1;
      else failed += 1;
    } catch (e) {
      failed += 1;
      console.error("[live-start-email] send failed", user.email, e);
    }
  }

  console.log("[live-start-email]", { liveId, sent, skipped, failed });
  return { sent, skipped, failed };
}

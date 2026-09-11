// Server-only: notify members once a live replay is actually available.
// Claim-then-send so concurrent callers (webhook + first viewer) never
// duplicate the fan-out.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function notifyReplayReady(liveId: string): Promise<{ sent: boolean }> {
  const { data: live } = await supabaseAdmin
    .from("lives")
    .select("id,title,description,starts_at,cover_url,replay_notified_at,recording_video_uid,is_test")
    .eq("id", liveId)
    .maybeSingle();

  // Test lives never notify members.
  if (!live || live.is_test || !live.recording_video_uid || live.replay_notified_at) return { sent: false };

  // Atomic claim: only the first caller flips the flag from NULL.
  const { data: claimed } = await supabaseAdmin
    .from("lives")
    .update({ replay_notified_at: new Date().toISOString() })
    .eq("id", liveId)
    .is("replay_notified_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { sent: false };

  try {
    const { sendEmail, emailTemplates } = await import("@/lib/email.server");

    // Only members with an active or trial subscription get the replay email.
    const { data: subs } = await supabaseAdmin
      .from("billing_subscriptions")
      .select("user_id, status")
      .in("status", [
        "active",
        "trialing",
        "grace_period",
        "past_due",
        "suspended",
        "expired",
        "cancelled",
      ]);
    const allowed = new Set((subs ?? []).map((s) => s.user_id as string));
    if (allowed.size === 0) return { sent: true };

    const { optedOutUserIds } = await import("@/lib/community-email.server");
    const optedOut = await optedOutUserIds("lives");
    const { lapsedUserIds } = await import("@/lib/billing/lapsed-recipients.server");
    const lapsed = await lapsedUserIds();

    let page = 1;
    for (let i = 0; i < 20; i++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
      if (error || !list?.users?.length) break;
      for (const u of list.users) {
        if (!u.email || !u.email_confirmed_at) continue;
        if (optedOut.has(u.id)) continue;
        if (!allowed.has(u.id)) continue;
        const name =
          (u.user_metadata as { display_name?: string } | null)?.display_name ??
          u.email.split("@")[0] ??
          "amigo";
        const tpl = emailTemplates.replayReady({
          name,
          title: live.title,
          description: live.description,
          startsAt: live.starts_at,
          coverUrl: live.cover_url,
          liveId: live.id,
          locked: lapsed.has(u.id),
        });
        await sendEmail({
          to: u.email,
          subject: tpl.subject,
          html: tpl.html,
          userId: u.id,
          kind: "replay_ready",
          ref: live.id,
        }).catch((e) => console.error("[replay-notify] email failed", u.email, e));
      }
      if (list.users.length < 100) break;
      page += 1;
    }

  } catch (e) {
    console.error("[replay-notify] dispatch failed", e);
  }

  return { sent: true };
}

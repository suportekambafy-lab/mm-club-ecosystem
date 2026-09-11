// Server-only: MM Shorts email notifications.
// Rules: fan-out only when the short's author is an admin; replies email only
// the owner of the parent comment. Honours each member's email preferences.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, emailTemplates } from "./email.server";
import { optedOutUserIds } from "./community-email.server";

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

/** Announce a new MM Short to all members — only if the author is an admin. */
export async function sendShortPublishedEmails(shortId: string) {
  const { data: short, error } = await supabaseAdmin
    .from("mm_shorts")
    .select("id,caption,thumbnail_url,author_id,created_at")
    .eq("id", shortId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!short) return { sent: 0, skipped: 0, reason: "not_found" as const };

  if (Date.now() - new Date(short.created_at).getTime() > 30 * 60 * 1000) {
    return { sent: 0, skipped: 0, reason: "too_old" as const };
  }
  if (!(await isAdmin(short.author_id))) {
    return { sent: 0, skipped: 0, reason: "not_admin" as const };
  }

  const { data: author } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", short.author_id)
    .maybeSingle();
  const authorName = author?.display_name ?? "MM Club";
  const optedOut = await optedOutUserIds("community_posts");
  const { lapsedUserIds } = await import("@/lib/billing/lapsed-recipients.server");
  const lapsed = await lapsedUserIds();

  let sent = 0;
  let skipped = 0;
  let page = 1;
  for (let i = 0; i < 20; i++) {
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (listErr || !list?.users?.length) break;
    for (const u of list.users) {
      if (!u.email || !u.email_confirmed_at) continue;
      if (u.id === short.author_id) continue;
      if (optedOut.has(u.id)) {
        skipped += 1;
        continue;
      }
      const name =
        ((u.user_metadata as { display_name?: string } | null)?.display_name) ??
        u.email.split("@")[0] ??
        "amigo";
      const tpl = emailTemplates.shortPublished({
        name,
        authorName,
        caption: short.caption,
        thumbnailUrl: short.thumbnail_url,
        shortId: short.id,
        locked: lapsed.has(u.id),
      });
      const res = await sendEmail({
        to: u.email,
        subject: tpl.subject,
        html: tpl.html,
        userId: u.id,
        kind: "short_published",
        ref: short.id,
      }).catch((e) => {
        console.error("[shorts-email] send failed", e);
        return { sent: false };
      });
      if (res.sent) sent += 1;
      else skipped += 1;
    }
    if (list.users.length < 100) break;
    page += 1;
  }
  return { sent, skipped, reason: "ok" as const };
}

/** Email the owner of the parent comment when someone replies to it. */
export async function sendShortReplyEmail(commentId: string) {
  const { data: reply, error } = await supabaseAdmin
    .from("mm_short_comments")
    .select("id,short_id,user_id,body,parent_id,created_at")
    .eq("id", commentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!reply?.parent_id) return { sent: 0, reason: "not_a_reply" as const };
  if (Date.now() - new Date(reply.created_at).getTime() > 30 * 60 * 1000) {
    return { sent: 0, reason: "too_old" as const };
  }

  const { data: parent } = await supabaseAdmin
    .from("mm_short_comments")
    .select("id,user_id,body")
    .eq("id", reply.parent_id)
    .maybeSingle();
  if (!parent || parent.user_id === reply.user_id) {
    return { sent: 0, reason: "self_or_missing" as const };
  }

  const optedOut = await optedOutUserIds("community_replies");
  if (optedOut.has(parent.user_id)) return { sent: 0, reason: "opted_out" as const };

  const [{ data: target }, { data: author }] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(parent.user_id),
    supabaseAdmin.from("profiles").select("display_name").eq("id", reply.user_id).maybeSingle(),
  ]);
  const email = target?.user?.email;
  if (!email || !target.user?.email_confirmed_at) return { sent: 0, reason: "no_email" as const };

  const name =
    ((target.user.user_metadata as { display_name?: string } | null)?.display_name) ??
    email.split("@")[0] ??
    "amigo";
  const tpl = emailTemplates.shortReply({
    name,
    authorName: author?.display_name ?? "Um membro",
    body: reply.body,
    yourComment: parent.body,
    shortId: reply.short_id,
  });
  const res = await sendEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    userId: parent.user_id,
    kind: "short_reply",
    ref: reply.id,
  }).catch((e) => {
    console.error("[shorts-email] reply send failed", e);
    return { sent: false };
  });
  return { sent: res.sent ? 1 : 0, reason: "ok" as const };
}

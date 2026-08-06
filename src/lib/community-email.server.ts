// Server-only: fan out "X publicou na comunidade" emails, honouring each
// member's email preferences. Do NOT import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, emailTemplates } from "./email.server";

export type EmailPrefColumn =
  | "community_posts"
  | "community_replies"
  | "community_mentions"
  | "lives"
  | "courses"
  | "weekly_summary";

/** Users who opted OUT of a given email category. Missing row = opted in. */
export async function optedOutUserIds(column: EmailPrefColumn): Promise<Set<string>> {
  const out = new Set<string>();
  const { data, error } = await supabaseAdmin
    .from("email_preferences")
    .select(`user_id,${column}`)
    .eq(column, false);
  if (error) {
    console.error("[community-email] prefs read failed", error.message);
    return out;
  }
  for (const row of data ?? []) out.add((row as { user_id: string }).user_id);
  return out;
}

export async function sendCommunityPostEmails(postId: string) {
  const { data: post, error } = await supabaseAdmin
    .from("community_posts")
    .select("id,content,image_url,author_id,category_id,created_at")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!post) return { sent: 0, skipped: 0 };

  // Only announce fresh posts (protects against replays / edits).
  if (Date.now() - new Date(post.created_at).getTime() > 30 * 60 * 1000) {
    return { sent: 0, skipped: 0 };
  }

  const [{ data: author }, { data: category }] = await Promise.all([
    supabaseAdmin.from("profiles").select("display_name").eq("id", post.author_id).maybeSingle(),
    post.category_id
      ? supabaseAdmin.from("community_categories").select("name").eq("id", post.category_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
  ]);

  const authorName = author?.display_name ?? "Um membro";
  const optedOut = await optedOutUserIds("community_posts");

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
      if (u.id === post.author_id) continue;
      if (optedOut.has(u.id)) {
        skipped += 1;
        continue;
      }
      const name =
        ((u.user_metadata as { display_name?: string } | null)?.display_name) ??
        u.email.split("@")[0] ??
        "amigo";
      const tpl = emailTemplates.communityPost({
        name,
        authorName,
        body: post.content ?? "",
        imageUrl: post.image_url,
        postId: post.id,
        categoryLabel: category?.name ?? null,
      });
      const res = await sendEmail({
        to: u.email,
        subject: tpl.subject,
        html: tpl.html,
        userId: u.id,
        kind: "community_post",
        ref: post.id,
      }).catch((e) => {
        console.error("[community-email] send failed", u.email, e);
        return { sent: false };
      });
      if (res.sent) sent += 1;
      else skipped += 1;
    }
    if (list.users.length < 100) break;
    page += 1;
  }

  return { sent, skipped };
}

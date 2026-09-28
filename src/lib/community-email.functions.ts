import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PREF_KEYS = [
  "community_posts",
  "community_replies",
  "community_mentions",
  "lives",
  "courses",
  "weekly_summary",
] as const;

// Announce a new community post by email to members who didn't opt out.
export const notifyCommunityPostByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Only the author may trigger the announcement for their own post.
    const { data: post, error } = await context.supabase
      .from("community_posts")
      .select("id,author_id")
      .eq("id", data.postId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!post || post.author_id !== context.userId) throw new Error("Forbidden");

    // Só anuncia depois de a moderação aprovar com veredicto claro.
    const { data: verdict } = await context.supabase
      .from("moderation_actions" as never)
      .select("action,category")
      .eq("target_id", data.postId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const v = verdict as { action?: string; category?: string } | null;
    if (!v || v.action !== "allow" || v.category === "erro") {
      return { sent: 0, skipped: 0, reason: "not_moderated" };
    }

    const { sendCommunityPostEmails } = await import("./community-email.server");
    return await sendCommunityPostEmails(data.postId);
  });

export const getMyEmailPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_preferences")
      .select("community_posts,community_replies,community_mentions,lives,courses,weekly_summary")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const defaults = Object.fromEntries(PREF_KEYS.map((k) => [k, true])) as Record<
      (typeof PREF_KEYS)[number],
      boolean
    >;
    return { ...defaults, ...(data ?? {}) };
  });

export const updateMyEmailPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        community_posts: z.boolean(),
        community_replies: z.boolean(),
        community_mentions: z.boolean(),
        lives: z.boolean(),
        courses: z.boolean(),
        weekly_summary: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("email_preferences")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

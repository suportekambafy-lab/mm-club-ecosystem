import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Announce a new MM Short by email. Only fans out when the short's author is an
 * admin (enforced server-side); anyone else's short sends nothing.
 */
export const notifyShortPublishedByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ shortId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: short, error } = await context.supabase
      .from("mm_shorts")
      .select("id,author_id")
      .eq("id", data.shortId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!short || short.author_id !== context.userId) throw new Error("Forbidden");

    const { sendShortPublishedEmails } = await import("./shorts-email.server");
    return await sendShortPublishedEmails(data.shortId);
  });

/** Email the owner of the parent comment when the caller replies to it. */
export const notifyShortReplyByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ commentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: comment, error } = await context.supabase
      .from("mm_short_comments")
      .select("id,user_id,parent_id")
      .eq("id", data.commentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!comment || comment.user_id !== context.userId) throw new Error("Forbidden");
    if (!comment.parent_id) return { sent: 0, reason: "not_a_reply" as const };

    const { sendShortReplyEmail } = await import("./shorts-email.server");
    return await sendShortReplyEmail(data.commentId);
  });

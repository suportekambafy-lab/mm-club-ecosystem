/**
 * Pedido (autenticado) para o MM Suporte avaliar e responder a um post da
 * comunidade. Chamado logo após a publicação, em fire-and-forget.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requestSupportBotReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string }) => {
    if (!input?.postId) throw new Error("postId obrigatório");
    return { postId: input.postId };
  })
  .handler(async ({ data }): Promise<{ replied: boolean }> => {
    const { replyToCommunityPost } = await import("@/lib/support-bot.server");
    return replyToCommunityPost(data.postId);
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  kind: z.enum([
    "community_post",
    "community_comment",
    "community_chat",
    "short",
    "short_comment",
    "live_chat",
  ]),
  id: z.string().uuid(),
});

/**
 * Passa um item recém-criado pelo agente de moderação. É chamado logo após a
 * inserção (fire-and-forget) — o cron `moderation-sweep` cobre o que escapar.
 *
 * Nenhuma publicação é anunciada por email antes de ser aprovada aqui: o email
 * só sai depois do veredicto e nunca para autores sancionados.
 */
export const moderateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { moderateTarget } = await import("./moderation.server");
    const result = await moderateTarget(data);

    if (data.kind === "community_post" && !result.removed) {
      try {
        const { sendCommunityPostEmails } = await import("./community-email.server");
        await sendCommunityPostEmails(data.id);
      } catch (err) {
        console.error("[moderation] email announce failed", err);
      }
    }

    return result;
  });

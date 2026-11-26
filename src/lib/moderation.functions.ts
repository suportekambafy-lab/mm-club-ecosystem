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
  .handler(async ({ data, context }) => {
    const { moderateTarget, MODERATION_TARGETS } = await import("./moderation.server");
    // Só o autor do conteúdo (moderação automática logo após publicar) ou a
    // equipa podem pedir uma moderação.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cfg = MODERATION_TARGETS[data.kind];
    const { data: row, error } = await (supabaseAdmin as any)
      .from(cfg.table)
      .select(cfg.authorColumn)
      .eq(cfg.idColumn, data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Forbidden");
    if ((row as Record<string, unknown>)[cfg.authorColumn] !== context.userId) {
      const [admin, moderator] = await Promise.all([
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "moderator" }),
      ]);
      if (admin.data !== true && moderator.data !== true) throw new Error("Forbidden");
    }
    const result = await moderateTarget(data);

    // Sem veredicto claro (agente em falha) não há email: a verificação
    // periódica volta a avaliar e só então anuncia.
    if (data.kind === "community_post" && !result.removed && result.category !== "erro") {
      try {
        const { sendCommunityPostEmails } = await import("./community-email.server");
        await sendCommunityPostEmails(data.id);
      } catch (err) {
        console.error("[moderation] email announce failed", err);
      }
    }

    return result;
  });

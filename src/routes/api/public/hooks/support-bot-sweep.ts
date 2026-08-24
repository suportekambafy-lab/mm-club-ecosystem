import { createFileRoute } from "@tanstack/react-router";

/**
 * Rede de segurança do MM Suporte na comunidade: percorre os posts recentes
 * sem resposta e deixa o agente responder às dúvidas simples.
 *
 * Auth: header `x-cron-secret` com CRON_SECRET.
 */
export const Route = createFileRoute("/api/public/hooks/support-bot-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { replyToCommunityPost, replyToCommunityChatMessage } = await import(
            "@/lib/support-bot.server"
          );

          const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: rows } = await (supabaseAdmin as any)
            .from("community_posts")
            .select("id")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(100);

          let replied = 0;
          for (const row of rows ?? []) {
            const res = await replyToCommunityPost(row.id as string);
            if (res.replied) replied += 1;
          }

          // Chat ao vivo do grupo: responde à última mensagem sem resposta.
          const { data: chatRows } = await (supabaseAdmin as any)
            .from("community_chat_messages")
            .select("id")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(30);

          let chatReplied = 0;
          for (const row of chatRows ?? []) {
            const res = await replyToCommunityChatMessage(row.id as string);
            if (res.replied) chatReplied += 1;
          }

          return Response.json({
            ok: true,
            checked: (rows ?? []).length,
            replied,
            chatChecked: (chatRows ?? []).length,
            chatReplied,
          });
        } catch (e: any) {
          console.error("[support-bot-sweep] fatal", e);
          return Response.json({ error: e?.message ?? "error" }, { status: 500 });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

/**
 * Rede de segurança do agente de moderação: analisa o conteúdo recente da
 * comunidade que ainda não foi avaliado (posts, comentários, chat, shorts) e
 * remove imediatamente o que viola as regras.
 *
 * Auth: header `x-cron-secret` com CRON_SECRET.
 */
export const Route = createFileRoute("/api/public/hooks/moderation-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { moderateTarget } = await import("@/lib/moderation.server");

          const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
          const sources: Array<{ kind: Parameters<typeof moderateTarget>[0]["kind"]; table: string }> = [
            { kind: "community_post", table: "community_posts" },
            { kind: "community_comment", table: "community_comments" },
            { kind: "community_chat", table: "community_chat_messages" },
            { kind: "short", table: "mm_shorts" },
            { kind: "short_comment", table: "mm_short_comments" },
          ];

          const { data: seen } = await (supabaseAdmin as any)
            .from("moderation_actions")
            .select("target_id")
            .gte("created_at", since);
          const done = new Set<string>((seen ?? []).map((r: { target_id: string }) => r.target_id));

          let checked = 0;
          let removed = 0;
          for (const src of sources) {
            const { data: rows } = await (supabaseAdmin as any)
              .from(src.table)
              .select("id")
              .gte("created_at", since)
              .order("created_at", { ascending: false })
              .limit(50);
            for (const row of rows ?? []) {
              if (done.has(row.id)) continue;
              checked += 1;
              const res = await moderateTarget({ kind: src.kind, id: row.id });
              if (res.removed) removed += 1;
            }
          }

          return new Response(JSON.stringify({ ok: true, checked, removed }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[moderation-sweep] fatal", e);
          return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

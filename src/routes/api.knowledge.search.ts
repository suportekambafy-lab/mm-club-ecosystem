import { createFileRoute } from "@tanstack/react-router";

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export const Route = createFileRoute("/api/knowledge/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireRequestUser } = await import("@/lib/api-auth.server");
        const auth = await requireRequestUser(request);
        if ("denied" in auth) return auth.denied;

        try {
          const { query, match_count } = (await request.json()) as {
            query?: string;
            match_count?: number;
          };
          const q = (query ?? "").trim();
          if (!q) return Response.json({ results: [] });

          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const embRes = await fetch(`${GATEWAY}/embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
            body: JSON.stringify({ model: EMBEDDING_MODEL, input: q }),
          });
          if (!embRes.ok) return Response.json({ results: [] });
          const embJson = (await embRes.json()) as { data: Array<{ embedding: number[] }> };
          const emb = embJson.data[0]?.embedding;
          if (!emb) return Response.json({ results: [] });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: matches } = await supabaseAdmin.rpc("match_lesson_chunks", {
            query_embedding: emb as unknown as string,
            match_count: Math.min(Math.max(match_count ?? 6, 1), 10),
            min_similarity: 0.3,
          });

          const results = Array.isArray(matches)
            ? matches.map((m: any) => ({
                course: m.course_title ?? null,
                lesson: m.lesson_title ?? null,
                content: m.content ?? "",
              }))
            : [];
          return Response.json({ results });
        } catch (e) {
          return Response.json({ results: [] });
        }
      },
    },
  },
});

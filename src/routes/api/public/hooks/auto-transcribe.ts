import { createFileRoute } from "@tanstack/react-router";
import { runAutoTranscribeTick } from "@/lib/lesson-knowledge.functions";

/**
 * Cron target: called every few minutes by pg_cron. Picks up the next
 * lesson without a transcript and processes it in the background. One
 * lesson per tick to keep runtime bounded.
 *
 * Auth: caller must send the project anon key in `apikey` header (same
 * pattern as the other scheduled hooks in this project).
 */
export const Route = createFileRoute("/api/public/hooks/auto-transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || !provided || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const result = await runAutoTranscribeTick();
          return Response.json(result);
        } catch (e: any) {
          return new Response(
            JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { runAutoTranscribeTick } from "@/lib/lesson-knowledge.functions";

/**
 * Cron target: called every few minutes by pg_cron. Picks up the next
 * lesson without a transcript and processes it in the background. One
 * lesson per tick to keep runtime bounded.
 *
 * Auth: caller must send the server-only CRON_SECRET in the `x-cron-secret` header.
 */
export const Route = createFileRoute("/api/public/hooks/auto-transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

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

/**
 * Envio do email "Novidades MM Club".
 * POST /api/public/hooks/novidades-email?mode=test|all
 * Auth: Authorization: Bearer <LOVABLE_API_KEY>
 */
import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export const Route = createFileRoute("/api/public/hooks/novidades-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return Response.json({ error: "missing_credentials" }, { status: 500 });
        const provided = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!provided || !safeEqual(provided, key)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const mode = url.searchParams.get("mode") ?? "test";
        const { sendNovidadesTest, sendNovidadesBroadcast } = await import(
          "@/lib/novidades-email.server"
        );

        if (mode === "all") {
          return Response.json(await sendNovidadesBroadcast());
        }
        const to = url.searchParams.get("to") ?? "victormuabi20@gmail.com";
        return Response.json(await sendNovidadesTest(to));
      },
    },
  },
});

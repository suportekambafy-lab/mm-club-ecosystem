import { createFileRoute } from "@tanstack/react-router";

/**
 * Stable public image URL for a live cover.
 * Emails link to this instead of a long signed storage URL, so the cover
 * always renders in inbox clients (and keeps working over time).
 */
export const Route = createFileRoute("/api/public/lives/$liveId/cover/png")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const liveId = params.liveId;
        const origin = new URL(request.url).origin;
        const fallback = `${origin}/api/public/lives/${liveId}/cover/svg`;

        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const { data } = await supabaseAdmin
            .from("lives")
            .select("cover_url")
            .eq("id", liveId)
            .maybeSingle();

          const raw = (data?.cover_url as string | null) ?? null;
          if (!raw || !raw.startsWith("http")) {
            return Response.redirect(fallback, 302);
          }

          const upstream = await fetch(raw);
          if (!upstream.ok || !upstream.body) {
            return Response.redirect(fallback, 302);
          }

          return new Response(upstream.body, {
            headers: {
              "Content-Type":
                upstream.headers.get("content-type") ?? "image/png",
              "Cache-Control":
                "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
            },
          });
        } catch {
          return Response.redirect(fallback, 302);
        }
      },
    },
  },
});

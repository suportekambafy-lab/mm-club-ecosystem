// Admin-only test dispatcher for the live announcement email.
// POST { liveId, to } with an admin Supabase session (Authorization: Bearer ...).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/live-test-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireRequestAdmin } = await import("@/lib/api-auth.server");
        const auth = await requireRequestAdmin(request);
        if ("denied" in auth) return auth.denied;

        const body = (await request.json()) as { liveId?: string; to?: string };
        if (!body.liveId || !body.to) {
          return new Response("Missing liveId or to", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: live, error } = await supabaseAdmin
          .from("lives")
          .select("id,title,description,starts_at,cover_url")
          .eq("id", body.liveId)
          .maybeSingle();
        if (error || !live) {
          return new Response(`Live not found: ${error?.message ?? "none"}`, { status: 404 });
        }

        const { sendEmail, emailTemplates } = await import("@/lib/email.server");
        const isScheduled =
          new Date(live.starts_at as string).getTime() > Date.now() + 5 * 60 * 1000;
        const tpl = emailTemplates.liveAnnouncement({
          name: body.to.split("@")[0] ?? "amigo",
          title: (live.title as string) ?? "Live MM Club",
          description: (live.description as string | null) ?? null,
          startsAt: live.starts_at as string,
          coverUrl: (live.cover_url as string | null) ?? null,
          liveId: live.id as string,
          isScheduled,
        });

        const result = await sendEmail({
          to: body.to,
          subject: tpl.subject,
          html: tpl.html,
          kind: "live_announcement",
          ref: `test-${live.id}-${Date.now()}`,
        });
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

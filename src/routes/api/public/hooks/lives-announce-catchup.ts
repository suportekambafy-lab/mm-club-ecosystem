import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron target: make sure every confirmed user knows about the upcoming lives.
 *
 * Announcement emails are sent when a live is created, so users who sign up
 * afterwards never received them. This sweeps all future lives and sends the
 * announcement to any confirmed user that hasn't been notified yet.
 * `sendEmail` dedupes on (user_id, kind, ref), so re-runs are safe.
 *
 * Auth: caller must send the server-only CRON_SECRET in the `x-cron-secret` header.
 */
export const Route = createFileRoute("/api/public/hooks/lives-announce-catchup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { sendEmail, emailTemplates } = await import("@/lib/email.server");

          const { data: lives, error } = await supabaseAdmin
            .from("lives")
            .select("id,title,description,starts_at,cover_url")
            .eq("status", "scheduled")
            .eq("is_test", false)
            .gt("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true })
            .limit(10);
          if (error) throw new Error(error.message);
          if (!lives?.length) {
            return Response.json({ ok: true, lives: 0, sent: 0 });
          }

          // Already-notified pairs, so we skip fast without hitting the mailer.
          const liveIds = lives.map((l) => l.id as string);
          const { data: logged } = await supabaseAdmin
            .from("email_log")
            .select("user_id,ref")
            .eq("kind", "live_announcement")
            .in("ref", liveIds);
          const seen = new Set(
            (logged ?? []).map((r) => `${r.user_id ?? ""}:${r.ref ?? ""}`),
          );

          const { lapsedUserIds } = await import("@/lib/billing/lapsed-recipients.server");
          const lapsed = await lapsedUserIds();

          let sent = 0;
          let page = 1;
          for (let i = 0; i < 20; i++) {
            const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
              page,
              perPage: 100,
            });
            if (listErr || !list?.users?.length) break;
            for (const u of list.users) {
              if (!u.email || !u.email_confirmed_at) continue;
              const name =
                (u.user_metadata as { display_name?: string } | null)?.display_name ??
                u.email.split("@")[0] ??
                "amigo";
              for (const live of lives) {
                const id = live.id as string;
                if (seen.has(`${u.id}:${id}`)) continue;
                const tpl = emailTemplates.liveAnnouncement({
                  name,
                  title: (live.title as string) ?? "Live MM Club",
                  description: (live.description as string | null) ?? null,
                  startsAt: live.starts_at as string,
                  coverUrl: (live.cover_url as string | null) ?? null,
                  liveId: id,
                  isScheduled: true,
                  locked: lapsed.has(u.id),
                });
                try {
                  await sendEmail({
                    to: u.email,
                    subject: tpl.subject,
                    html: tpl.html,
                    userId: u.id,
                    kind: "live_announcement",
                    ref: id,
                  });
                  sent += 1;
                } catch (e) {
                  console.error("[lives-catchup] send failed", u.email, id, e);
                }
              }
            }
            if (list.users.length < 100) break;
            page += 1;
          }

          return Response.json({ ok: true, lives: lives.length, sent });
        } catch (e) {
          console.error("[lives-catchup] failed", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});

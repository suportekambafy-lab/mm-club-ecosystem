import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron target: for lives that have ended within the last 24h but don't yet
 * have a recording_video_uid, re-query Cloudflare Stream to see if the
 * recording has finalized. Updates the row when a ready recording is found.
 *
 * Auth: caller must send the server-only CRON_SECRET in the `x-cron-secret` header.
 */
export const Route = createFileRoute("/api/public/hooks/lives-recording-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { listVideosForLiveInput } = await import("@/lib/cloudflare-stream.server");

          // Look at lives ended/live in the last 24h that still lack a recording UID.
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: rows, error } = await supabaseAdmin
            .from("lives")
            .select("id, cf_live_input_id, status, updated_at")
            .in("status", ["ended", "live"])
            .is("recording_video_uid", null)
            .gte("updated_at", since)
            .order("updated_at", { ascending: false })
            .limit(20);
          if (error) throw new Error(error.message);

          const results: Array<{ id: string; updated: boolean; reason?: string }> = [];
          for (const row of rows ?? []) {
            if (!row.cf_live_input_id) {
              results.push({ id: row.id, updated: false, reason: "no_input" });
              continue;
            }
            try {
              const videos = await listVideosForLiveInput(row.cf_live_input_id);
              const readyVids = videos.filter((v) => v.readyToStream);
              // Pick the longest ready recording (reconnects create multiple).
              const ready = readyVids.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))[0];
              if (ready?.uid) {
                const { error: upErr } = await supabaseAdmin
                  .from("lives")
                  .update({ recording_video_uid: ready.uid, status: "published" })
                  .eq("id", row.id);
                if (upErr) throw new Error(upErr.message);
                results.push({ id: row.id, updated: true });
              } else {
                results.push({ id: row.id, updated: false, reason: "not_ready" });
              }
            } catch (e) {
              console.error("[lives-recording-check] failed", row.id, e);
              results.push({ id: row.id, updated: false, reason: "error" });
            }
          }

          return new Response(
            JSON.stringify({ ok: true, checked: rows?.length ?? 0, results }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (e: any) {
          console.error("[lives-recording-check] fatal", e);
          return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

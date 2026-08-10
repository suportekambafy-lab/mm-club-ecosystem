import { createFileRoute } from "@tanstack/react-router";

/**
 * Encerramento de emergência de lives.
 *
 * Faz exatamente o que `endLive` faz (status → ended, liberta participantes,
 * para egress, apaga as salas LiveKit e tenta anexar o replay), mas sem depender
 * da sessão do host no browser — útil quando o botão "Terminar live" falha
 * (token expirado, browser fechado, etc.).
 *
 * Auth: header `x-cron-secret` com CRON_SECRET (igual aos restantes hooks).
 * Body opcional: { "liveId": "uuid" } — sem liveId, encerra todas as lives
 * que estão com status "live".
 */
export const Route = createFileRoute("/api/public/hooks/force-end-live")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        try {
          const body = (await request.json().catch(() => ({}))) as { liveId?: string };
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          let query = supabaseAdmin
            .from("lives")
            .select("id, recording_egress_id, cf_live_input_id, status")
            .eq("status", "live");
          if (body.liveId) query = supabaseAdmin
            .from("lives")
            .select("id, recording_egress_id, cf_live_input_id, status")
            .eq("id", body.liveId);

          const { data: rows, error } = await query;
          if (error) throw new Error(error.message);

          const results: Array<Record<string, unknown>> = [];
          for (const row of rows ?? []) {
            const nowIso = new Date().toISOString();
            await supabaseAdmin
              .from("lives")
              .update({ status: "ended", ended_at: nowIso })
              .eq("id", row.id);
            await supabaseAdmin
              .from("live_participants")
              .update({ left_at: nowIso, on_stage: false, hand_raised_at: null })
              .eq("live_id", row.id)
              .is("left_at", null);

            const detail: Record<string, unknown> = { id: row.id, ended: true };

            try {
              const { livekitRoomName, deleteLiveKitRoom } = await import("@/lib/livekit.server");
              const { stopLiveRecording, stopAllRoomEgress } = await import("@/lib/live-egress.server");
              if (row.recording_egress_id) await stopLiveRecording(row.recording_egress_id);
              await stopAllRoomEgress(livekitRoomName(row.id, "main"));
              await supabaseAdmin
                .from("lives")
                .update({ recording_stopped_at: new Date().toISOString() })
                .eq("id", row.id);
              await deleteLiveKitRoom(livekitRoomName(row.id, "main"));
              await deleteLiveKitRoom(livekitRoomName(row.id, "backstage"));
              detail.teardown = "ok";
            } catch (e: any) {
              detail.teardown = e?.message ?? "error";
            }

            if (row.cf_live_input_id) {
              try {
                const { listVideosForLiveInput } = await import("@/lib/cloudflare-stream.server");
                const videos = await listVideosForLiveInput(row.cf_live_input_id);
                const ready = videos
                  .filter((v) => v.readyToStream)
                  .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))[0];
                if (ready?.uid) {
                  await supabaseAdmin
                    .from("lives")
                    .update({ recording_video_uid: ready.uid, status: "published" })
                    .eq("id", row.id);
                  detail.replay = ready.uid;
                } else {
                  detail.replay = "pending";
                }
              } catch (e: any) {
                detail.replay = e?.message ?? "error";
              }
            }

            results.push(detail);
          }

          return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[force-end-live] fatal", e);
          return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

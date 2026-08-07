import { createFileRoute } from "@tanstack/react-router";

/**
 * Manutenção (apenas localhost): encerra uma live e guarda o replay.
 * Em produção o host nunca é localhost, por isso o endpoint responde 404.
 */
export const Route = createFileRoute("/api/public/hooks/live-force-end")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const host = request.headers.get("host") ?? "";
        if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
          return new Response("Not found", { status: 404 });
        }

        const { liveId } = (await request.json()) as { liveId?: string };
        if (!liveId) return new Response("liveId required", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { livekitRoomName, deleteLiveKitRoom } = await import("@/lib/livekit.server");
        const { stopLiveRecording, stopAllRoomEgress } = await import("@/lib/live-egress.server");
        const { listVideosForLiveInput } = await import("@/lib/cloudflare-stream.server");

        const { data: live } = await supabaseAdmin
          .from("lives")
          .select("id,recording_egress_id,cf_live_input_id")
          .eq("id", liveId)
          .maybeSingle();
        if (!live) return new Response("live not found", { status: 404 });

        const steps: Record<string, unknown> = {};

        try {
          if (live.recording_egress_id) await stopLiveRecording(live.recording_egress_id);
          await stopAllRoomEgress(livekitRoomName(liveId, "main"));
          steps.egress = "stopped";
        } catch (e) {
          steps.egress = `error: ${String(e)}`;
        }

        const nowIso = new Date().toISOString();
        await supabaseAdmin
          .from("lives")
          .update({ status: "ended", ended_at: nowIso, recording_stopped_at: nowIso })
          .eq("id", liveId);
        await supabaseAdmin
          .from("live_participants")
          .update({ left_at: nowIso, on_stage: false, hand_raised_at: null })
          .eq("live_id", liveId)
          .is("left_at", null);

        try {
          await deleteLiveKitRoom(livekitRoomName(liveId, "main"));
          await deleteLiveKitRoom(livekitRoomName(liveId, "backstage"));
          steps.rooms = "deleted";
        } catch (e) {
          steps.rooms = `error: ${String(e)}`;
        }

        // Tenta já apanhar a gravação (pode ainda estar a processar no CF).
        try {
          if (live.cf_live_input_id) {
            const videos = await listVideosForLiveInput(live.cf_live_input_id);
            const ready = videos
              .filter((v) => v.readyToStream)
              .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))[0];
            if (ready?.uid) {
              await supabaseAdmin
                .from("lives")
                .update({ recording_video_uid: ready.uid, status: "published" })
                .eq("id", liveId);
              steps.recording = ready.uid;
            } else {
              steps.recording = `processing (${videos.length} video(s))`;
            }
          }
        } catch (e) {
          steps.recording = `error: ${String(e)}`;
        }

        return new Response(JSON.stringify({ ok: true, steps }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

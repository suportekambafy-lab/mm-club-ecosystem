/**
 * Recording orchestration for interactive rooms (server-only).
 *
 * `ensureLiveRecording` is idempotent: it starts a RoomComposite egress that
 * pushes the composed room into the live's Cloudflare Stream input, but only
 * when the live is on air and no active egress exists yet. It is safe to call
 * on every join / heartbeat, which covers the common race where the host
 * presses "Ir ao ar" before the LiveKit room actually exists (LiveKit rejects
 * egress with "requested room does not exist" in that window).
 */
import { livekitRoomName } from "./livekit.server";
import { startLiveRecording, getRecordingStatus } from "./live-egress.server";

export async function ensureLiveRecording(liveId: string): Promise<{
  ok: boolean;
  egressId: string | null;
  reason: string | null;
}> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: live } = await supabaseAdmin
      .from("lives")
      .select("id,title,status,mode,recording_egress_id,cf_live_input_id,cf_rtmps_url,cf_stream_key")
      .eq("id", liveId)
      .maybeSingle();

    if (!live) return { ok: false, egressId: null, reason: "live_not_found" };
    if (live.status !== "live") return { ok: false, egressId: null, reason: "not_live" };

    const roomName = livekitRoomName(liveId, "main");

    // Already recording?
    try {
      const active = await getRecordingStatus({ roomName });
      const running = active.find(
        (e) => e.status === "EGRESS_ACTIVE" || e.status === "EGRESS_STARTING",
      );
      if (running) {
        if (running.egressId && running.egressId !== live.recording_egress_id) {
          await supabaseAdmin
            .from("lives")
            .update({ recording_egress_id: running.egressId })
            .eq("id", liveId);
        }
        return { ok: true, egressId: running.egressId ?? null, reason: "already_running" };
      }
    } catch {
      /* fall through and try to start */
    }

    // Provision a Cloudflare live input if the row lacks one.
    let rtmpsUrl = live.cf_rtmps_url;
    let streamKey = live.cf_stream_key;
    if (!rtmpsUrl || !streamKey) {
      try {
        const { createLiveInput } = await import("@/lib/cloudflare-stream.server");
        const input = await createLiveInput({ title: live.title ?? "MM Club Live" });
        rtmpsUrl = input.rtmps.url;
        streamKey = input.rtmps.streamKey;
        await supabaseAdmin
          .from("lives")
          .update({
            cf_live_input_id: input.uid,
            cf_rtmps_url: input.rtmps.url,
            cf_stream_key: input.rtmps.streamKey,
            cf_webrtc_url: input.webRTC?.url ?? null,
            cf_playback_id: input.uid,
          })
          .eq("id", liveId);
      } catch (err) {
        console.warn("[live-recording] cf input provisioning failed", err);
      }
    }

    // Alternate the ingest flavour when previous attempts for this room failed
    // (a wedged/refused push otherwise repeats forever and nothing is recorded).
    const { countRoomEgressFailures } = await import("./live-egress.server");
    const failures = await countRoomEgressFailures(roomName);
    const variant: "rtmps" | "rtmp" = failures > 0 && failures % 2 === 1 ? "rtmp" : "rtmps";

    const result = await startLiveRecording({ liveId, roomName, rtmpsUrl, streamKey, variant });
    if (result.egressId) {
      await supabaseAdmin
        .from("lives")
        .update({
          recording_egress_id: result.egressId,
          recording_started_at: new Date().toISOString(),
          recording_stopped_at: null,
          recording_filepath: result.filepath,
        })
        .eq("id", liveId);
      return { ok: true, egressId: result.egressId, reason: result.target };
    }

    return { ok: false, egressId: null, reason: result.error ?? "start_failed" };
  } catch (err) {
    console.warn("[live-recording] ensure failed", err);
    return { ok: false, egressId: null, reason: err instanceof Error ? err.message : "error" };
  }
}

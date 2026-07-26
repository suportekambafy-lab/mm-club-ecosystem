/**
 * Core server functions for Salas Interativas (LiveKit).
 * Modules (reactions/questions/polls/…) live in their own *.functions.ts files.
 *
 * This file is a thin RPC wrapper — heavy logic and the LiveKit SDK are
 * loaded lazily inside handlers to keep the client bundle clean.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// -------------------------------------------------------------------------
// Schemas
// -------------------------------------------------------------------------
const uuid = z.string().uuid();
const liveIdOnly = z.object({ liveId: uuid });

const roleSchema = z.enum(["host", "cohost", "speaker", "participant", "viewer"]);
const targetSchema = z.enum(["backstage", "main"]);
const layoutSchema = z.enum(["solo", "host_guest", "spotlight", "grid"]);

// -------------------------------------------------------------------------
// Helpers (server-only)
// -------------------------------------------------------------------------
async function getAuthedParticipant(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  liveId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("live_participants")
    .select("*")
    .eq("live_id", liveId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

async function requireHostOrCohost(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  liveId: string,
  userId: string,
) {
  const me = await getAuthedParticipant(supabase, liveId, userId);
  if (!me || (me.role !== "host" && me.role !== "cohost") || me.banned) {
    throw new Error("Sem permissão para esta ação.");
  }
  return me;
}

async function logEvent(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  args: {
    liveId: string;
    actorId: string;
    targetUserId?: string | null;
    kind: string;
    payload?: Record<string, unknown>;
  },
) {
  await supabase.from("live_stage_events").insert({
    live_id: args.liveId,
    actor_id: args.actorId,
    target_user_id: args.targetUserId ?? null,
    kind: args.kind,
    payload: args.payload ?? {},
  });
}

// -------------------------------------------------------------------------
// joinRoom — creates/updates the participant row and returns a LiveKit token.
// -------------------------------------------------------------------------
export const joinRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ liveId: uuid, target: targetSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { liveId, target } = data;

    // Live must exist & be reachable via RLS.
    const { data: live, error: liveErr } = await supabase
      .from("lives")
      .select("id, created_by, mode, enabled_modules, spotlight_user_id, stage_layout")
      .eq("id", liveId)
      .maybeSingle();
    if (liveErr) throw new Error(liveErr.message);
    if (!live) throw new Error("Sala não encontrada.");

    // Load or create the participant row.
    let me = await getAuthedParticipant(supabase, liveId, userId);
    if (me?.banned) throw new Error("Foste removido desta sala.");

    let liveMode = live.mode;
    const canActivateInteractive = live.created_by === userId || me?.role === "host" || me?.role === "cohost";
    if (liveMode !== "interactive" && canActivateInteractive) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: modeErr } = await supabaseAdmin
        .from("lives")
        .update({ mode: "interactive" })
        .eq("id", liveId);
      if (modeErr) throw new Error(modeErr.message);
      liveMode = "interactive";
    }

    if (!me) {
      // First join: host if creator, otherwise default participant / viewer.
      const isCreator = live.created_by === userId;
      const initialRole = isCreator ? "host" : target === "backstage" ? "speaker" : "participant";
      const { data: inserted, error: insErr } = await supabase
        .from("live_participants")
        .insert({
          live_id: liveId,
          user_id: userId,
          role: initialRole,
          room: target,
          mic_allowed: isCreator,
          cam_allowed: isCreator,
          screen_allowed: isCreator,
          on_stage: isCreator,
        })
        .select()
        .maybeSingle();
      if (insErr) throw new Error(insErr.message);
      me = inserted;
    } else {
      // Backstage is restricted to publishers.
      if (target === "backstage" && !["host", "cohost", "speaker"].includes(me.role)) {
        throw new Error("Backstage é reservado ao anfitrião e oradores.");
      }
      const { data: updated, error: upErr } = await supabase
        .from("live_participants")
        .update({ room: target, left_at: null, joined_at: new Date().toISOString() })
        .eq("id", me.id)
        .select()
        .maybeSingle();
      if (upErr) throw new Error(upErr.message);
      me = updated ?? me;
    }

    // Profile for display name.
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    const { mintLiveKitToken } = await import("@/lib/livekit.server");
    const { token, url, room } = await mintLiveKitToken({
      liveId,
      target,
      userId,
      displayName: profile?.display_name ?? "Membro",
      role: me!.role,
      publishOverride: me!.on_stage
        ? { mic: me!.mic_allowed, cam: me!.cam_allowed, screen: me!.screen_allowed }
        : undefined,
    });

    return {
      token,
      url,
      room,
      role: me!.role as z.infer<typeof roleSchema>,
      participantId: me!.id,
      live: {
        id: live.id,
        mode: liveMode,
        enabledModules: live.enabled_modules,
        spotlightUserId: live.spotlight_user_id,
        stageLayout: live.stage_layout,
      },
    };
  });

// -------------------------------------------------------------------------
// goLive / endLive — host-only transitions.
// -------------------------------------------------------------------------
export const goLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => liveIdOnly.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireHostOrCohost(supabase, data.liveId, userId);

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("lives")
      .update({ status: "live", started_at: nowIso, went_live_at: nowIso })
      .eq("id", data.liveId);
    if (error) throw new Error(error.message);

    // Start server-side recording. The composed room is pushed over RTMPS into
    // the live's Cloudflare Stream input, which records automatically — so the
    // replay pipeline is identical to broadcast lives. Non-blocking failure:
    // the live still goes on air even if egress fails to spin up.
    try {
      const { livekitRoomName } = await import("./livekit.server");
      const { startLiveRecording, stopAllRoomEgress } = await import("./live-egress.server");
      const roomName = livekitRoomName(data.liveId, "main");

      // Make sure a Cloudflare live input exists (older rows may lack one).
      const { data: cfRow } = await supabase
        .from("lives")
        .select("cf_live_input_id,cf_rtmps_url,cf_stream_key,title")
        .eq("id", data.liveId)
        .maybeSingle();

      let rtmpsUrl = cfRow?.cf_rtmps_url ?? null;
      let streamKey = cfRow?.cf_stream_key ?? null;

      if (!rtmpsUrl || !streamKey) {
        try {
          const { createLiveInput } = await import("@/lib/cloudflare-stream.server");
          const input = await createLiveInput({ title: cfRow?.title ?? "MM Club Live" });
          rtmpsUrl = input.rtmps.url;
          streamKey = input.rtmps.streamKey;
          await supabase
            .from("lives")
            .update({
              cf_live_input_id: input.uid,
              cf_rtmps_url: input.rtmps.url,
              cf_stream_key: input.rtmps.streamKey,
              cf_webrtc_url: input.webRTC?.url ?? null,
              cf_playback_id: input.uid,
            })
            .eq("id", data.liveId);
        } catch (err) {
          console.warn("[goLive] could not provision Cloudflare live input", err);
        }
      }

      // Clear any stale egress left over from a previous session of this room.
      await stopAllRoomEgress(roomName);

      const result = await startLiveRecording({
        liveId: data.liveId,
        roomName,
        rtmpsUrl,
        streamKey,
      });
      if (result.egressId) {
        await supabase
          .from("lives")
          .update({
            recording_egress_id: result.egressId,
            recording_started_at: nowIso,
            recording_stopped_at: null,
            recording_filepath: result.filepath,
          })
          .eq("id", data.liveId);
      } else {
        console.error("[goLive] recording NOT started:", result.error);
      }
    } catch (err) {
      console.warn("[goLive] recording start failed", err);
    }


    await logEvent(supabase, { liveId: data.liveId, actorId: userId, kind: "go_live" });
    return { ok: true };
  });

export const endLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => liveIdOnly.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireHostOrCohost(supabase, data.liveId, userId);

    // Stop server-side recording if one is running.
    const { data: liveRow } = await supabase
      .from("lives")
      .select("recording_egress_id,cf_live_input_id")
      .eq("id", data.liveId)
      .maybeSingle();

    const { error } = await supabase
      .from("lives")
      .update({ status: "ended" })
      .eq("id", data.liveId);
    if (error) throw new Error(error.message);

    try {
      const { livekitRoomName } = await import("./livekit.server");
      const { stopLiveRecording, stopAllRoomEgress } = await import("./live-egress.server");
      if (liveRow?.recording_egress_id) await stopLiveRecording(liveRow.recording_egress_id);
      // Belt and braces: stop any other active egress bound to this room.
      await stopAllRoomEgress(livekitRoomName(data.liveId, "main"));
      await supabase
        .from("lives")
        .update({ recording_stopped_at: new Date().toISOString() })
        .eq("id", data.liveId);
    } catch (err) {
      console.warn("[endLive] recording stop failed", err);
    }

    // Best effort: if Cloudflare already finalized a recording, attach it now.
    // Otherwise the CF webhook / the lives-recording-check cron will attach it
    // as soon as the file is ready — the live only becomes "published"
    // (Replay disponível) when a ready-to-stream recording actually exists.
    if (liveRow?.cf_live_input_id) {
      try {
        const { listVideosForLiveInput } = await import("@/lib/cloudflare-stream.server");
        const videos = await listVideosForLiveInput(liveRow.cf_live_input_id);
        const ready = videos
          .filter((v) => v.readyToStream)
          .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))[0];
        if (ready?.uid) {
          await supabase
            .from("lives")
            .update({ recording_video_uid: ready.uid, status: "published" })
            .eq("id", data.liveId);
        }
      } catch (err) {
        console.warn("[endLive] recording lookup failed", err);
      }
    }


    await logEvent(supabase, { liveId: data.liveId, actorId: userId, kind: "end_live" });
    return { ok: true };
  });


// -------------------------------------------------------------------------
// Hand raise / invitation / promotion
// -------------------------------------------------------------------------
export const raiseHand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ liveId: uuid, raised: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("live_participants")
      .update({ hand_raised_at: data.raised ? new Date().toISOString() : null })
      .eq("live_id", data.liveId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const inviteToStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ liveId: uuid, targetUserId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireHostOrCohost(supabase, data.liveId, userId);
    const { error } = await supabase
      .from("live_participants")
      .update({ invited_to_stage_at: new Date().toISOString(), invited_by: userId })
      .eq("live_id", data.liveId)
      .eq("user_id", data.targetUserId);
    if (error) throw new Error(error.message);
    await logEvent(supabase, {
      liveId: data.liveId,
      actorId: userId,
      targetUserId: data.targetUserId,
      kind: "invite_to_stage",
    });
    return { ok: true };
  });

export const promoteToStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        liveId: uuid,
        targetUserId: uuid,
        role: z.enum(["speaker", "cohost"]).default("speaker"),
        mic: z.boolean().default(true),
        cam: z.boolean().default(true),
        screen: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireHostOrCohost(supabase, data.liveId, userId);
    const { error } = await supabase
      .from("live_participants")
      .update({
        role: data.role,
        on_stage: true,
        mic_allowed: data.mic,
        cam_allowed: data.cam,
        screen_allowed: data.screen,
        hand_raised_at: null,
        invited_to_stage_at: null,
      })
      .eq("live_id", data.liveId)
      .eq("user_id", data.targetUserId);
    if (error) throw new Error(error.message);
    await logEvent(supabase, {
      liveId: data.liveId,
      actorId: userId,
      targetUserId: data.targetUserId,
      kind: "promote_to_stage",
      payload: { role: data.role },
    });
    return { ok: true };
  });

export const demoteFromStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ liveId: uuid, targetUserId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireHostOrCohost(supabase, data.liveId, userId);
    const { error } = await supabase
      .from("live_participants")
      .update({
        role: "participant",
        on_stage: false,
        mic_allowed: false,
        cam_allowed: false,
        screen_allowed: false,
      })
      .eq("live_id", data.liveId)
      .eq("user_id", data.targetUserId);
    if (error) throw new Error(error.message);
    await logEvent(supabase, {
      liveId: data.liveId,
      actorId: userId,
      targetUserId: data.targetUserId,
      kind: "demote_from_stage",
    });
    return { ok: true };
  });

// -------------------------------------------------------------------------
// Layout & spotlight
// -------------------------------------------------------------------------
export const setStageLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ liveId: uuid, layout: layoutSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireHostOrCohost(supabase, data.liveId, userId);
    const { error } = await supabase
      .from("lives")
      .update({ stage_layout: data.layout })
      .eq("id", data.liveId);
    if (error) throw new Error(error.message);

    const { updateMainRoomMetadata } = await import("@/lib/livekit.server");
    await updateMainRoomMetadata(data.liveId, { stageLayout: data.layout }).catch(() => {});
    return { ok: true };
  });

export const setSpotlight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ liveId: uuid, targetUserId: uuid.nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireHostOrCohost(supabase, data.liveId, userId);
    const { error } = await supabase
      .from("lives")
      .update({ spotlight_user_id: data.targetUserId })
      .eq("id", data.liveId);
    if (error) throw new Error(error.message);

    const { updateMainRoomMetadata } = await import("@/lib/livekit.server");
    await updateMainRoomMetadata(data.liveId, { spotlightUserId: data.targetUserId }).catch(
      () => {},
    );
    await logEvent(supabase, {
      liveId: data.liveId,
      actorId: userId,
      targetUserId: data.targetUserId,
      kind: data.targetUserId ? "spotlight_set" : "spotlight_clear",
    });
    return { ok: true };
  });

// -------------------------------------------------------------------------
// Moderation
// -------------------------------------------------------------------------
export const kickParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ liveId: uuid, targetUserId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireHostOrCohost(supabase, data.liveId, userId);
    const { error } = await supabase
      .from("live_participants")
      .update({ kicked_at: new Date().toISOString(), on_stage: false })
      .eq("live_id", data.liveId)
      .eq("user_id", data.targetUserId);
    if (error) throw new Error(error.message);

    const { forceRemoveParticipant } = await import("@/lib/livekit.server");
    await forceRemoveParticipant(data.liveId, "main", data.targetUserId).catch(() => {});
    await forceRemoveParticipant(data.liveId, "backstage", data.targetUserId).catch(() => {});
    await logEvent(supabase, {
      liveId: data.liveId,
      actorId: userId,
      targetUserId: data.targetUserId,
      kind: "kick",
    });
    return { ok: true };
  });

export const banParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ liveId: uuid, targetUserId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireHostOrCohost(supabase, data.liveId, userId);
    const { error } = await supabase
      .from("live_participants")
      .update({
        banned: true,
        banned_at: new Date().toISOString(),
        on_stage: false,
        mic_allowed: false,
        cam_allowed: false,
        screen_allowed: false,
      })
      .eq("live_id", data.liveId)
      .eq("user_id", data.targetUserId);
    if (error) throw new Error(error.message);

    const { forceRemoveParticipant } = await import("@/lib/livekit.server");
    await forceRemoveParticipant(data.liveId, "main", data.targetUserId).catch(() => {});
    await forceRemoveParticipant(data.liveId, "backstage", data.targetUserId).catch(() => {});
    await logEvent(supabase, {
      liveId: data.liveId,
      actorId: userId,
      targetUserId: data.targetUserId,
      kind: "ban",
    });
    return { ok: true };
  });

export const setRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ liveId: uuid, targetUserId: uuid, role: roleSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const me = await requireHostOrCohost(supabase, data.liveId, userId);
    // Only host can promote to cohost or transfer host.
    if ((data.role === "cohost" || data.role === "host") && me.role !== "host") {
      throw new Error("Só o anfitrião pode nomear co-anfitriões.");
    }
    const { error } = await supabase
      .from("live_participants")
      .update({ role: data.role })
      .eq("live_id", data.liveId)
      .eq("user_id", data.targetUserId);
    if (error) throw new Error(error.message);
    await logEvent(supabase, {
      liveId: data.liveId,
      actorId: userId,
      targetUserId: data.targetUserId,
      kind: "set_role",
      payload: { role: data.role },
    });
    return { ok: true };
  });

// -------------------------------------------------------------------------
// Room state fetch (for the room shell / host panel)
// -------------------------------------------------------------------------
export const getRoomState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => liveIdOnly.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: live } = await supabase
      .from("lives")
      .select(
        "id,title,mode,enabled_modules,spotlight_user_id,stage_layout,status,started_at,went_live_at,backstage_started_at,created_by",
      )
      .eq("id", data.liveId)
      .maybeSingle();
    if (!live) throw new Error("Sala não encontrada.");

    const { data: participants } = await supabase
      .from("live_participants")
      .select(
        "id,user_id,role,room,on_stage,mic_allowed,cam_allowed,screen_allowed,hand_raised_at,invited_to_stage_at,banned,joined_at,left_at",
      )
      .eq("live_id", data.liveId)
      .order("joined_at", { ascending: true });

    return { live, participants: participants ?? [] };
  });

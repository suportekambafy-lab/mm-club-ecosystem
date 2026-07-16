import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public list — visible lives + past recordings the user has access to.
export const listLives = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const url = process.env.SUPABASE_URL!;
  const supa = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if ((key.startsWith("sb_")) && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  // Anon can only see visibility=public via RLS, that's fine for logged-out.
  const { data, error } = await supa
    .from("lives")
    .select(
      "id,title,description,expert_id,starts_at,duration_minutes,visibility,cover_url,status,cf_playback_id,recording_video_uid",
    )
    .order("starts_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

// Authenticated variant — returns lives the caller can see (RLS applies).
export const listLivesAuthed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("lives")
      .select(
        "id,title,description,expert_id,starts_at,duration_minutes,visibility,cover_url,status,cf_playback_id,recording_video_uid",
      )
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Detail + short-lived playback token if the caller has access.
export const getLive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: live, error } = await context.supabase
      .from("lives")
      .select(
        "id,title,description,expert_id,starts_at,duration_minutes,visibility,cover_url,status,cf_playback_id,cf_live_input_id,recording_video_uid",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!live) throw new Error("Live não encontrada ou sem acesso.");

    // Backfill recording UID for ended/published lives when the webhook didn't fire.
    let recordingUid = live.recording_video_uid;
    const isReplay = live.status === "published" || live.status === "ended";
    if (isReplay && !recordingUid && live.cf_live_input_id) {
      try {
        const { listVideosForLiveInput } = await import("@/lib/cloudflare-stream.server");
        const videos = await listVideosForLiveInput(live.cf_live_input_id);
        const ready = videos.find((v) => v.readyToStream) ?? videos[0];
        if (ready?.uid) {
          recordingUid = ready.uid;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("lives")
            .update({ recording_video_uid: ready.uid, status: "published" })
            .eq("id", live.id);
        }
      } catch (e) {
        console.error("[lives] backfill recording_video_uid failed", e);
      }
    }

    // Determine the playback UID (live vs. recording).
    const videoUid = isReplay
      ? recordingUid ?? live.cf_playback_id
      : live.cf_playback_id;

    let playbackToken: string | null = null;
    if (videoUid) {
      try {
        const { signPlaybackToken } = await import("@/lib/cloudflare-stream.server");
        playbackToken = await signPlaybackToken(videoUid, { ttlSeconds: 7200 });
      } catch (e) {
        console.error("[lives] signPlaybackToken failed", e);
      }
    }

    return { live, playbackToken, videoUid };
  });


// Chat messages: initial fetch + send.
export const listChatMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ liveId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("live_chat_messages")
      .select("id,live_id,user_id,body,created_at")
      .eq("live_id", data.liveId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        liveId: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("live_chat_messages")
      .insert({ live_id: data.liveId, body: data.body, user_id: context.userId })
      .select("id,live_id,user_id,body,created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// --- Admin ---

async function requireAdmin(supabase: import("@supabase/supabase-js").SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const adminCreateLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        title: z.string().min(3).max(180),
        description: z.string().max(2000).optional(),
        expert_id: z.string().max(120).optional(),
        starts_at: z.string(), // ISO
        duration_minutes: z.number().int().min(5).max(600),
        visibility: z.enum(["public", "club", "premium"]),
        cover_url: z.string().url().optional().or(z.literal("").transform(() => undefined)),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { createLiveInput } = await import("@/lib/cloudflare-stream.server");
    const input = await createLiveInput({ title: data.title });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("lives")
      .insert({
        title: data.title,
        description: data.description ?? null,
        expert_id: data.expert_id ?? null,
        starts_at: data.starts_at,
        duration_minutes: data.duration_minutes,
        visibility: data.visibility,
        cover_url: data.cover_url ?? null,
        cf_live_input_id: input.uid,
        cf_stream_key: input.rtmps.streamKey,
        cf_rtmps_url: input.rtmps.url,
        cf_webrtc_url: input.webRTC?.url ?? null,
        cf_playback_id: input.uid, // For live inputs, playback uses the input UID.
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: row.id,
      rtmps: input.rtmps,
      webRTC: input.webRTC ?? null,
    };
  });

export const adminDeleteLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: live } = await supabaseAdmin
      .from("lives")
      .select("cf_live_input_id")
      .eq("id", data.id)
      .maybeSingle();
    if (live?.cf_live_input_id) {
      try {
        const { deleteLiveInput } = await import("@/lib/cloudflare-stream.server");
        await deleteLiveInput(live.cf_live_input_id);
      } catch (e) {
        console.error("[lives] cf delete failed", e);
      }
    }
    const { error } = await supabaseAdmin.from("lives").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetLiveIngest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("lives")
      .select("cf_rtmps_url,cf_stream_key,cf_live_input_id,cf_webrtc_url")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminSetLiveBroadcastState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["live", "ended"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("lives").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListLives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("lives")
      .select("id,title,expert_id,starts_at,duration_minutes,visibility,status,cf_live_input_id")
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

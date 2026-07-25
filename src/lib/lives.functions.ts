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
    // For replays we require an actual recording UID — falling back to the
    // live-input UID would render a black player (input has no video).
    const videoUid = isReplay ? recordingUid ?? null : live.cf_playback_id;

    let playbackToken: string | null = null;
    if (videoUid) {
      try {
        const { signPlaybackToken } = await import("@/lib/cloudflare-stream.server");
        playbackToken = await signPlaybackToken(videoUid, { ttlSeconds: 7200 });
      } catch (e) {
        console.error("[lives] signPlaybackToken failed", e);
      }
    }

    // For replays, fetch the actual recording duration from Cloudflare.
    let actualDurationSeconds: number | null = null;
    if (isReplay && recordingUid) {
      try {
        const { getVideoDetails } = await import("@/lib/cloudflare-stream.server");
        const details = await getVideoDetails(recordingUid);
        if (typeof details.duration === "number" && details.duration > 0) {
          actualDurationSeconds = Math.round(details.duration);
        }
      } catch (e) {
        console.error("[lives] getVideoDetails failed", e);
      }
    }

    return { live, playbackToken, videoUid, actualDurationSeconds };
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
        starts_at: z.string().optional(), // ISO; empty = start now
        duration_minutes: z.number().int().min(5).max(600).optional(),
        visibility: z.enum(["public", "club", "premium"]),
        cover_url: z
          .string()
          .url()
          .optional()
          .or(z.literal("").transform(() => undefined)),
        speaker_image_url: z
          .string()
          .url()
          .optional()
          .or(z.literal("").transform(() => undefined)),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { createLiveInput } = await import("@/lib/cloudflare-stream.server");
    const input = await createLiveInput({ title: data.title });

    const startsAt = data.starts_at ?? new Date().toISOString();
    const duration = data.duration_minutes ?? 60;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("lives")
      .insert({
        title: data.title,
        description: data.description ?? null,
        expert_id: data.expert_id ?? null,
        starts_at: startsAt,
        duration_minutes: duration,
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

    // Auto-generate a premium MM Club cover when the admin didn't upload one.
    let finalCoverUrl: string | null = data.cover_url ?? null;
    if (!data.cover_url) {
      let autoCover = `/api/public/lives/${row.id}/cover/svg`;
      try {
        const { generateAndStoreLiveCover } = await import("@/lib/live-cover.server");
        autoCover = await generateAndStoreLiveCover({
          liveId: row.id,
          title: data.title,
          startsAt,
          supabaseAdmin,
          speakerImageUrl: data.speaker_image_url,
        });
      } catch (e) {
        console.error("[lives] AI cover generation failed, using fallback", e);
      }
      await supabaseAdmin
        .from("lives")
        .update({ cover_url: autoCover })
        .eq("id", row.id);
      finalCoverUrl = autoCover;
    }

    // Fire email announcements to all confirmed users (idempotent via email_log).
    try {
      const { sendEmail, emailTemplates } = await import("@/lib/email.server");
      const isScheduled = new Date(startsAt).getTime() > Date.now() + 5 * 60 * 1000;
      let page = 1;
      // Bounded loop to avoid runaway execution.
      for (let i = 0; i < 20; i++) {
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 100,
        });
        if (listErr || !list?.users?.length) break;
        for (const u of list.users) {
          if (!u.email || !u.email_confirmed_at) continue;
          const name =
            ((u.user_metadata as { display_name?: string } | null)?.display_name) ??
            u.email.split("@")[0] ??
            "amigo";
          const tpl = emailTemplates.liveAnnouncement({
            name,
            title: data.title,
            description: data.description ?? null,
            startsAt,
            coverUrl: finalCoverUrl,
            liveId: row.id,
            isScheduled,
          });
          await sendEmail({
            to: u.email,
            subject: tpl.subject,
            html: tpl.html,
            userId: u.id,
            kind: "live_announcement",
            ref: row.id,
          }).catch((e) => console.error("[lives] announce email failed", u.email, e));
        }
        if (list.users.length < 100) break;
        page += 1;
      }
    } catch (e) {
      console.error("[lives] announce dispatch failed", e);
    }

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

export const adminCreateReplayUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        sizeBytes: z.number().int().positive().max(8 * 1024 * 1024 * 1024).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: live, error } = await supabaseAdmin
      .from("lives")
      .select("id,title")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!live) throw new Error("Live não encontrada.");

    const { createDirectUpload } = await import("@/lib/cloudflare-stream.server");
    const upload = await createDirectUpload({
      name: `Replay — ${live.title}`,
      liveId: live.id,
      source: "mm-browser-recorder",
    });
    return upload;
  });

export const adminAttachReplayRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        videoUid: z.string().min(8).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("lives")
      .update({ recording_video_uid: data.videoUid, status: "published" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListLives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("lives")
      .select("id,title,expert_id,starts_at,duration_minutes,visibility,status,cf_live_input_id,cover_url")
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

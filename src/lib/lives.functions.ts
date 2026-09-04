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
      "id,title,description,expert_id,starts_at,duration_minutes,visibility,cover_url,status,cf_playback_id,recording_video_uid,mode",
    )
    .eq("is_test", false)
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
        "id,title,description,expert_id,starts_at,duration_minutes,visibility,cover_url,status,cf_playback_id,recording_video_uid,mode",
      )
      .eq("is_test", false)
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
        "id,title,description,expert_id,starts_at,started_at,ended_at,updated_at,stream_generation,duration_minutes,visibility,cover_url,status,cf_playback_id,cf_live_input_id,recording_video_uid,external_recording_url,mode,replay_trim_start_seconds,replay_trim_end_seconds",
      )

      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!live) throw new Error("Live não encontrada ou sem acesso.");

    let effectiveMode = live.mode;
    if (effectiveMode !== "interactive" && (live.status === "scheduled" || live.status === "live")) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: participantMarker } = await supabaseAdmin
          .from("live_participants")
          .select("id")
          .eq("live_id", live.id)
          .limit(1)
          .maybeSingle();

        if (participantMarker) {
          effectiveMode = "interactive";
          await supabaseAdmin.from("lives").update({ mode: "interactive" }).eq("id", live.id);
        }
      } catch (e) {
        console.error("[lives] interactive mode detection failed", e);
      }
    }


    // Backfill recording UID for ended/published lives when the webhook didn't fire.
    let recordingUid = live.recording_video_uid;
    const isReplay = live.status === "published" || live.status === "ended";

    // Replay segments — Cloudflare creates ONE recording per broadcast
    // connection. When the host disconnects and reconnects (power loss, etc.),
    // the session ends up as multiple videos. We list them all in chronological
    // order and let the player advance through them, so the replay covers the
    // whole session instead of the last connection only.
    type ReplaySegment = { uid: string; token: string | null; duration: number | null };
    let replaySegments: ReplaySegment[] = [];
    let actualDurationSeconds: number | null = null;
    // Cloudflare needs a few minutes to finalize a recording after the session
    // ends. Track whether any recording is still encoding so the UI can show
    // "a processar" instead of wrongly claiming the live wasn't recorded.
    let pendingRecording = false;

    if (isReplay && live.cf_live_input_id) {
      try {
        const { listVideosForLiveInput, signPlaybackToken } = await import("@/lib/cloudflare-stream.server");
        const videos = await listVideosForLiveInput(live.cf_live_input_id);
        pendingRecording = videos.some((v) => !v.readyToStream);
        const ready = videos
          .filter((v) => v.readyToStream)
          .sort((a, b) => {
            const at = a.created ? new Date(a.created).getTime() : 0;
            const bt = b.created ? new Date(b.created).getTime() : 0;
            return at - bt;
          });

        if (ready.length > 0) {
          replaySegments = await Promise.all(
            ready.map(async (v) => {
              let token: string | null = null;
              try {
                token = await signPlaybackToken(v.uid, { ttlSeconds: 7200 });
              } catch (e) {
                console.error("[lives] signPlaybackToken failed", v.uid, e);
              }
              return {
                uid: v.uid,
                token,
                duration: typeof v.duration === "number" ? v.duration : null,
              };
            }),
          );
          actualDurationSeconds = Math.round(
            replaySegments.reduce((sum, s) => sum + (s.duration ?? 0), 0),
          ) || null;

          // Persist the first segment as the canonical recording_video_uid so
          // list views and cards still work.
          const first = replaySegments[0];
          if (first && first.uid !== recordingUid) {
            recordingUid = first.uid;
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin
              .from("lives")
              .update({ recording_video_uid: first.uid, status: "published" })
              .eq("id", live.id);
          }
        }
      } catch (e) {
        console.error("[lives] replay segments fetch failed", e);
      }
    }

    // Determine the playback UID (live vs. recording).
    // For replays we require an actual recording UID — falling back to the
    // live-input UID would render a black player (input has no video).
    const videoUid = isReplay ? recordingUid ?? null : live.cf_playback_id;

    let playbackToken: string | null = null;
    if (isReplay) {
      playbackToken = replaySegments[0]?.token ?? null;
      // Fallback: recording_video_uid points to a direct-uploaded video
      // (e.g. from the browser MediaRecorder fail-safe) that is NOT listed
      // under live_inputs/{uid}/videos. Sign it directly so the player has
      // a valid token instead of going black.
      if (!playbackToken && videoUid) {
        try {
          const { signPlaybackToken } = await import("@/lib/cloudflare-stream.server");
          playbackToken = await signPlaybackToken(videoUid, { ttlSeconds: 7200 });
        } catch (e) {
          console.error("[lives] signPlaybackToken fallback failed", e);
        }
      }
    } else if (videoUid) {
      try {
        const { signPlaybackToken } = await import("@/lib/cloudflare-stream.server");
        playbackToken = await signPlaybackToken(videoUid, { ttlSeconds: 7200 });
      } catch (e) {
        console.error("[lives] signPlaybackToken failed", e);
      }
    }

    // Replay availability state, used by the UI:
    //  - "ready"       → playable recording
    //  - "processing"  → Cloudflare is still encoding, or the session ended
    //                    recently (grace window) so a recording may still land
    //  - "unavailable" → genuinely no recording for this session
    let replayStatus: "ready" | "processing" | "unavailable" = "ready";
    if (isReplay) {
      if (videoUid && playbackToken) {
        replayStatus = "ready";
        // Announce the replay once, the first time it is actually playable.
        try {
          const { notifyReplayReady } = await import("@/lib/live-replay-notify.server");
          await notifyReplayReady(live.id);
        } catch (e) {
          console.error("[lives] replay notify failed", e);
        }
      } else {
        const endedRef = live.ended_at ?? live.updated_at ?? null;
        const withinGrace = endedRef
          ? Date.now() - new Date(endedRef).getTime() < 45 * 60 * 1000
          : false;
        replayStatus = pendingRecording || withinGrace ? "processing" : "unavailable";
      }
    }

    return {
      live: { ...live, mode: effectiveMode },
      playbackToken,
      videoUid,
      actualDurationSeconds,
      replaySegments,
      replayStatus,
      trimStart:
        typeof live.replay_trim_start_seconds === "number" ? live.replay_trim_start_seconds : null,
      trimEnd:
        typeof live.replay_trim_end_seconds === "number" ? live.replay_trim_end_seconds : null,
    };

  });




// Chat messages: initial fetch + send.
export const listChatMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ liveId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("live_chat_messages")
      .select("id,live_id,user_id,body,created_at,pinned_at,pinned_by,guest_id,guest_name")
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
      .select("id,live_id,user_id,body,created_at,pinned_at,pinned_by,guest_id,guest_name")
      .single();
    if (error) throw new Error(error.message);
    // Agente de moderação: remove imediatamente pedidos de reembolso, dados
    // pessoais, spam ou ataques à marca antes de ficarem visíveis no direto.
    if (row?.id) {
      const { moderateTarget } = await import("./moderation.server");
      const verdict = await moderateTarget({ kind: "live_chat", id: row.id });
      if (verdict.removed) {
        throw new Error(
          verdict.reason
            ? `Mensagem bloqueada pela moderação MM Club: ${verdict.reason}`
            : "Mensagem bloqueada pela moderação MM Club.",
        );
      }
    }
    return row;
  });


export const setChatMessagePinned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error, data: row } = await context.supabase
      .from("live_chat_messages")
      .update({
        pinned_at: data.pinned ? new Date().toISOString() : null,
        pinned_by: data.pinned ? context.userId : null,
      })
      .eq("id", data.id)
      .select("id,live_id,user_id,body,created_at,pinned_at,pinned_by,guest_id,guest_name")
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
        guest_image_url: z
          .string()
          .url()
          .optional()
          .or(z.literal("").transform(() => undefined)),
        // Test sessions stay hidden from members and never trigger emails/notifications.
        is_test: z.boolean().optional(),
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
        is_test: data.is_test ?? false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const isTest = data.is_test ?? false;

    // Auto-generate a premium MM Club cover when the admin didn't upload one.
    let finalCoverUrl: string | null = data.cover_url ?? null;
    if (!data.cover_url) {
      let autoCover = `/api/public/lives/${row.id}/cover/svg`;
      if (!isTest) {
        try {
          const { generateAndStoreLiveCover } = await import("@/lib/live-cover.server");
          autoCover = await generateAndStoreLiveCover({
            liveId: row.id,
            title: data.title,
            startsAt,
            supabaseAdmin,
            speakerImageUrl: data.speaker_image_url,
            guestImageUrl: data.guest_image_url,
          });
        } catch (e) {
          console.error("[lives] AI cover generation failed, using fallback", e);
        }
      }
      await supabaseAdmin
        .from("lives")
        .update({ cover_url: autoCover })
        .eq("id", row.id);
      finalCoverUrl = autoCover;
    }

    // Test sessions never announce to members.
    if (isTest) {
      return { id: row.id, rtmps: input.rtmps, webRTC: input.webRTC ?? null };
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
      .select("cf_rtmps_url,cf_stream_key,cf_live_input_id,cf_webrtc_url,status,started_at,stream_generation")
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

    if (data.status === "live") {
      const { data: current, error: readErr } = await supabaseAdmin
        .from("lives")
        .select("started_at,stream_generation,status")
        .eq("id", data.id)
        .maybeSingle();
      if (readErr) throw new Error(readErr.message);

      // Only preserve started_at when the live is already broadcasting; a
      // previously ended live must not inherit its old start time.
      const startedAt: string =
        current?.status === "live" && current?.started_at
          ? current.started_at
          : new Date().toISOString();
      const nextGen: number = (current?.stream_generation ?? 0) + 1;
      const { error } = await supabaseAdmin
        .from("lives")
        .update({ status: "live", started_at: startedAt, stream_generation: nextGen })
        .eq("id", data.id);
      if (error) throw new Error(error.message);

      // Aviso automático por email (dedupe por live no email_log).
      try {
        const { sendLiveStartEmails } = await import("./live-start-email.server");
        await sendLiveStartEmails(data.id);
      } catch (e) {
        console.error("[setBroadcastState] live start emails failed", e);
      }

      return { ok: true as const, started_at: startedAt, stream_generation: nextGen };
    }

    const { error } = await supabaseAdmin
      .from("lives")
      .update({ status: "ended", started_at: null, ended_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    return { ok: true as const, started_at: null as string | null, stream_generation: null as number | null };
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
      .select("id,title,description,expert_id,starts_at,duration_minutes,visibility,status,cf_live_input_id,cover_url,is_test")
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Editar metadados de uma live (agendada ou já terminada).
export const adminUpdateLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(3).max(180),
        description: z.string().max(2000).nullable().optional(),
        expert_id: z.string().max(120).nullable().optional(),
        starts_at: z.string().min(4),
        duration_minutes: z.number().int().min(5).max(600),
        visibility: z.enum(["public", "club", "premium"]),
        cover_url: z.string().url().nullable().optional(),
        notify_reschedule: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("lives")
      .select("starts_at,status")
      .eq("id", data.id)
      .maybeSingle();
    const nextStartsAt = new Date(data.starts_at).toISOString();
    const { error } = await supabaseAdmin
      .from("lives")
      .update({
        title: data.title,
        description: data.description ?? null,
        expert_id: data.expert_id ?? null,
        starts_at: nextStartsAt,
        duration_minutes: data.duration_minutes,
        visibility: data.visibility,
        cover_url: data.cover_url ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Novo horário numa live ainda por acontecer → avisar todos os membros.
    const oldStartsAt = before?.starts_at ? new Date(before.starts_at as string).toISOString() : null;
    const changed = Boolean(oldStartsAt) && oldStartsAt !== nextStartsAt;
    if (data.notify_reschedule !== false && changed && before?.status === "scheduled") {
      const { notifyLiveRescheduled } = await import("./live-reschedule.server");
      const r = await notifyLiveRescheduled({
        liveId: data.id,
        oldStartsAt: oldStartsAt as string,
        newStartsAt: nextStartsAt,
      });
      return { ok: true as const, notified: r.sent };
    }
    return { ok: true as const, notified: 0 };
  });

// Gera de novo a capa MM Club a partir do título atual (usado quando o título muda).
export const adminRegenerateLiveCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        speaker_image_url: z
          .string()
          .url()
          .optional()
          .or(z.literal("").transform(() => undefined)),
        guest_image_url: z
          .string()
          .url()
          .optional()
          .or(z.literal("").transform(() => undefined)),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("lives")
      .select("id,title,starts_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Sessão não encontrada.");

    const { generateAndStoreLiveCover } = await import("@/lib/live-cover.server");
    const url = await generateAndStoreLiveCover({
      liveId: row.id as string,
      title: row.title as string,
      startsAt: row.starts_at as string,
      supabaseAdmin,
      speakerImageUrl: data.speaker_image_url,
      guestImageUrl: data.guest_image_url,
    });
    await supabaseAdmin.from("lives").update({ cover_url: url }).eq("id", data.id);
    return { ok: true as const, cover_url: url };
  });

// Pré-visualização: gera a capa com IA sem criar/alterar nenhuma live.
export const adminPreviewLiveCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        title: z.string().min(3).max(180),
        starts_at: z.string().optional(),
        speaker_image_url: z
          .string()
          .url()
          .optional()
          .or(z.literal("").transform(() => undefined)),
        guest_image_url: z
          .string()
          .url()
          .optional()
          .or(z.literal("").transform(() => undefined)),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateAndStoreLiveCover } = await import("@/lib/live-cover.server");
    const url = await generateAndStoreLiveCover({
      liveId: `preview-${Date.now()}`,
      title: data.title,
      startsAt: data.starts_at ?? new Date().toISOString(),
      supabaseAdmin,
      speakerImageUrl: data.speaker_image_url,
      guestImageUrl: data.guest_image_url,
      pathPrefix: "lives-covers/previews",
    });
    return { ok: true as const, cover_url: url };
  });


// Replay editor — trim the dark/silent head (and optional tail) of a recording.
export const adminSetReplayTrim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        trimStart: z.number().min(0).max(86400).nullable(),
        trimEnd: z.number().min(0).max(86400).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.trimStart != null && data.trimEnd != null && data.trimEnd <= data.trimStart) {
      throw new Error("O fim tem de ser depois do início.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("lives")
      .update({
        replay_trim_start_seconds: data.trimStart,
        replay_trim_end_seconds: data.trimEnd,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Reenvia (ou envia) o email "AO VIVO agora" a todos os subscritores.
export const adminSendLiveStartEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { sendLiveStartEmails } = await import("./live-start-email.server");
    return await sendLiveStartEmails(data.id);
  });

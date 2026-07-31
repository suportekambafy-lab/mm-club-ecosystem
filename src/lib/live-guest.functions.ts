/**
 * Guest access to interactive live rooms.
 *
 * A host can share a "link de convidado" for a scheduled session. Anyone with
 * the link types a name and joins the stage — no MM Club account required.
 *
 * Thin RPC wrapper: server-only modules are imported inside the handlers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

/** Host/admin: create (or rotate) the guest link for a live. */
export const adminGetGuestLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ liveId: uuid, rotate: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: live, error } = await supabaseAdmin
      .from("lives")
      .select("id, title, created_by, guest_token")
      .eq("id", data.liveId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!live) throw new Error("Sessão não encontrada.");
    if (!isAdmin && live.created_by !== userId) throw new Error("Sem permissão para esta sessão.");

    let token = live.guest_token as string | null;
    if (!token || data.rotate) {
      token = crypto.randomUUID().replace(/-/g, "");
      const { error: upErr } = await supabaseAdmin
        .from("lives")
        .update({ guest_token: token })
        .eq("id", live.id);
      if (upErr) throw new Error(upErr.message);
    }

    return { token, path: `/convidado/${live.id}?c=${token}`, title: live.title as string };
  });

/**
 * Public: exchange a guest code + name for a LiveKit token.
 * The guest gets a synthetic identity and a stage seat (host can demote/kick).
 */
export const joinLiveAsGuest = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        liveId: uuid,
        code: z.string().trim().min(8).max(64),
        displayName: z.string().trim().min(2).max(40),
        guestId: uuid.optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: live, error } = await supabaseAdmin
      .from("lives")
      .select("id, title, status, starts_at, guest_token")
      .eq("id", data.liveId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!live || !live.guest_token || live.guest_token !== data.code) {
      throw new Error("Link de convidado inválido ou expirado.");
    }
    if (live.status === "ended" || live.status === "published") {
      throw new Error("Esta sessão já terminou.");
    }
    {
      const startMs = live.starts_at ? new Date(live.starts_at as string).getTime() : 0;
      const st = live.status as string;
      const open =
        st === "live" ||
        st === "starting" ||
        (startMs > 0 && Date.now() >= startMs);
      if (!open) throw new Error("A sessão ainda não começou. Volta à hora marcada.");
    }

    const guestId = data.guestId ?? crypto.randomUUID();

    const { data: existing } = await supabaseAdmin
      .from("live_participants")
      .select("id, banned, role, on_stage, mic_allowed, cam_allowed, screen_allowed")
      .eq("live_id", live.id)
      .eq("user_id", guestId)
      .maybeSingle();
    if (existing?.banned) throw new Error("Já não tens acesso a esta sessão.");

    if (existing) {
      await supabaseAdmin
        .from("live_participants")
        .update({
          room: "main",
          left_at: null,
          joined_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          guest_name: data.displayName,
          is_guest: true,
        })
        .eq("id", existing.id);
    } else {
      // Guests join as regular attendees (audience). The host can promote them
      // to the stage afterwards — being a guest does not mean being a speaker.
      const { error: insErr } = await supabaseAdmin.from("live_participants").insert({
        live_id: live.id,
        user_id: guestId,
        role: "participant",
        room: "main",
        on_stage: false,
        mic_allowed: false,
        cam_allowed: false,
        screen_allowed: false,
        guest_name: data.displayName,
        is_guest: true,
        last_seen_at: new Date().toISOString(),
      });
      if (insErr) throw new Error(insErr.message);
    }


    const role = (existing?.role ?? "participant") as "host" | "cohost" | "speaker" | "participant" | "viewer";
    const onStage = Boolean(existing?.on_stage);
    const { mintLiveKitToken } = await import("@/lib/livekit.server");
    const { token, url } = await mintLiveKitToken({
      liveId: live.id,
      target: "main",
      userId: guestId,
      displayName: data.displayName,
      role,
      publishOverride: {
        mic: Boolean(existing?.mic_allowed) && onStage,
        cam: Boolean(existing?.cam_allowed) && onStage,
        screen: onStage,
      },
      ttlSeconds: 60 * 60 * 6,
    });

    return {
      token,
      url,
      guestId,
      onStage,
      title: live.title as string,
      status: live.status as string,
    };
  });

/**
 * Public: guest heartbeat — raise/lower hand and pick up stage promotions.
 * Returns a fresh LiveKit token whenever publish rights changed, so the guest
 * can reconnect with the right grants once the host invites them on stage.
 */
export const guestSync = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        liveId: uuid,
        code: z.string().trim().min(8).max(64),
        guestId: uuid,
        displayName: z.string().trim().min(2).max(40),
        raiseHand: z.boolean().optional(),
        currentlyOnStage: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: live } = await supabaseAdmin
      .from("lives")
      .select("id, status, guest_token")
      .eq("id", data.liveId)
      .maybeSingle();
    if (!live || !live.guest_token || live.guest_token !== data.code) {
      throw new Error("Link de convidado inválido ou expirado.");
    }

    // Heartbeat: mantém o convidado "vivo" na lista (evita fantasmas).
    {
      const patch: {
        last_seen_at: string;
        guest_name: string;
        is_guest: boolean;
        hand_raised_at?: string | null;
      } = {
        last_seen_at: new Date().toISOString(),
        guest_name: data.displayName,
        is_guest: true,
      };
      if (typeof data.raiseHand === "boolean") {
        patch.hand_raised_at = data.raiseHand ? new Date().toISOString() : null;
      }


      await supabaseAdmin
        .from("live_participants")
        .update(patch)
        .eq("live_id", live.id)
        .eq("user_id", data.guestId);
    }


    const { data: me } = await supabaseAdmin
      .from("live_participants")
      .select("role, on_stage, banned, hand_raised_at, mic_allowed, cam_allowed, screen_allowed")
      .eq("live_id", live.id)
      .eq("user_id", data.guestId)
      .maybeSingle();
    if (!me) throw new Error("Já não estás nesta sessão.");
    if (me.banned) throw new Error("Já não tens acesso a esta sessão.");

    const onStage = Boolean(me.on_stage);
    let token: string | null = null;
    if (onStage !== data.currentlyOnStage) {
      const { mintLiveKitToken } = await import("@/lib/livekit.server");
      const minted = await mintLiveKitToken({
        liveId: live.id,
        target: "main",
        userId: data.guestId,
        displayName: data.displayName,
        role: me.role as "host" | "cohost" | "speaker" | "participant" | "viewer",
        publishOverride: {
          mic: Boolean(me.mic_allowed) && onStage,
          cam: Boolean(me.cam_allowed) && onStage,
          screen: Boolean(me.screen_allowed) && onStage,
        },
        ttlSeconds: 60 * 60 * 6,
      });
      token = minted.token;
    }

    return {
      onStage,
      handRaised: Boolean(me.hand_raised_at),
      status: live.status as string,
      token,
    };
  });


/**
 * Public: lightweight info about a live for the guest landing page
 * (cover, title, scheduled start and whether the room is open).
 */
export const getGuestLiveInfo = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ liveId: uuid, code: z.string().trim().min(8).max(64) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: live, error } = await supabaseAdmin
      .from("lives")
      .select("id, title, description, status, starts_at, cover_url, guest_token")
      .eq("id", data.liveId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!live || !live.guest_token || live.guest_token !== data.code) {
      throw new Error("Link de convidado inválido ou expirado.");
    }
    const startsAt = live.starts_at as string | null;
    const status = live.status as string;
    const startMs = startsAt ? new Date(startsAt).getTime() : 0;
    // Room opens when the host starts it, or 10 min before the scheduled time.
    const open =
      status === "live" ||
      status === "starting" ||
      (startMs > 0 && Date.now() >= startMs);
    return {
      title: live.title as string,
      description: (live.description as string | null) ?? null,
      status,
      startsAt,
      coverUrl: (live.cover_url as string | null) ?? null,
      open,
      ended: status === "ended" || status === "published",
    };
  });

/** Public: guest left the room (tab closed / hangup) — frees the seat. */
export const guestLeave = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ liveId: uuid, code: z.string().trim().min(8).max(64), guestId: uuid }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: live } = await supabaseAdmin
      .from("lives")
      .select("id, guest_token")
      .eq("id", data.liveId)
      .maybeSingle();
    if (!live || live.guest_token !== data.code) return { ok: false };
    await supabaseAdmin
      .from("live_participants")
      .update({ left_at: new Date().toISOString(), on_stage: false, hand_raised_at: null })
      .eq("live_id", live.id)
      .eq("user_id", data.guestId);
    return { ok: true };
  });

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
      .select("id, title, status, guest_token")
      .eq("id", data.liveId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!live || !live.guest_token || live.guest_token !== data.code) {
      throw new Error("Link de convidado inválido ou expirado.");
    }
    if (live.status === "ended" || live.status === "published") {
      throw new Error("Esta sessão já terminou.");
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
        .update({ room: "main", left_at: null, joined_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      const { error: insErr } = await supabaseAdmin.from("live_participants").insert({
        live_id: live.id,
        user_id: guestId,
        role: "speaker",
        room: "main",
        on_stage: true,
        mic_allowed: true,
        cam_allowed: true,
        screen_allowed: true,
      });
      if (insErr) throw new Error(insErr.message);
    }

    const role = (existing?.role ?? "speaker") as "host" | "cohost" | "speaker" | "participant" | "viewer";
    const { mintLiveKitToken } = await import("@/lib/livekit.server");
    const { token, url } = await mintLiveKitToken({
      liveId: live.id,
      target: "main",
      userId: guestId,
      displayName: data.displayName,
      role,
      publishOverride: existing
        ? {
            mic: existing.mic_allowed && existing.on_stage,
            cam: existing.cam_allowed && existing.on_stage,
            screen: existing.screen_allowed && existing.on_stage,
          }
        : undefined,
      ttlSeconds: 60 * 60 * 6,
    });

    return {
      token,
      url,
      guestId,
      title: live.title as string,
      status: live.status as string,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MmcastEpisode = {
  id: string;
  episode_number: number;
  title: string;
  guest_name: string | null;
  youtube_url: string;
  youtube_video_id: string;
  thumbnail_url: string | null;
  short_description: string | null;
  full_description: string | null;
  category: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLS =
  "id, episode_number, title, guest_name, youtube_url, youtube_video_id, thumbnail_url, short_description, full_description, category, status, published_at, created_at, updated_at";

/** Extrai o ID do vídeo de qualquer formato de URL do YouTube. */
export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(
    /(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m?.[1] ?? null;
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

// ------------------------------------------------------------- área do aluno

export const listMmcastEpisodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mmcast_episodes")
      .select(COLS)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as MmcastEpisode[];
  });

export const getMmcastEpisode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: ep, error } = await context.supabase
      .from("mmcast_episodes")
      .select(COLS)
      .eq("id", data.id)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ep) throw new Error("Episódio não encontrado.");
    return ep as MmcastEpisode;
  });

// ------------------------------------------------------------------- admin

type AdminContext = {
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  userId: string;
};

async function requireAdmin(context: AdminContext) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Apenas administradores podem gerir o MMCast.");
}

export const adminListMmcastEpisodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("mmcast_episodes")
      .select(COLS)
      .order("episode_number", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as MmcastEpisode[];
  });

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  episode_number: z.number().int().min(1).max(100000),
  title: z.string().min(1).max(200),
  guest_name: z.string().max(120).nullish(),
  youtube_url: z.string().min(1).max(500),
  youtube_video_id: z.string().min(1).max(20),
  thumbnail_url: z.string().max(500).nullish(),
  short_description: z.string().max(500).nullish(),
  full_description: z.string().max(20000).nullish(),
  category: z.string().max(80).nullish(),
  published_at: z.string().max(40).nullish(),
});

export const adminSaveMmcastEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => saveSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const now = new Date().toISOString();
    const row = {
      episode_number: data.episode_number,
      title: data.title.trim(),
      guest_name: data.guest_name?.trim() || null,
      youtube_url: data.youtube_url.trim(),
      youtube_video_id: data.youtube_video_id.trim(),
      thumbnail_url: data.thumbnail_url?.trim() || youtubeThumbnail(data.youtube_video_id.trim()),
      short_description: data.short_description?.trim() || null,
      full_description: data.full_description?.trim() || null,
      category: data.category?.trim() || null,
      published_at: data.published_at || null,
      updated_at: now,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("mmcast_episodes")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("mmcast_episodes")
      .insert({ ...row, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const adminDeleteMmcastEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase
      .from("mmcast_episodes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Publica/despublica. Ao publicar, cria UMA notificação por aluno ativo
 * (acesso ao clube válido). O índice único + a verificação prévia garantem
 * que editar ou republicar nunca duplica notificações.
 */
export const adminSetMmcastStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), publish: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const now = new Date().toISOString();

    const { data: ep, error: readErr } = await context.supabase
      .from("mmcast_episodes")
      .select("id, status, published_at")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!ep) throw new Error("Episódio não encontrado.");

    if (!data.publish) {
      const { error } = await context.supabase
        .from("mmcast_episodes")
        .update({ status: "draft", updated_at: now })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, notified: 0 };
    }

    const { error } = await context.supabase
      .from("mmcast_episodes")
      .update({
        status: "published",
        published_at: ep.published_at ?? now,
        updated_at: now,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const notified = await fanOutMmcastNotifications(data.id);
    return { ok: true, notified };
  });

async function fanOutMmcastNotifications(episodeId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();

  const { data: grants, error } = await supabaseAdmin
    .from("entitlement_grants")
    .select("user_id")
    .eq("feature_key", "academy.access")
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${now}`);
  if (error) throw new Error(error.message);

  const userIds = Array.from(
    new Set((grants ?? []).map((g) => g.user_id as string)),
  );
  if (userIds.length === 0) return 0;

  const { data: existing } = await supabaseAdmin
    .from("notifications")
    .select("user_id")
    .eq("kind", "mmcast")
    .eq("mmcast_episode_id", episodeId);
  const already = new Set((existing ?? []).map((r) => r.user_id as string));

  const pending = userIds.filter((id) => !already.has(id));
  for (let i = 0; i < pending.length; i += 500) {
    const batch = pending.slice(i, i + 500).map((uid) => ({
      user_id: uid,
      kind: "mmcast",
      mmcast_episode_id: episodeId,
    }));
    const { error: insErr } = await supabaseAdmin
      .from("notifications")
      .insert(batch);
    if (insErr) throw new Error(insErr.message);
  }
  return pending.length;
}

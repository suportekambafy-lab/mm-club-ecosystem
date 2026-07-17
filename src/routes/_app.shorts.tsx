import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Volume2, VolumeX, Plus, X, Upload, Trash2, Eye, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { VerifiedBadge } from "@/components/mm/verified-badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/shorts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MM Shorts — MM Club" },
      { name: "description", content: "Vídeos verticais dos membros do MM Club." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ShortsPage,
});

type ShortRow = {
  id: string;
  author_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  views_count: number;
  likes_count: number;
  created_at: string;
};

type ShortWithAuthor = ShortRow & {
  author: { display_name: string | null; avatar_url: string | null; verified: boolean } | null;
  liked: boolean;
};

async function resolveAvatar(pathOrUrl: string | null): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(pathOrUrl, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

function ShortsPage() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [uploaderOpen, setUploaderOpen] = useState(false);

  const shortsQuery = useQuery<ShortWithAuthor[]>({
    queryKey: ["mm-shorts", user?.id ?? "anon"],
    queryFn: async () => {
      const { data: shorts, error } = await supabase
        .from("mm_shorts")
        .select("id, author_id, video_url, thumbnail_url, caption, views_count, likes_count, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (shorts ?? []) as ShortRow[];
      if (rows.length === 0) return [];
      const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", authorIds);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", authorIds);
      const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));

      const profList = profiles ?? [];
      const signed = await Promise.all(profList.map((p) => resolveAvatar(p.avatar_url)));
      const authorMap = new Map(profList.map((p, i) => [p.id, { ...p, signedAvatar: signed[i] }]));

      let likedIds = new Set<string>();
      if (user) {
        const { data: likes } = await supabase
          .from("mm_short_likes")
          .select("short_id")
          .eq("user_id", user.id)
          .in("short_id", rows.map((r) => r.id));
        likedIds = new Set((likes ?? []).map((l) => l.short_id));
      }

      return rows.map((r): ShortWithAuthor => {
        const a = authorMap.get(r.author_id);
        return {
          ...r,
          author: a
            ? { display_name: a.display_name, avatar_url: a.signedAvatar, verified: adminIds.has(a.id) }
            : null,
          liked: likedIds.has(r.id),
        };
      });
    },
  });

  const shorts = shortsQuery.data ?? [];

  const toggleLike = useMutation({
    mutationFn: async ({ shortId, liked }: { shortId: string; liked: boolean }) => {
      if (!user) throw new Error("Precisas de sessão");
      if (liked) {
        await supabase.from("mm_short_likes").delete().eq("short_id", shortId).eq("user_id", user.id);
      } else {
        await supabase.from("mm_short_likes").insert({ short_id: shortId, user_id: user.id });
      }
    },
    onMutate: async ({ shortId, liked }) => {
      await qc.cancelQueries({ queryKey: ["mm-shorts", user?.id ?? "anon"] });
      const prev = qc.getQueryData<ShortWithAuthor[]>(["mm-shorts", user?.id ?? "anon"]);
      qc.setQueryData<ShortWithAuthor[]>(["mm-shorts", user?.id ?? "anon"], (old) =>
        (old ?? []).map((s) =>
          s.id === shortId
            ? { ...s, liked: !liked, likes_count: Math.max(0, s.likes_count + (liked ? -1 : 1)) }
            : s,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["mm-shorts", user?.id ?? "anon"], ctx.prev);
      toast.error("Não foi possível registar o gosto.");
    },
  });

  const removeShort = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mm_shorts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Short eliminado.");
      qc.invalidateQueries({ queryKey: ["mm-shorts"] });
    },
    onError: () => toast.error("Não foi possível eliminar."),
  });

  return (
    <div className="fixed inset-0 z-30 bg-black">
      {/* Feed */}
      {shortsQuery.isLoading ? (
        <div className="flex h-full items-center justify-center text-sm text-white/60">A carregar…</div>
      ) : shorts.length === 0 ? (
        <EmptyState onCreate={() => setUploaderOpen(true)} />
      ) : (
        <ShortsFeed
          shorts={shorts}
          currentUserId={user?.id}
          onToggleLike={(s) => toggleLike.mutate({ shortId: s.id, liked: s.liked })}
          onDelete={(id) => {
            if (confirm("Eliminar este Short?")) removeShort.mutate(id);
          }}
        />
      )}

      {/* Floating create button */}
      <button
        onClick={() => setUploaderOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/90 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-black/60 hover:text-white lg:left-[calc(16rem+1rem)]"
        aria-label="Publicar MM Short"
      >
        <Plus className="h-5 w-5" strokeWidth={2} />
      </button>

      {uploaderOpen && user && (
        <UploaderModal
          userId={user.id}
          onClose={() => setUploaderOpen(false)}
          onCreated={() => {
            setUploaderOpen(false);
            qc.invalidateQueries({ queryKey: ["mm-shorts"] });
          }}
        />
      )}
    </div>
  );
}

// ---------------- Feed ----------------

function ShortsFeed({
  shorts,
  currentUserId,
  onToggleLike,
  onDelete,
}: {
  shorts: ShortWithAuthor[];
  currentUserId: string | undefined;
  onToggleLike: (s: ShortWithAuthor) => void;
  onDelete: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const viewedRef = useRef<Set<string>>(new Set());

  // IntersectionObserver to detect active short
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const items = container.querySelectorAll<HTMLElement>("[data-short-idx]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.shortIdx);
            setActiveIdx(idx);
          }
        });
      },
      { root: container, threshold: [0, 0.6, 1] },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [shorts.length]);

  // Count view when a short becomes active (once per session)
  useEffect(() => {
    const s = shorts[activeIdx];
    if (!s || viewedRef.current.has(s.id)) return;
    viewedRef.current.add(s.id);
    supabase.rpc("mm_short_increment_view", { _short_id: s.id }).then(() => {});
  }, [activeIdx, shorts]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
      style={{ scrollbarWidth: "none" }}
    >
      {shorts.map((s, i) => (
        <ShortItem
          key={s.id}
          idx={i}
          short={s}
          active={i === activeIdx}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onToggleLike={() => onToggleLike(s)}
          onDelete={() => onDelete(s.id)}
          canDelete={currentUserId === s.author_id}
        />
      ))}
    </div>
  );
}

function ShortItem({
  idx,
  short,
  active,
  muted,
  onToggleMute,
  onToggleLike,
  onDelete,
  canDelete,
}: {
  idx: number;
  short: ShortWithAuthor;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onToggleLike: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      v.currentTime = 0;
      v.play().catch(() => {});
      setPaused(false);
    } else {
      v.pause();
    }
  }, [active]);

  const initials = useMemo(() => {
    const n = short.author?.display_name ?? "Membro";
    return n
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }, [short.author?.display_name]);

  const togglePause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <section
      data-short-idx={idx}
      className="relative flex h-full w-full snap-start snap-always items-center justify-center"
    >
      <div className="relative flex h-full w-full items-center justify-center bg-black sm:h-full">
        <div className="relative h-full w-full sm:aspect-[9/16] sm:h-full sm:w-auto sm:max-w-[min(100%,calc(100vh*9/16))]">
          <video
            ref={videoRef}
            src={short.video_url}
            poster={short.thumbnail_url ?? undefined}
            className="h-full w-full object-cover"
            loop
            muted={muted}
            playsInline
            preload="metadata"
            onClick={togglePause}
          />
          {paused && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/50 p-5 backdrop-blur">
                <Play className="h-10 w-10 text-white" fill="white" />
              </div>
            </div>
          )}

          {/* Bottom gradient + info */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-16 lg:pb-4">
            <div className="pointer-events-auto flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-white/20">
                {short.author?.avatar_url ? (
                  <img src={short.author.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  initials || "M"
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-semibold text-white">
                  <span className="truncate">{short.author?.display_name ?? "Membro MM"}</span>
                  {short.author?.verified && <VerifiedBadge size={14} className="shrink-0" />}
                </p>
                <p className="flex items-center gap-1 text-[11px] text-white/60">
                  <Eye className="h-3 w-3" /> {short.views_count.toLocaleString("pt-PT")} visualizações
                </p>
              </div>
            </div>
            {short.caption && (
              <p className="mt-3 max-w-[80%] whitespace-pre-wrap text-sm leading-snug text-white/95">
                {short.caption}
              </p>
            )}
          </div>

          {/* Right rail: actions */}
          <div className="absolute right-3 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] flex flex-col items-center gap-4 lg:bottom-24">
            <button
              onClick={onToggleLike}
              className="flex flex-col items-center gap-1"
              aria-label={short.liked ? "Retirar gosto" : "Gostar"}
            >
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur transition",
                  short.liked && "bg-red-500/90",
                )}
              >
                <Heart
                  className={cn("h-6 w-6", short.liked ? "text-white" : "text-white")}
                  fill={short.liked ? "white" : "none"}
                />
              </span>
              <span className="text-[11px] font-semibold text-white drop-shadow">
                {short.likes_count.toLocaleString("pt-PT")}
              </span>
            </button>
            <button
              onClick={onToggleMute}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur"
              aria-label={muted ? "Ativar som" : "Silenciar"}
            >
              {muted ? <VolumeX className="h-5 w-5 text-white" /> : <Volume2 className="h-5 w-5 text-white" />}
            </button>
            {canDelete && (
              <button
                onClick={onDelete}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur"
                aria-label="Eliminar"
              >
                <Trash2 className="h-5 w-5 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------- Empty State ----------------

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div className="max-w-sm space-y-4 text-white">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/40">
          <Play className="h-7 w-7 text-primary" fill="currentColor" />
        </div>
        <h1 className="text-2xl font-semibold">Ainda não há MM Shorts</h1>
        <p className="text-sm text-white/70">
          Publica o primeiro vídeo vertical do clube. Bastidores, insights, momentos — máx. 60 segundos.
        </p>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Upload className="h-4 w-4" /> Publicar Short
        </button>
      </div>
    </div>
  );
}

// ---------------- Uploader ----------------

function UploaderModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback((f: File) => {
    if (!f.type.startsWith("video/")) {
      toast.error("Escolhe um ficheiro de vídeo.");
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      toast.error("Vídeo demasiado grande (máx. 100 MB).");
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const publish = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `shorts/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("community-media")
        .upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
      if (upErr) throw upErr;
      const { data, error } = await supabase.storage
        .from("community-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (error || !data) throw error ?? new Error("Falha ao gerar URL do vídeo");

      const { error: insertErr } = await supabase.from("mm_shorts").insert({
        author_id: userId,
        video_url: data.signedUrl,
        caption: caption.trim() || null,
      });
      if (insertErr) throw insertErr;

      toast.success("MM Short publicado!");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao publicar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Publicar MM Short</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-[9/16] w-full max-w-[220px] mx-auto flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface-2 text-sm text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
            >
              <Upload className="h-8 w-8" />
              <span className="px-4 text-center">Escolher vídeo vertical<br /><span className="text-[11px] text-muted-foreground/70">MP4 · até 100 MB · até 60s</span></span>
            </button>
          ) : (
            <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-xl bg-black">
              {previewUrl && (
                <video src={previewUrl} controls playsInline muted className="h-full w-full object-cover" />
              )}
              <button
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                }}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                aria-label="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pick(f);
              e.target.value = "";
            }}
          />

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Legenda
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 300))}
              rows={3}
              placeholder="Diz algo sobre o teu Short…"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{caption.length}/300</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm text-foreground transition hover:bg-surface-3"
            >
              Cancelar
            </button>
            <button
              onClick={publish}
              disabled={!file || busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "A publicar…" : "Publicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

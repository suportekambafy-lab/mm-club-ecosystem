import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Volume2, VolumeX, Plus, X, Upload, Trash2, Eye, Play, MessageCircle, ArrowUp, CornerDownRight, MoreHorizontal, Share2, Link2, Flag } from "lucide-react";
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
  comments_count: number;
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
  const [upload, setUpload] = useState<{ progress: number; status: "uploading" | "processing" | "done" | "error"; error?: string } | null>(null);

  const startUpload = useCallback(
    async (file: File, caption: string) => {
      if (!user) return;
      setUpload({ progress: 0, status: "uploading" });
      try {
        const ext = file.name.split(".").pop() || "mp4";
        const path = `shorts/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { data: signed, error: signErr } = await supabase.storage
          .from("community-media")
          .createSignedUploadUrl(path);
        if (signErr || !signed) throw signErr ?? new Error("Falha ao preparar upload");

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", signed.signedUrl, true);
          xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const pct = Math.round((evt.loaded / evt.total) * 100);
              setUpload((u) => (u ? { ...u, progress: pct } : u));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload falhou (${xhr.status})`));
          };
          xhr.onerror = () => reject(new Error("Erro de rede no upload"));
          xhr.send(file);
        });

        setUpload({ progress: 100, status: "processing" });

        const { data: urlData, error: urlErr } = await supabase.storage
          .from("community-media")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
        if (urlErr || !urlData) throw urlErr ?? new Error("Falha ao gerar URL do vídeo");

        const { error: insertErr } = await supabase.from("mm_shorts").insert({
          author_id: user.id,
          video_url: urlData.signedUrl,
          caption: caption.trim() || null,
        });
        if (insertErr) throw insertErr;

        setUpload({ progress: 100, status: "done" });
        toast.success("MM Short publicado!");
        qc.invalidateQueries({ queryKey: ["mm-shorts"] });
        setTimeout(() => setUpload(null), 1500);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha ao publicar";
        setUpload({ progress: 0, status: "error", error: msg });
        toast.error(msg);
        setTimeout(() => setUpload(null), 4000);
      }
    },
    [user, qc],
  );

  const shortsQuery = useQuery<ShortWithAuthor[]>({
    queryKey: ["mm-shorts", user?.id ?? "anon"],
    queryFn: async () => {
      const { data: shorts, error } = await supabase
        .from("mm_shorts")
        .select("id, author_id, video_url, thumbnail_url, caption, views_count, likes_count, comments_count, created_at")
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
    <div className="fixed inset-0 z-30 h-[100dvh] max-h-[100dvh] overflow-hidden bg-black">
      {/* Feed */}
      {shortsQuery.isLoading ? (
        <div className="flex h-[100dvh] items-center justify-center text-sm text-white/60">A carregar…</div>
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
        className="fixed left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-40 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/90 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-black/60 hover:text-white lg:left-[calc(16rem+1rem)] lg:top-4"
        aria-label="Publicar MM Short"
      >
        <Plus className="h-5 w-5" strokeWidth={2} />
      </button>

      {/* Progress bar at top while uploading */}
      {upload && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:pl-[calc(16rem+0.75rem)] lg:pt-3">
          <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-white shadow-lg backdrop-blur-md">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {upload.status === "uploading" && `A enviar… ${upload.progress}%`}
                {upload.status === "processing" && "A processar…"}
                {upload.status === "done" && "Publicado!"}
                {upload.status === "error" && (upload.error ?? "Falha no upload")}
              </p>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-200",
                    upload.status === "error" ? "bg-red-500" : "bg-primary",
                    upload.status === "processing" && "animate-pulse",
                  )}
                  style={{ width: `${upload.status === "processing" ? 100 : upload.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {uploaderOpen && user && (
        <UploaderModal
          onClose={() => setUploaderOpen(false)}
          onSubmit={(file, caption) => {
            setUploaderOpen(false);
            void startUpload(file, caption);
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

  const [commentsFor, setCommentsFor] = useState<ShortWithAuthor | null>(null);

  useEffect(() => {
    if (!commentsFor) return;
    const html = document.documentElement;
    html.setAttribute("data-shorts-comments", "open");
    return () => {
      html.removeAttribute("data-shorts-comments");
    };
  }, [commentsFor]);

  const commentsOpen = !!commentsFor;

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <div
        ref={containerRef}
        className={cn(
          "w-full snap-y snap-mandatory overflow-y-auto overscroll-contain transition-[height] duration-300 ease-out",
          commentsOpen ? "h-[40dvh]" : "h-[100dvh]",
        )}
        style={{ scrollbarWidth: "none" }}
      >
        {shorts.map((s, i) => (
          <ShortItem
            key={s.id}
            idx={i}
            short={s}
            active={i === activeIdx}
            compact={commentsOpen}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onToggleLike={() => onToggleLike(s)}
            onOpenComments={() => setCommentsFor(s)}
            onCloseComments={() => setCommentsFor(null)}
            commentsOpen={commentsOpen}
            onDelete={() => onDelete(s.id)}
            canDelete={currentUserId === s.author_id}
          />
        ))}
      </div>
      {commentsFor && (
        <CommentsDrawer
          short={commentsFor}
          currentUserId={currentUserId}
          onClose={() => setCommentsFor(null)}
        />
      )}
    </div>
  );
}

function ShortItem({
  idx,
  short,
  active,
  compact = false,
  muted,
  onToggleMute,
  onToggleLike,
  onOpenComments,
  onCloseComments,
  commentsOpen,
  onDelete,
  canDelete,
}: {
  idx: number;
  short: ShortWithAuthor;
  active: boolean;
  compact?: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onToggleLike: () => void;
  onOpenComments: () => void;
  onCloseComments: () => void;
  commentsOpen: boolean;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/shorts?v=${short.id}` : "";

  const handleShare = async () => {
    setMenuOpen(false);
    try {
      if (navigator.share) {
        await navigator.share({ title: "MM Short", text: short.caption ?? "", url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copiado");
      }
    } catch {}
  };

  const handleCopyLink = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const html = document.documentElement;
    html.setAttribute("data-shorts-composer", "open");
    return () => html.removeAttribute("data-shorts-composer");
  }, [menuOpen]);



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

  const handleVideoTap = () => {
    if (commentsOpen) {
      onCloseComments();
      return;
    }
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
      className="relative flex h-full min-h-full w-full snap-start snap-always items-center justify-center"
    >
      <div className="relative flex h-full w-full items-center justify-center bg-black">
        <div className={cn("relative h-full w-full", !compact && "sm:aspect-[9/16] sm:h-full sm:w-auto sm:max-w-[min(100%,calc(100dvh*9/16))]") }>
          <video
            ref={videoRef}
            src={short.video_url}
            poster={short.thumbnail_url ?? undefined}
            className={cn("h-full w-full", compact ? "object-contain" : "object-cover object-top")}
            loop
            muted={muted}
            playsInline
            preload="metadata"
            onClick={handleVideoTap}
          />
          {paused && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/50 p-5 backdrop-blur">
                <Play className="h-10 w-10 text-white" fill="white" />
              </div>
            </div>
          )}

          {!compact && (
            <>
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
                  "flex h-11 w-11 items-center justify-center transition",
                  short.liked && "text-red-500",
                )}
              >
                <Heart
                  className="h-8 w-8 text-white drop-shadow-lg"
                  fill={short.liked ? "currentColor" : "none"}
                />
              </span>
              <span className="text-[11px] font-semibold text-white drop-shadow">
                {short.likes_count.toLocaleString("pt-PT")}
              </span>
            </button>
            <button
              onClick={onOpenComments}
              className="flex flex-col items-center gap-1"
              aria-label="Abrir comentários"
            >
              <span className="flex h-11 w-11 items-center justify-center">
                <MessageCircle className="h-8 w-8 text-white drop-shadow-lg" />
              </span>
              <span className="text-[11px] font-semibold text-white drop-shadow">
                {short.comments_count.toLocaleString("pt-PT")}
              </span>
            </button>
            <button
              onClick={onToggleMute}
              className="flex h-11 w-11 items-center justify-center"
              aria-label={muted ? "Ativar som" : "Silenciar"}
            >
              {muted ? <VolumeX className="h-7 w-7 text-white drop-shadow-lg" /> : <Volume2 className="h-7 w-7 text-white drop-shadow-lg" />}
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              className="flex h-11 w-11 items-center justify-center"
              aria-label="Mais opções"
            >
              <MoreHorizontal className="h-7 w-7 text-white drop-shadow-lg" />
            </button>
          </div>
            </>
          )}

          {menuOpen && (
            <div
              className="absolute inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-t-2xl bg-neutral-900 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] text-white shadow-2xl ring-1 ring-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/25" />
                <div className="px-2 py-2">
                  <button
                    onClick={handleShare}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] transition hover:bg-white/5"
                  >
                    <Share2 className="h-5 w-5" />
                    Partilhar
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] transition hover:bg-white/5"
                  >
                    <Link2 className="h-5 w-5" />
                    Copiar link
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      toast.success("Denúncia enviada. Obrigado.");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] transition hover:bg-white/5"
                  >
                    <Flag className="h-5 w-5" />
                    Denunciar
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] text-red-400 transition hover:bg-red-500/10"
                    >
                      <Trash2 className="h-5 w-5" />
                      Eliminar
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="mx-2 mb-2 w-[calc(100%-1rem)] rounded-xl bg-white/5 py-3 text-sm font-semibold transition hover:bg-white/10"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
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
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (file: File, caption: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback((f: File) => {
    if (!f.type.startsWith("video/")) {
      toast.error("Escolhe um ficheiro de vídeo.");
      return;
    }
    if (f.size > 2 * 1024 * 1024 * 1024) {
      toast.error("Vídeo demasiado grande (máx. 2 GB).");
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

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-shorts-composer", "open");
    return () => {
      html.removeAttribute("data-shorts-composer");
    };
  }, []);

  const publish = () => {
    if (!file) return;
    onSubmit(file, caption);
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
              disabled={!file}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              Publicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Comments Drawer ----------------

type CommentRow = {
  id: string;
  short_id: string;
  user_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
};

type CommentWithAuthor = CommentRow & {
  author: { display_name: string | null; avatar_url: string | null; verified: boolean } | null;
};

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}sem`;
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

const QUICK_EMOJIS = ["❤️", "🔥", "👏", "😂", "😍", "😮", "🙌", "💯"];

function CommentsDrawer({
  short,
  currentUserId,
  onClose,
}: {
  short: ShortWithAuthor;
  currentUserId: string | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<CommentWithAuthor | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commentsQuery = useQuery<CommentWithAuthor[]>({
    queryKey: ["mm-short-comments", short.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mm_short_comments")
        .select("id, short_id, user_id, body, parent_id, created_at")
        .eq("short_id", short.id)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      const rows = (data ?? []) as CommentRow[];
      if (rows.length === 0) return [];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      const profList = profs ?? [];
      const signed = await Promise.all(profList.map((p) => resolveAvatar(p.avatar_url)));
      const map = new Map(profList.map((p, i) => [p.id, { ...p, signedAvatar: signed[i] }]));
      return rows.map((r) => {
        const a = map.get(r.user_id);
        return {
          ...r,
          author: a
            ? { display_name: a.display_name, avatar_url: a.signedAvatar, verified: adminIds.has(a.id) }
            : null,
        };
      });
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`short-comments:${short.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mm_short_comments", filter: `short_id=eq.${short.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["mm-short-comments", short.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [short.id, qc]);

  const comments = commentsQuery.data ?? [];

  const { topLevel, repliesByParent } = useMemo(() => {
    const top: CommentWithAuthor[] = [];
    const map = new Map<string, CommentWithAuthor[]>();
    for (const c of comments) {
      if (c.parent_id) {
        const arr = map.get(c.parent_id) ?? [];
        arr.push(c);
        map.set(c.parent_id, arr);
      } else {
        top.push(c);
      }
    }
    return { topLevel: top, repliesByParent: map };
  }, [comments]);

  const startReply = (c: CommentWithAuthor) => {
    setReplyTo(c);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const insertEmoji = (emoji: string) => {
    setText((t) => (t + emoji).slice(0, 500));
    inputRef.current?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !currentUserId || sending) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from("mm_short_comments")
        .insert({
          short_id: short.id,
          user_id: currentUserId,
          body,
          parent_id: replyTo?.parent_id ?? replyTo?.id ?? null,
        });
      if (error) throw error;
      setText("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["mm-short-comments", short.id] });
      qc.setQueryData<ShortWithAuthor[]>(["mm-shorts", currentUserId ?? "anon"], (old) =>
        (old ?? []).map((s) => (s.id === short.id ? { ...s, comments_count: s.comments_count + 1 } : s)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    const prev = comments;
    qc.setQueryData<CommentWithAuthor[]>(["mm-short-comments", short.id], (old) =>
      (old ?? []).filter((c) => c.id !== id && c.parent_id !== id),
    );
    const { error } = await supabase.from("mm_short_comments").delete().eq("id", id);
    if (error) {
      qc.setQueryData(["mm-short-comments", short.id], prev);
      toast.error("Não foi possível eliminar.");
    } else {
      qc.setQueryData<ShortWithAuthor[]>(["mm-shorts", currentUserId ?? "anon"], (old) =>
        (old ?? []).map((s) =>
          s.id === short.id ? { ...s, comments_count: Math.max(0, s.comments_count - 1) } : s,
        ),
      );
    }
  };

  const renderComment = (c: CommentWithAuthor, isReply = false) => {
    const mine = c.user_id === currentUserId;
    const initials = (c.author?.display_name ?? "M")
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
    return (
      <div key={c.id} className={cn("flex gap-3", isReply && "ml-10")}>
        <div className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground",
          isReply ? "h-7 w-7 text-[10px]" : "h-9 w-9",
        )}>
          {c.author?.avatar_url ? (
            <img src={c.author.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials || "M"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-semibold">{c.author?.display_name ?? "Membro MM"}</span>
            {c.author?.verified && <VerifiedBadge size={12} />}
            <span className="text-[11px] text-white/50">{timeAgo(c.created_at)}</span>
          </p>
          <p className="whitespace-pre-wrap break-words text-sm text-white/90">{c.body}</p>
          {currentUserId && (
            <button
              onClick={() => startReply(c)}
              className="mt-1 text-[11px] font-medium text-white/50 transition hover:text-white"
            >
              Responder
            </button>
          )}
        </div>
        {mine && (
          <button
            onClick={() => remove(c.id)}
            className="shrink-0 self-start rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className="relative z-[70] flex h-[60dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-neutral-900 text-white shadow-2xl"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/25" />
      </div>
      <div className="flex items-center justify-between px-4 pb-3 pt-2">
        <h3 className="text-sm font-semibold">
          {short.comments_count.toLocaleString("pt-PT")} comentário
          {short.comments_count === 1 ? "" : "s"}
        </h3>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {commentsQuery.isLoading ? (
          <p className="pt-10 text-center text-xs text-white/50">A carregar…</p>
        ) : topLevel.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 pt-20 text-center">
            <p className="text-sm font-semibold">Ainda sem comentários</p>
            <p className="text-xs text-white/50">Sê o primeiro a comentar.</p>
          </div>
        ) : (
          topLevel.map((c) => (
            <div key={c.id} className="space-y-3">
              {renderComment(c)}
              {(repliesByParent.get(c.id) ?? []).map((r) => renderComment(r, true))}
            </div>
          ))
        )}
      </div>

      {currentUserId && (
        <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => insertEmoji(e)}
              className="shrink-0 rounded-full px-2 py-1 text-lg transition hover:bg-white/10"
              aria-label={`Adicionar ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {replyTo && (
        <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-white/5 px-4 py-2 text-[11px] text-white/70">
          <span className="flex items-center gap-1.5 truncate">
            <CornerDownRight className="h-3 w-3 shrink-0" />
            A responder a <span className="font-semibold text-white">{replyTo.author?.display_name ?? "Membro MM"}</span>
          </span>
          <button
            onClick={() => setReplyTo(null)}
            className="shrink-0 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Cancelar resposta"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form
        onSubmit={submit}
        className="border-t border-white/10 bg-neutral-900 px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
      >
        {currentUserId ? (
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              placeholder={replyTo ? `Responder a ${replyTo.author?.display_name ?? "…"}…` : "Adiciona um comentário…"}
              className="flex-1 rounded-full bg-white/10 py-2.5 pl-4 pr-12 text-[16px] text-white placeholder:text-white/40 outline-none ring-1 ring-transparent focus:ring-white/30"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="absolute right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
              aria-label="Enviar"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <p className="w-full text-center text-xs text-white/60">Inicia sessão para comentar.</p>
        )}
      </form>
    </div>
  );
}

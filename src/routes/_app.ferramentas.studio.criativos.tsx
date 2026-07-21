import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Download, Trash2, Image as ImageIcon, Film, X, Loader2, Sparkles, Play } from "lucide-react";
import { listAssets, deleteAsset, startVideoGeneration, pollVideoGeneration } from "@/lib/studio.functions";
import { VideoPlaylist } from "@/components/mm/video-playlist";
import { useStudio } from "@/lib/studio-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ferramentas/studio/criativos")({
  component: CriativosPage,
});

type AssetRow = {
  id: string;
  kind: "image" | "video";
  url: string;
  thumb_url: string | null;
  format: string | null;
  style: string | null;
  product_id: string | null;
  credits_used: number;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

function CriativosPage() {
  const [tab, setTab] = useState<"all" | "image" | "video">("all");
  const [active, setActive] = useState<AssetRow | null>(null);
  const fn = useServerFn(listAssets);
  const del = useServerFn(deleteAsset);
  const poll = useServerFn(pollVideoGeneration);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["studio", "assets", tab],
    queryFn: () => fn({ data: { kind: tab } }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio", "assets"] });
      setActive(null);
    },
  });

  const rows = (data ?? []) as AssetRow[];

  // Auto-poll any pending video assets so progress continues even after leaving the videos page.
  useEffect(() => {
    const pendings = rows.filter(
      (r) => r.kind === "video" && (r.metadata as { status?: string } | null)?.status === "pending",
    );
    if (pendings.length === 0) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    async function tick(id: string) {
      if (cancelled) return;
      try {
        const r = await poll({ data: { assetId: id } });
        if (cancelled) return;
        if (r.status === "ready" || r.status === "failed") {
          qc.invalidateQueries({ queryKey: ["studio", "assets"] });
          return;
        }
      } catch {
        /* keep trying */
      }
      timers.push(setTimeout(() => tick(id), 8000));
    }
    for (const p of pendings) tick(p.id);
    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
    };
  }, [rows, poll, qc]);


  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["all", "image", "video"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-medium transition",
              tab === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-1 text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "all" ? "Todos" : k === "image" ? "Imagens" : "Vídeos"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface-1 p-12 text-center">
          <p className="text-sm text-muted-foreground">Ainda não geraste nenhum criativo. Começa em <span className="text-foreground">IA de Imagens</span>.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {rows.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setActive(a)}
              className="group relative block overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-black text-left"
            >
              {a.kind === "image" ? (
                <img src={a.thumb_url ?? a.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              ) : (
                <VideoThumb src={a.url} poster={a.thumb_url} />
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-2">
                <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur">
                  {a.kind === "image" ? <ImageIcon className="inline h-2.5 w-2.5" /> : <Film className="inline h-2.5 w-2.5" />} {a.style ?? ""}
                </span>
                <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur">-{a.credits_used}</span>
              </div>
              {a.kind === "video" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-80 transition group-hover:opacity-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur">
                    <Play className="h-5 w-5 text-white" fill="white" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {active && (
        <AssetModal
          asset={active}
          onClose={() => setActive(null)}
          onDelete={() => removeMut.mutate(active.id)}
        />
      )}
    </div>
  );
}

function VideoThumb({ src, poster }: { src: string; poster: string | null }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  return (
    <div
      className="relative aspect-square w-full overflow-hidden bg-surface-2"
      onMouseEnter={() => { const v = ref.current; if (v) { v.currentTime = 0; v.play().catch(() => {}); } }}
      onMouseLeave={() => { const v = ref.current; if (v) { v.pause(); v.currentTime = 0; } }}
    >
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted
        playsInline
        loop
        preload="metadata"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function AssetModal({ asset, onClose, onDelete }: { asset: AssetRow; onClose: () => void; onDelete: () => void }) {
  const { refresh } = useStudio();
  const start = useServerFn(startVideoGeneration);
  const poll = useServerFn(pollVideoGeneration);
  const qc = useQueryClient();

  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function loopPoll(assetId: string) {
    if (timer.current) clearTimeout(timer.current);
    try {
      const r = await poll({ data: { assetId } });
      if (r.status === "ready") {
        setBusy(false);
        setStatus("");
        refresh();
        qc.invalidateQueries({ queryKey: ["studio", "assets"] });
        onClose();
        return;
      }
      if (r.status === "failed") {
        setError(r.error ?? "Falhou");
        setBusy(false);
        setStatus("");
        refresh();
        return;
      }
      setStatus("A renderizar novo vídeo… 1–3 min.");
      timer.current = setTimeout(() => loopPoll(assetId), 8000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no polling");
      setBusy(false);
    }
  }

  async function onRemix() {
    if (!prompt.trim()) return;
    setError(null);
    setBusy(true);
    setStatus("A iniciar geração…");
    const meta = (asset.metadata ?? {}) as { productId?: string | null; duration?: number; objective?: string };
    try {
      const r = await start({
        data: {
          productId: meta.productId ?? asset.product_id ?? null,
          style: asset.style || "cinematic",
          format: (asset.format || "reels") as "reels" | "tiktok" | "facebook" | "stories" | "shorts",
          duration: typeof meta.duration === "number" ? meta.duration : 8,
          objective: meta.objective,
          notes: prompt.trim(),
        },
      });
      refresh();
      loopPoll(r.assetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao iniciar");
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur" onClick={onClose}>
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-4 md:p-6" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80">
          <X className="h-4 w-4" />
        </button>

        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-2xl bg-black">
            {asset.kind === "video" ? (
              <video src={asset.url} poster={asset.thumb_url ?? undefined} controls autoPlay playsInline className="h-full max-h-[70vh] w-full object-contain" />
            ) : (
              <img src={asset.url} alt="" className="h-full max-h-[70vh] w-full object-contain" />
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              {asset.style && <span className="rounded-full border border-[color:var(--hairline)] px-2 py-1">{asset.style}</span>}
              {asset.format && <span className="rounded-full border border-[color:var(--hairline)] px-2 py-1">{asset.format}</span>}
              <span className="rounded-full border border-[color:var(--hairline)] px-2 py-1">-{asset.credits_used} cr</span>
            </div>

            <div className="flex flex-col gap-2">
              <a href={asset.url} download target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-semibold text-background">
                <Download className="h-4 w-4" /> Descarregar
              </a>
              <button type="button" onClick={() => { if (confirm("Eliminar este criativo?")) onDelete(); }} className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--hairline)] bg-background/40 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" /> Eliminar
              </button>
            </div>

            {asset.kind === "video" && (
              <div className="mt-2 rounded-2xl border border-[color:var(--hairline)] bg-background/40 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">
                  <Sparkles className="h-3 w-3" /> Remix com prompt
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="Ex.: refaz com câmara a orbitar, luz dourada ao pôr-do-sol…"
                  className="w-full rounded-xl border border-[color:var(--hairline)] bg-background/40 px-3 py-2 text-sm"
                  disabled={busy}
                />
                <button type="button" onClick={onRemix} disabled={busy || !prompt.trim()} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {busy ? "A gerar…" : "Gerar novo vídeo"}
                </button>
                {status && !error && <p className="mt-2 text-[11px] text-muted-foreground">{status}</p>}
                {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
                <p className="mt-2 text-[10px] text-muted-foreground">Cria um novo criativo — o original mantém-se.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

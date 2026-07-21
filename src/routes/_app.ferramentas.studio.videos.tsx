import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Film, Loader2, Sparkles, Play, Download } from "lucide-react";
import { useStudio } from "@/lib/studio-context";
import { startVideoGeneration, pollVideoGeneration } from "@/lib/studio.functions";
import { VIDEO_STYLES, VIDEO_FORMATS, VIDEO_DURATIONS, VIDEO_OBJECTIVES, videoCost, videoSegments } from "@/lib/studio-config";
import { VideoPlaylist } from "@/components/mm/video-playlist";

export const Route = createFileRoute("/_app/ferramentas/studio/videos")({
  component: VideosPage,
});

function VideosPage() {
  const { products, balance, refresh } = useStudio();
  const start = useServerFn(startVideoGeneration);
  const poll = useServerFn(pollVideoGeneration);

  const firstProductId = (products[0] as { id?: string } | undefined)?.id ?? null;
  const [productId, setProductId] = useState<string | null>(firstProductId);
  const [style, setStyle] = useState<string>(VIDEO_STYLES[0].id);
  const [format, setFormat] = useState<typeof VIDEO_FORMATS[number]["id"]>(VIDEO_FORMATS[0].id);
  const [duration, setDuration] = useState<number>(8);
  const [objective, setObjective] = useState<string>(VIDEO_OBJECTIVES[0].id);
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string>("");
  const [videoUrls, setVideoUrls] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const segments = useMemo(() => videoSegments(duration), [duration]);
  const cost = useMemo(() => videoCost(duration), [duration]);
  const canPay = balance >= cost;

  const aspect = useMemo(() => VIDEO_FORMATS.find((f) => f.id === format)?.aspect ?? "9:16", [format]);

  async function loopPoll(assetId: string) {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    try {
      const r = await poll({ data: { assetId } });
      if (r.status === "ready") {
        const urls = (r as { urls?: string[] }).urls?.length ? (r as { urls: string[] }).urls : (r.url ? [r.url] : []);
        setVideoUrls(urls);
        setBusy(false);
        setStatusText("");
        refresh();
        return;
      }
      if (r.status === "failed") {
        setError(r.error ?? "Falhou");
        setBusy(false);
        setStatusText("");
        refresh();
        return;
      }
      setStatusText(segments.length > 1
        ? `A renderizar ${segments.length} segmentos em paralelo (${duration}s totais)…`
        : "A renderizar vídeo… pode demorar 1–3 minutos.");
      pollTimer.current = setTimeout(() => loopPoll(assetId), 8000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no polling");
      setBusy(false);
    }
  }

  async function onGenerate() {
    setError(null);
    setVideoUrls(null);
    setBusy(true);
    setStatusText("A iniciar geração…");
    try {
      const r = await start({
        data: {
          productId,
          style,
          format,
          duration,
          objective,
          notes: notes || undefined,
        },
      });
      refresh();
      setStatusText("Vídeo em fila (Veo). A monitorizar…");
      loopPoll(r.assetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao iniciar");
      setBusy(false);
      setStatusText("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--hairline)] bg-background/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">
              <Sparkles className="h-3 w-3" /> Google Veo 3
            </span>
            <h1 className="font-display text-3xl text-foreground md:text-4xl">IA de Vídeos</h1>
            <p className="text-sm text-muted-foreground">Vídeos cinematográficos com storyboard, câmara e iluminação automáticos.</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--hairline)] bg-background/40 px-4 py-3 text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Custo</div>
            <div className="font-display text-2xl text-foreground">{cost}<span className="text-sm text-muted-foreground"> créditos</span></div>
            <div className="text-[11px] text-muted-foreground">Saldo: {balance}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5 rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6">
          <Field label="Produto">
            <select
              value={productId ?? ""}
              onChange={(e) => setProductId(e.target.value || null)}
              className="w-full rounded-xl border border-[color:var(--hairline)] bg-background/40 px-3 py-2 text-sm"
            >
              <option value="">— Sem produto —</option>
              {(products as Array<{ id: string; name: string }>).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Estilo">
            <div className="flex flex-wrap gap-2">
              {VIDEO_STYLES.map((s) => (
                <Chip key={s.id} active={style === s.id} onClick={() => setStyle(s.id)}>{s.label}</Chip>
              ))}
            </div>
          </Field>

          <Field label="Formato">
            <div className="flex flex-wrap gap-2">
              {VIDEO_FORMATS.map((f) => (
                <Chip key={f.id} active={format === f.id} onClick={() => setFormat(f.id)}>
                  {f.label} · {f.aspect}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Duração">
            <div className="flex flex-wrap gap-2">
              {VIDEO_DURATIONS.map((d) => (
                <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>{d}s</Chip>
              ))}
            </div>
          </Field>

          <Field label="Objetivo">
            <div className="flex flex-wrap gap-2">
              {VIDEO_OBJECTIVES.map((o) => (
                <Chip key={o.id} active={objective === o.id} onClick={() => setObjective(o.id)}>{o.label}</Chip>
              ))}
            </div>
          </Field>

          <Field label="Instruções extra (opcional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ex.: câmara a orbitar, luz dourada ao pôr-do-sol, movimento lento…"
              className="w-full rounded-xl border border-[color:var(--hairline)] bg-background/40 px-3 py-2 text-sm"
            />
          </Field>

          <button
            onClick={onGenerate}
            disabled={busy || !canPay}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-background disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {busy ? "A gerar…" : canPay ? `Gerar vídeo (−${cost} cr)` : "Créditos insuficientes"}
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {statusText && !error && <p className="text-xs text-muted-foreground">{statusText}</p>}
        </div>

        <div className="rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-4">
          <div
            className="relative overflow-hidden rounded-2xl bg-background/60"
            style={{ aspectRatio: aspect.replace(":", " / ") }}
          >
            {videoUrls && videoUrls.length > 0 ? (
              <VideoPlaylist urls={videoUrls} className="h-full w-full" />
            ) : busy ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
                <Loader2 className="h-6 w-6 animate-spin text-secondary" />
                <p className="text-xs text-muted-foreground max-w-[240px]">{statusText || "A preparar…"}</p>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Film className="h-8 w-8" />
                <p className="text-xs">Pré-visualização do vídeo</p>
              </div>
            )}
          </div>
          {videoUrls && videoUrls.length > 0 && (
            <div className="mt-3 space-y-2">
              {videoUrls.map((u, i) => (
                <a
                  key={u}
                  href={u}
                  download
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--hairline)] bg-background/40 px-4 py-2 text-xs font-semibold text-foreground"
                >
                  <Download className="h-3.5 w-3.5" />
                  {videoUrls.length > 1 ? `Descarregar parte ${i + 1}/${videoUrls.length}` : "Descarregar MP4"}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1.5 text-xs transition " +
        (active
          ? "border-secondary bg-secondary/15 text-foreground"
          : "border-[color:var(--hairline)] bg-background/40 text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

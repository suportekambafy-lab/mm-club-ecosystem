import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Stream, type StreamPlayerApi } from "@cloudflare/stream-react";
import { ArrowLeft, Loader2, Scissors, Save, SkipBack, SkipForward } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { getLive, adminSetReplayTrim } from "@/lib/lives.functions";

export const Route = createFileRoute("/admin/lives/$liveId/editor")({
  component: ReplayEditor,
});

function fmt(s: number | null) {
  if (s == null || !Number.isFinite(s)) return "--:--";
  const t = Math.max(0, Math.round(s));
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

type Seg = { uid: string; token: string | null; duration: number | null };

function ReplayEditor() {
  const { liveId } = Route.useParams();
  const fetchLive = useServerFn(getLive);
  const saveTrim = useServerFn(adminSetReplayTrim);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [segments, setSegments] = useState<Seg[]>([]);
  const [segIndex, setSegIndex] = useState(0);
  const [trimStart, setTrimStart] = useState<number | null>(null);
  const [trimEnd, setTrimEnd] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const streamRef = useRef<StreamPlayerApi | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchLive({ data: { id: liveId } })
      .then((res) => {
        if (cancelled) return;
        const r = res as {
          live: { title: string };
          videoUid: string | null;
          playbackToken: string | null;
          replaySegments: Seg[];
          trimStart?: number | null;
          trimEnd?: number | null;
        };
        setTitle(r.live.title);
        const segs =
          r.replaySegments && r.replaySegments.length > 0
            ? r.replaySegments
            : r.videoUid
              ? [{ uid: r.videoUid, token: r.playbackToken, duration: null }]
              : [];
        setSegments(segs);
        setTrimStart(r.trimStart ?? null);
        setTrimEnd(r.trimEnd ?? null);
        if (segs.length === 0) setError("Esta sessão ainda não tem gravação disponível.");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [liveId, fetchLive]);

  // Poll the player for the current position.
  useEffect(() => {
    const id = window.setInterval(() => {
      const api = streamRef.current;
      if (!api) return;
      setCurrent(api.currentTime ?? 0);
      const d = api.duration;
      if (typeof d === "number" && Number.isFinite(d) && d > 0) setDuration(d);
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  const seg = segments[segIndex];
  const src = seg?.token ?? seg?.uid ?? "";
  const isFirst = segIndex === 0;
  const isLast = segIndex === segments.length - 1;

  const seek = (t: number) => {
    const api = streamRef.current;
    if (!api) return;
    api.currentTime = Math.max(0, t);
    setCurrent(Math.max(0, t));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await saveTrim({ data: { id: liveId, trimStart, trimEnd } });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading
          eyebrow="Admin › Lives"
          title="Editor de gravação."
          description={title ? `Cortar início e fim de "${title}".` : "Cortar início e fim do replay."}
        />
        <Link
          to="/admin/lives"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-1 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar gravação…
        </div>
      ) : segments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-8 text-center text-sm text-muted-foreground">
          {error ?? "Sem gravação."}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-3xl bg-black ring-1 ring-border/60">
            <Stream key={src} src={src} streamRef={streamRef} controls responsive preload="metadata" />
          </div>

          {segments.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Partes:</span>
              {segments.map((s, i) => (
                <button
                  key={s.uid}
                  type="button"
                  onClick={() => setSegIndex(i)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    i === segIndex
                      ? "bg-primary text-primary-foreground"
                      : "border border-border hover:border-primary/40"
                  }`}
                >
                  Parte {i + 1}
                </button>
              ))}
              <span className="text-[11px] text-muted-foreground">
                O corte de início aplica-se à parte 1 e o de fim à última parte.
              </span>
            </div>
          )}

          <div className="grid gap-4 rounded-2xl border border-border bg-surface-1 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="tabular-nums text-muted-foreground">
                Posição: <strong className="text-foreground">{fmt(current)}</strong>
                {duration ? ` / ${fmt(duration)}` : ""}
              </span>
              <button
                type="button"
                onClick={() => seek(current - 5)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40"
              >
                <SkipBack className="h-3 w-3" /> -5s
              </button>
              <button
                type="button"
                onClick={() => seek(current + 5)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40"
              >
                +5s <SkipForward className="h-3 w-3" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Início do replay
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-lg font-semibold">{fmt(trimStart ?? 0)}</span>
                <button
                  type="button"
                  disabled={!isFirst}
                  onClick={() => setTrimStart(Math.round(current))}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  title={isFirst ? "" : "Muda para a parte 1"}
                >
                  <Scissors className="h-3 w-3" /> Cortar aqui
                </button>
                <button
                  type="button"
                  onClick={() => setTrimStart(null)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Fim do replay (opcional)
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-lg font-semibold">
                  {trimEnd != null ? fmt(trimEnd) : "—"}
                </span>
                <button
                  type="button"
                  disabled={!isLast}
                  onClick={() => setTrimEnd(Math.round(current))}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  title={isLast ? "" : "Muda para a última parte"}
                >
                  <Scissors className="h-3 w-3" /> Terminar aqui
                </button>
                <button
                  type="button"
                  onClick={() => setTrimEnd(null)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar corte
              </button>
              <button
                type="button"
                onClick={() => seek(trimStart ?? 0)}
                className="rounded-full border border-border px-4 py-2 text-sm hover:border-primary/40"
              >
                Pré-visualizar início
              </button>
              {saved && <span className="text-sm text-emerald-400">Corte guardado.</span>}
              {error && <span className="text-sm text-red-400">{error}</span>}
            </div>
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              O corte é aplicado na reprodução (sem re-encode): o replay arranca no minuto escolhido e,
              se definires um fim, para nesse ponto.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

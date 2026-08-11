import { Stream, type StreamPlayerApi } from "@cloudflare/stream-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReplaySegment = { uid: string; token: string | null; duration: number | null };

type Props = {
  videoUid: string;
  playbackToken: string | null;
  live?: boolean;
  poster?: string;
  className?: string;
  // For replays: full list of recording segments in chronological order.
  // If provided and > 1, the player auto-advances through them so the whole
  // session plays even when the host reconnected mid-stream.
  segments?: ReplaySegment[];
  /** Replay trim (seconds) applied to the first / last segment. */
  trimStart?: number | null;
  trimEnd?: number | null;
  /** Chave estável (ex.: id da live) para guardar/retomar a posição do replay. */
  progressKey?: string | null;
};

export function LivePlayer({
  videoUid,
  playbackToken,
  live,
  poster,
  className,
  segments,
  trimStart,
  trimEnd,
  progressKey,
}: Props) {

  const isLive = !!live;

  // Normalise segments: for live sessions we always play the input directly.
  const effectiveSegments = useMemo<ReplaySegment[]>(() => {
    if (isLive) return [];
    if (segments && segments.length > 0) return segments;
    return [{ uid: videoUid, token: playbackToken, duration: null }];
  }, [isLive, segments, videoUid, playbackToken]);

  // Retomar onde o membro ficou (replays). Guardado no dispositivo.
  const storageKey = progressKey && !isLive ? `mm:live-progress:${progressKey}` : null;
  const readSaved = (): { seg: number; t: number } | null => {
    if (!storageKey || typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { seg?: number; t?: number };
      if (typeof parsed?.t === "number" && parsed.t > 1) {
        return { seg: typeof parsed.seg === "number" ? parsed.seg : 0, t: parsed.t };
      }
    } catch {
      /* ignore */
    }
    return null;
  };
  const savedRef = useRef<{ seg: number; t: number } | null>(null);
  const [segIndex, setSegIndex] = useState(0);

  // Ler a posição guardada no primeiro render (antes do player montar) e
  // posicionar já no segmento correto.
  useEffect(() => {
    const saved = readSaved();
    if (!saved) return;
    savedRef.current = saved;
    setSegIndex(saved.seg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);


  const segCount = effectiveSegments.length;
  useEffect(() => {
    setSegIndex((i) => (i < segCount ? i : 0));
  }, [segCount]);


  const current = effectiveSegments[segIndex];
  const src = isLive
    ? (playbackToken ?? videoUid)
    : (current?.token ?? current?.uid ?? videoUid);

  const streamRef = useRef<StreamPlayerApi | undefined>(undefined);
  const [needsUnmute, setNeedsUnmute] = useState(false);

  // For live sessions try to autoplay with sound. Browsers block unmuted
  // autoplay without a prior user gesture, so fall back to muted + a small
  // "Ativar som" overlay the viewer can tap.
  useEffect(() => {
    if (!isLive) return;
    const api = streamRef.current;
    if (!api) return;
    let cancelled = false;
    const tryPlayWithSound = async () => {
      try {
        api.muted = false;
        api.volume = 1;
        await api.play();
      } catch {
        if (cancelled) return;
        try {
          api.muted = true;
          await api.play();
          if (!cancelled) setNeedsUnmute(true);
        } catch {
          /* ignore */
        }
      }
    };
    void tryPlayWithSound();
    return () => {
      cancelled = true;
    };
  }, [isLive, src]);

  const handleUnmute = async () => {
    const api = streamRef.current;
    if (!api) return;
    try {
      api.muted = false;
      api.volume = 1;
      await api.play();
      setNeedsUnmute(false);
    } catch {
      /* ignore */
    }
  };

  // Replay: when a segment ends, advance to the next one automatically.
  const hasMultiSegments = !isLive && effectiveSegments.length > 1;
  const handleEnded = () => {
    if (!hasMultiSegments) return;
    setSegIndex((i) => (i < effectiveSegments.length - 1 ? i + 1 : i));
  };

  // Auto-play the next segment once it loads (user already pressed play once).
  useEffect(() => {
    if (isLive) return;
    if (segIndex === 0) return; // don't force autoplay on first segment
    const api = streamRef.current;
    if (!api) return;
    void api.play().catch(() => {
      /* browsers may block; user can press play */
    });
  }, [isLive, segIndex]);

  // Replay trim: skip the dark head on the first segment and stop at the tail
  // on the last one. Implemented by seeking/pausing on the player API so we
  // never have to re-encode the recording.
  const isFirstSeg = segIndex === 0;
  const isLastSeg = segIndex === effectiveSegments.length - 1;
  const start = !isLive && isFirstSeg && trimStart && trimStart > 0 ? trimStart : 0;
  const end = !isLive && isLastSeg && trimEnd && trimEnd > 0 ? trimEnd : null;

  // Custom controls: when a trim exists we hide the native controls and expose a
  // progress bar that treats the trim window as the whole video (0 → end-start).
  const trimmed = !isLive && (start > 0 || end != null);

  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0); // absolute seconds
  const [dur, setDur] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (isLive) return;
    const id = window.setInterval(() => {
      const api = streamRef.current;
      if (!api) return;
      const t = api.currentTime ?? 0;
      setPos(t);
      const d = api.duration;
      if (typeof d === "number" && Number.isFinite(d) && d > 0) setDur(d);
      setMuted(!!api.muted);
      if (end != null && t >= end) {
        api.pause();
        setPlaying(false);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [isLive, end, segIndex, src]);

  // Posição inicial do segmento: retoma onde o membro ficou, senão o corte inicial.
  useEffect(() => {
    if (isLive) return;
    const restore = restoreRef.current;
    const wantsRestore =
      !!restore && !restoredRef.current && restore.seg === segIndex && restore.t > start + 1;
    const target = wantsRestore ? restore!.t : start;
    if (target <= 0) return;
    const id = window.setInterval(() => {
      const api = streamRef.current;
      if (!api) return;
      const d = api.duration;
      if (!(typeof d === "number" && Number.isFinite(d) && d > 0)) return;
      const safe = Math.min(target, Math.max(d - 2, 0));
      if ((api.currentTime ?? 0) < safe - 0.5) api.currentTime = safe;
      if (wantsRestore) restoredRef.current = true;
      window.clearInterval(id);
    }, 200);
    return () => window.clearInterval(id);
  }, [isLive, start, segIndex, src]);

  // Guardar a posição (a cada 3s e ao sair do separador).
  useEffect(() => {
    if (!storageKey) return;
    const save = () => {
      const api = streamRef.current;
      if (!api) return;
      const t = api.currentTime ?? 0;
      const d = api.duration;
      const limit = end ?? (typeof d === "number" && Number.isFinite(d) ? d : null);
      try {
        if (limit != null && t >= limit - 5) {
          window.localStorage.removeItem(storageKey);
        } else if (t > 1) {
          window.localStorage.setItem(storageKey, JSON.stringify({ seg: segIndex, t }));
        }
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(save, 3000);
    const onHide = () => save();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      save();
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [storageKey, segIndex, end]);


  const relEnd = (end ?? dur ?? 0) - start;
  const relPos = Math.min(Math.max(pos - start, 0), Math.max(relEnd, 0));

  const togglePlay = async () => {
    const api = streamRef.current;
    if (!api) return;
    if (playing) {
      api.pause();
      setPlaying(false);
      return;
    }
    if (end != null && (api.currentTime ?? 0) >= end - 0.2) api.currentTime = start;
    try {
      await api.play();
      setPlaying(true);
    } catch {
      /* ignore */
    }
  };

  const seekRel = (v: number) => {
    const api = streamRef.current;
    if (!api) return;
    const abs = start + Math.min(Math.max(v, 0), Math.max(relEnd, 0));
    api.currentTime = abs;
    setPos(abs);
  };

  const toggleMute = () => {
    const api = streamRef.current;
    if (!api) return;
    api.muted = !api.muted;
    setMuted(api.muted);
  };

  const fmt = (s: number) => {
    const t = Math.max(0, Math.floor(s));
    const m = Math.floor(t / 60);
    return `${String(m).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-3xl bg-black shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] ring-1 ring-border/60",
        className,
      )}
    >
      <Stream
        key={`seg-${segIndex}-${src}`}
        src={src}
        streamRef={streamRef}
        controls={!trimmed}
        autoplay={isLive}
        muted={isLive}
        preload={isLive ? "auto" : "metadata"}
        poster={isLive ? undefined : poster}
        responsive
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {trimmed && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 bg-gradient-to-t from-black/85 to-transparent px-4 pb-3 pt-8">
          <button
            type="button"
            onClick={() => void togglePlay()}
            aria-label={playing ? "Pausar" : "Reproduzir"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <span className="shrink-0 tabular-nums text-[11px] text-white/85">{fmt(relPos)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(relEnd, 0.1)}
            step={0.1}
            value={relPos}
            onChange={(e) => seekRel(Number(e.target.value))}
            aria-label="Progresso"
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-primary [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
          />
          <span className="shrink-0 tabular-nums text-[11px] text-white/85">{fmt(relEnd)}</span>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Ativar som" : "Silenciar"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      )}
      {isLive && needsUnmute && (
        <button
          type="button"
          onClick={handleUnmute}
          className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur-md ring-1 ring-white/20 transition hover:bg-black/85"
        >
          <VolumeX className="h-4 w-4" />
          Ativar som
          <Volume2 className="h-4 w-4 opacity-70" />
        </button>
      )}
      {hasMultiSegments && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-white/85 backdrop-blur">
          Parte {segIndex + 1} / {effectiveSegments.length}
        </div>
      )}
    </div>
  );
}


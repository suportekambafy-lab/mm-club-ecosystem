import { Stream, type StreamPlayerApi } from "@cloudflare/stream-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
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
};

export function LivePlayer({ videoUid, playbackToken, live, poster, className, segments }: Props) {
  const isLive = !!live;

  // Normalise segments: for live sessions we always play the input directly.
  const effectiveSegments = useMemo<ReplaySegment[]>(() => {
    if (isLive) return [];
    if (segments && segments.length > 0) return segments;
    return [{ uid: videoUid, token: playbackToken, duration: null }];
  }, [isLive, segments, videoUid, playbackToken]);

  const [segIndex, setSegIndex] = useState(0);
  useEffect(() => {
    setSegIndex(0);
  }, [effectiveSegments]);

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
        controls
        autoplay={isLive}
        muted={isLive}
        preload={isLive ? "auto" : "metadata"}
        poster={isLive ? undefined : poster}
        responsive
        onEnded={handleEnded}
      />
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

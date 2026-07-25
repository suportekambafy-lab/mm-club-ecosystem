import { Stream, type StreamPlayerApi } from "@cloudflare/stream-react";
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  videoUid: string;
  playbackToken: string | null;
  live?: boolean;
  poster?: string;
  className?: string;
};

export function LivePlayer({ videoUid, playbackToken, live, poster, className }: Props) {
  // If we have a signed token, use it as the source. Otherwise fall back to the UID
  // (only works while `requireSignedURLs` is disabled on the input).
  const src = playbackToken ?? videoUid;
  const isLive = !!live;

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

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-3xl bg-black shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] ring-1 ring-border/60",
        className,
      )}
    >
      <Stream
        src={src}
        streamRef={streamRef}
        controls
        autoplay={isLive}
        muted={isLive}
        preload={isLive ? "auto" : "metadata"}
        poster={isLive ? undefined : poster}
        responsive
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
    </div>
  );
}

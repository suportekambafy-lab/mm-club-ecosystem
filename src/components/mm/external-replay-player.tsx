import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Reprodutor para gravações externas (ficheiro directo ou HLS .m3u8),
 * usado quando uma live foi gravada fora da plataforma.
 */
export function ExternalReplayPlayer({
  url,
  poster,
  className,
}: {
  url: string;
  poster?: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const isHls = /\.m3u8(\?|$)/i.test(url);
    if (!isHls || el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = url;
      return;
    }
    let destroy: (() => void) | null = null;
    let cancelled = false;
    void import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) {
        el.src = url;
        return;
      }
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(el);
      destroy = () => hls.destroy();
    });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url]);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-3xl bg-black shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] ring-1 ring-border/60",
        className,
      )}
    >
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={poster}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

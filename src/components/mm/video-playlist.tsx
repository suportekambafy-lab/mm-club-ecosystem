import { useEffect, useRef, useState } from "react";

/**
 * Plays multiple video URLs in seamless sequence.
 * - Uses two <video> elements, hot-swaps on ended for zero-gap playback.
 * - Falls back to controls on the visible one; loops back to segment 0 at end.
 */
export function VideoPlaylist({
  urls,
  poster,
  className,
  autoPlay = true,
  loop = true,
  controls = true,
  playsInline = true,
}: {
  urls: string[];
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  playsInline?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const activeRef = useRef<HTMLVideoElement | null>(null);
  const preloadRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setIdx(0);
  }, [urls.join("|")]);

  if (!urls.length) return null;

  const nextIdx = idx + 1 < urls.length ? idx + 1 : (loop ? 0 : idx);
  const showNext = idx + 1 < urls.length || loop;

  return (
    <div className={"relative " + (className ?? "")}>
      <video
        key={"a-" + idx}
        ref={activeRef}
        src={urls[idx]}
        poster={poster}
        controls={controls}
        autoPlay={autoPlay}
        playsInline={playsInline}
        className="h-full w-full object-contain"
        onEnded={() => {
          if (idx + 1 < urls.length) setIdx(idx + 1);
          else if (loop) setIdx(0);
        }}
      />
      {/* Hidden preloader for the next segment to minimise gap */}
      {showNext && (
        <video
          key={"b-" + nextIdx}
          ref={preloadRef}
          src={urls[nextIdx]}
          preload="auto"
          muted
          playsInline
          className="hidden"
        />
      )}
      {urls.length > 1 && (
        <div className="pointer-events-none absolute left-3 top-3 flex gap-1">
          {urls.map((_, i) => (
            <span
              key={i}
              className={
                "h-1 rounded-full transition-all " +
                (i === idx ? "w-6 bg-white" : "w-3 bg-white/40")
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

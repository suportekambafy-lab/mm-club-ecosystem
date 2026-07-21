import { useEffect, useRef, useState } from "react";

/**
 * Plays multiple video URLs in a seamless crossfaded sequence.
 * - Two overlaid <video> elements; the next one starts and fades in over the current one.
 * - Native controls are disabled and replaced by a minimal overlay so scrubbing doesn't break
 *   the internal segment state.
 */
export function VideoPlaylist({
  urls,
  poster,
  className,
  autoPlay = true,
  loop = true,
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
  const [fading, setFading] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(autoPlay);
  const aRef = useRef<HTMLVideoElement | null>(null);
  const bRef = useRef<HTMLVideoElement | null>(null);
  // Which slot (a or b) is currently the "front" (visible) video
  const [front, setFront] = useState<"a" | "b">("a");
  const scheduledRef = useRef(false);

  useEffect(() => {
    setIdx(0);
    setFront("a");
    setFading(false);
    scheduledRef.current = false;
  }, [urls.join("|")]);

  if (!urls.length) return null;

  const single = urls.length === 1;
  const CROSSFADE_MS = 450;

  const activeVideo = () => (front === "a" ? aRef.current : bRef.current);
  const otherVideo = () => (front === "a" ? bRef.current : aRef.current);

  function nextIndex(i: number) {
    if (i + 1 < urls.length) return i + 1;
    return loop ? 0 : -1;
  }

  function scheduleCrossfade() {
    if (single || scheduledRef.current) return;
    const nxt = nextIndex(idx);
    if (nxt < 0) return;
    const other = otherVideo();
    if (!other) return;
    scheduledRef.current = true;
    // Load next
    if (other.src !== urls[nxt]) other.src = urls[nxt];
    other.muted = muted;
    other.currentTime = 0;
    const play = other.play();
    if (play && typeof play.catch === "function") play.catch(() => {});
    setFading(true);
    window.setTimeout(() => {
      setFront((f) => (f === "a" ? "b" : "a"));
      setIdx(nxt);
      setFading(false);
      scheduledRef.current = false;
    }, CROSSFADE_MS);
  }

  function onTimeUpdate() {
    const v = activeVideo();
    if (!v || !v.duration || Number.isNaN(v.duration)) return;
    if (v.duration - v.currentTime <= CROSSFADE_MS / 1000 + 0.05) {
      scheduleCrossfade();
    }
  }

  function togglePlay() {
    const v = activeVideo();
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function toggleMute() {
    setMuted((m) => {
      const nm = !m;
      if (aRef.current) aRef.current.muted = nm;
      if (bRef.current) bRef.current.muted = nm;
      return nm;
    });
  }

  return (
    <div className={"group relative overflow-hidden bg-black " + (className ?? "")}>
      <video
        ref={aRef}
        src={front === "a" ? urls[idx] : undefined}
        poster={poster}
        autoPlay={autoPlay && front === "a"}
        muted={muted}
        playsInline={playsInline}
        onTimeUpdate={front === "a" ? onTimeUpdate : undefined}
        onEnded={front === "a" && single ? (loop ? () => { const v = aRef.current; if (v) { v.currentTime = 0; v.play().catch(() => {}); } } : undefined) : undefined}
        className="absolute inset-0 h-full w-full object-contain transition-opacity duration-[450ms] ease-linear"
        style={{ opacity: front === "a" ? 1 : (fading ? 0 : 0) }}
      />
      <video
        ref={bRef}
        muted={muted}
        playsInline={playsInline}
        onTimeUpdate={front === "b" ? onTimeUpdate : undefined}
        className="absolute inset-0 h-full w-full object-contain transition-opacity duration-[450ms] ease-linear"
        style={{ opacity: front === "b" ? 1 : (fading ? 0 : 0) }}
      />

      {/* Minimal controls overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
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
        <div className="pointer-events-auto mt-auto flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black hover:bg-white"
            aria-label={playing ? "Pausar" : "Reproduzir"}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label={muted ? "Ativar som" : "Silenciar"}
          >
            {muted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.59 3L14 9.41 15.41 8l2.59 2.59L20.59 8 22 9.41 19.41 12 22 14.59 20.59 16 18 13.41 15.41 16 14 14.59 16.59 12z"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm11 .17v5.66c1.48-.71 2.5-2.21 2.5-3.83s-1.02-3.12-2.5-3.83z"/></svg>
            )}
          </button>
          {urls.length > 1 && (
            <span className="ml-auto rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
              {idx + 1}/{urls.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

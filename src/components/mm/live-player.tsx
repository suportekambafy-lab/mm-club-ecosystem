import { Stream } from "@cloudflare/stream-react";

type Props = {
  videoUid: string;
  playbackToken: string | null;
  live?: boolean;
  poster?: string;
};

export function LivePlayer({ videoUid, playbackToken, live, poster }: Props) {
  // If we have a signed token, use it as the source. Otherwise fall back to the UID
  // (only works while `requireSignedURLs` is disabled on the input).
  const src = playbackToken ?? videoUid;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
      <Stream
        src={src}
        controls
        autoplay={false}
        muted={false}
        preload="metadata"
        poster={poster}
        responsive
      />
      {live && (
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-white shadow-lg">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Ao vivo
        </span>
      )}
    </div>
  );
}

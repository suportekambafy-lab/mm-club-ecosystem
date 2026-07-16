import { Stream } from "@cloudflare/stream-react";
import { cn } from "@/lib/utils";

type Props = {
  videoUid: string;
  playbackToken: string | null;
  live?: boolean;
  poster?: string;
  className?: string;
};

export function LivePlayer({ videoUid, playbackToken, poster, className }: Props) {
  // If we have a signed token, use it as the source. Otherwise fall back to the UID
  // (only works while `requireSignedURLs` is disabled on the input).
  const src = playbackToken ?? videoUid;

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-3xl bg-black shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] ring-1 ring-border/60",
        className,
      )}
    >
      <Stream
        src={src}
        controls
        autoplay={false}
        muted={false}
        preload="metadata"
        poster={poster}
        responsive
      />
    </div>
  );
}

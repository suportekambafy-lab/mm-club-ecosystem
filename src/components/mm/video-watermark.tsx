import mmIcon from "@/assets/mm-icon.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * YouTube-style branding watermark for lesson players.
 * Sits in the bottom-right corner, hidden by default and revealed
 * (with a subtle lift) when the pointer moves over the player.
 */
export function VideoWatermark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-3 right-3 z-10 translate-y-1 opacity-0 transition-all duration-300 ease-out",
        "group-hover:translate-y-0 group-hover:opacity-90 md:bottom-14 md:right-4",
        className,
      )}
    >
      <img
        src={mmIcon.url}
        alt=""
        width={36}
        height={36}
        draggable={false}
        className="h-7 w-7 select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] md:h-9 md:w-9"
      />
    </div>
  );
}

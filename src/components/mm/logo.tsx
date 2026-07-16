import { cn } from "@/lib/utils";
import mmIcon from "@/assets/mm-icon.png.asset.json";

/**
 * Official MM Club logo — cube icon (isotipo) + "MM Club" wordmark.
 * Text color adapts to theme: black on light, white on dark.
 */
export function MMLogo({
  className,
  showWordmark = true,
  size = 36,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={mmIcon.url}
        alt="MM Club"
        width={size}
        height={size}
        className="shrink-0 select-none"
        draggable={false}
      />
      {showWordmark && (
        <span className="font-display text-[19px] font-light tracking-tight text-foreground leading-none">
          MM <span className="font-light">Club</span>
        </span>
      )}
    </div>
  );
}

/** Icon-only mark for footers, favicons, compact contexts. */
export function MMIcon({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src={mmIcon.url}
      alt="MM Club"
      width={size}
      height={size}
      className={cn("shrink-0 select-none", className)}
      draggable={false}
    />
  );
}

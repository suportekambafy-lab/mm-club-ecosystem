import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  className?: string;
  title?: string;
};

/**
 * Instagram-style blue verified checkmark.
 * Uses a fixed blue so it reads as "verified" regardless of theme.
 */
export function VerifiedBadge({ size = 14, className, title = "Verificado" }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-label={title}
      role="img"
      className={cn("inline-block shrink-0 align-[-2px]", className)}
    >
      <title>{title}</title>
      <path
        fill="#1D9BF0"
        d="M12 1.5 14.2 3l2.65-.35.9 2.55 2.4 1.25-.55 2.6 1.4 2.3-1.9 1.85.35 2.6-2.5.9-1.25 2.35-2.6-.55L12 22.5l-2.3-1.5-2.6.55-1.25-2.35-2.5-.9.35-2.6L2 13.85l1.4-2.3-.55-2.6L5.25 7.7l.9-2.55L8.8 5.5 12 1.5Z"
      />
      <path
        fill="#fff"
        d="m10.6 15.4 6-6-1.4-1.4-4.6 4.6-2-2-1.4 1.4 3.4 3.4Z"
      />
    </svg>
  );
}

import { Link } from "@tanstack/react-router";
import type { Expert } from "@/data/types";
import { cn } from "@/lib/utils";

interface Props {
  expert: Expert;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  showRole?: boolean;
  className?: string;
  asLink?: boolean;
}

const sizes = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
};

export function ExpertAvatar({
  expert,
  size = "md",
  showName,
  showRole,
  className,
  asLink = true,
}: Props) {
  const avatar = (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-1 ring-[color:var(--hairline)]",
        sizes[size],
      )}
      style={expert.logo ? { background: "#000" } : { background: expert.photo }}
      aria-hidden
    >
      {expert.logo ? (
        <img
          loading="lazy"
          decoding="async"
          src={expert.logo}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        expert.name
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
      )}
    </div>
  );

  const content = (
    <div className={cn("flex items-center gap-2.5", className)}>
      {avatar}
      {(showName || showRole) && (
        <div className="flex min-w-0 flex-col leading-tight">
          {showName && (
            <span className="truncate text-sm font-medium text-foreground">
              {expert.name}
            </span>
          )}
          {showRole && (
            <span className="truncate text-xs text-muted-foreground">
              {expert.role}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (!asLink) return content;

  return (
    <Link
      to="/especialistas/$expertId"
      params={{ expertId: expert.id }}
      className="group inline-flex items-center rounded-md transition hover:opacity-90"
    >
      {content}
    </Link>
  );
}

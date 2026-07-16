import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  align?: "left" | "center";
  size?: "md" | "lg" | "xl";
}

const sizeMap = {
  md: "text-3xl md:text-4xl",
  lg: "text-4xl md:text-5xl lg:text-[56px]",
  xl: "text-5xl md:text-6xl lg:text-[72px]",
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
  align = "left",
  size = "lg",
}: Props) {
  const isCenter = align === "center";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative",
        isCenter ? "text-center" : "text-left",
        className,
      )}
    >
      {/* soft ambient glow behind the title */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -z-10 h-40 w-[70%] blur-3xl opacity-40",
          isCenter ? "left-1/2 -translate-x-1/2 -top-10" : "-left-10 -top-10",
        )}
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, oklch(0.82 0.13 82 / 0.28), transparent 70%)",
        }}
      />

      <div
        className={cn(
          "flex flex-wrap items-end gap-x-8 gap-y-4",
          isCenter ? "justify-center" : "justify-between",
        )}
      >
        <div className={cn("min-w-0", isCenter ? "mx-auto max-w-2xl" : "max-w-3xl")}>
          {eyebrow && (
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-1/60 px-3 py-1.5 backdrop-blur",
                isCenter && "mx-auto",
              )}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                {eyebrow}
              </span>
            </div>
          )}
          <h1
            className={cn(
              "mt-4 font-display font-semibold leading-[0.98] tracking-tight text-foreground",
              sizeMap[size],
            )}
          >
            {title}
          </h1>
          {description && (
            <p
              className={cn(
                "mt-4 text-sm leading-relaxed text-muted-foreground md:text-base",
                isCenter ? "mx-auto max-w-xl" : "max-w-2xl",
              )}
            >
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* gold hairline separator */}
      <div
        aria-hidden
        className={cn(
          "mt-8 h-px w-full",
          isCenter ? "mx-auto max-w-3xl" : "",
        )}
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.82 0.13 82 / 0.4), transparent)",
        }}
      />
    </motion.div>
  );
}

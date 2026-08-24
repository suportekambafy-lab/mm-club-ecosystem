import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Rail({ title, subtitle, eyebrow, action, children, className }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const sync = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    sync();
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync, children]);

  const nudge = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn("space-y-5", className)}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-1">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-2 inline-flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              <span className="type-eyebrow">{eyebrow}</span>
            </div>
          )}
          <h2 className="type-section truncate text-foreground">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <div className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              onClick={() => nudge(-1)}
              disabled={!canLeft}
              aria-label="Ver anteriores"
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              disabled={!canRight}
              aria-label="Ver seguintes"
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Rail with edge fade masks so cards feel like they extend past the viewport */}
      <div className="relative -mx-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background to-transparent"
        />
        <div
          ref={scrollerRef}
          onScroll={sync}
          className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:snap-start"
        >
          {children}
        </div>
      </div>
    </motion.section>
  );
}

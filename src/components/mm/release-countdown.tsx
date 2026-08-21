import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTicker } from "@/hooks/use-ticker";

function diff(target: number, now: number) {
  const ms = Math.max(0, target - now);
  return {
    done: ms === 0,
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms % 86400000) / 3600000),
    m: Math.floor((ms % 3600000) / 60000),
    s: Math.floor((ms % 60000) / 1000),
  };
}

interface Props {
  releaseAt: string;
  className?: string;
}

/** Contador regressivo para lançamentos agendados (cursos, lives). */
export function ReleaseCountdown({ releaseAt, className }: Props) {
  const target = new Date(releaseAt).getTime();
  const now = useTicker(1000);
  const t = useMemo(() => diff(target, now), [target, now]);

  if (!Number.isFinite(target) || t.done) return null;

  const cells: Array<[number, string]> = [
    [t.d, "dias"],
    [t.h, "horas"],
    [t.m, "min"],
    [t.s, "seg"],
  ];

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {cells.map(([value, label]) => (
        <div
          key={label}
          className="min-w-[68px] flex-1 rounded-xl bg-surface-2 px-3 py-2 text-center ring-1 ring-border sm:flex-none"
        >
          <div className="font-display text-2xl leading-none text-primary tabular-nums">
            {String(value).padStart(2, "0")}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

import { cn } from "@/lib/utils";
import { scoreTone } from "@/lib/product-lab-config";
import { useEffect, useState } from "react";

interface Props {
  score: number | null;
  size?: number;
  className?: string;
  compact?: boolean;
}

/** Anel de score MM, com animação suave quando o valor muda. */
export function ScoreRing({ score, size = 132, className, compact }: Props) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const target = score ?? 0;
    let raf = 0;
    const start = performance.now();
    const from = shown;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const stroke = compact ? 5 : 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = scoreTone(score);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border/60" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
          strokeDasharray={c}
          strokeDashoffset={c - (c * shown) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {score === null ? (
          <span className={cn("text-xs text-muted-foreground", compact && "text-[10px]")}>—</span>
        ) : (
          <>
            <span className={cn("font-display leading-none text-foreground", compact ? "text-sm" : "text-3xl")}>
              {shown}
            </span>
            {!compact && (
              <>
                <span className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">/100</span>
                <span className={cn("mt-1 text-[10px] font-semibold uppercase tracking-[0.14em]", tone.className)}>
                  {tone.label}
                </span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

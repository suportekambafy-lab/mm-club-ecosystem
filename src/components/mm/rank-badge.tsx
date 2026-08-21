import { cn } from "@/lib/utils";

type Props = {
  rank: number | undefined;
  /** Mostra o badge até esta posição (acima disso não aparece nada). */
  maxRank?: number;
  compact?: boolean;
  className?: string;
};

const TONE: Record<number, string> = {
  1: "border-amber-300/50 bg-amber-400/15 text-amber-200",
  2: "border-slate-300/50 bg-slate-300/15 text-slate-100",
  3: "border-orange-400/50 bg-orange-500/15 text-orange-200",
};

/**
 * Badge de gamificação: "Top 1", "Top 2"… junto ao nome do membro.
 * Só aparece para quem está dentro do pódio configurado.
 */
export function RankBadge({ rank, maxRank = 10, compact, className }: Props) {
  if (!rank || rank > maxRank) return null;
  const tone = TONE[rank] ?? "border-primary/40 bg-primary/10 text-primary";
  return (
    <span
      title={`Top ${rank} em envolvimento nos últimos 30 dias`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold uppercase tracking-[0.12em]",
        compact ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]",
        tone,
        className,
      )}
    >
      {rank <= 3 && <span aria-hidden>★</span>}
      Top {rank}
    </span>
  );
}

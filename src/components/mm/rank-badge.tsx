import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCommunityLeaderboard, RANK_LIMIT, SCORE_WEIGHTS } from "@/hooks/use-community-ranks";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

type Props = {
  rank: number | undefined;
  /** Membro a que o badge pertence — permite abrir a explicação da posição. */
  userId?: string;
  name?: string | null;
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
 * Badge de gamificação: "Top 1"… "Top 5" junto ao nome do membro.
 * Ao clicar, explica como a posição foi calculada.
 */
export function RankBadge({
  rank,
  userId,
  name,
  maxRank = RANK_LIMIT,
  compact,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  if (!rank || rank > Math.min(maxRank, RANK_LIMIT)) return null;
  const tone = TONE[rank] ?? "border-primary/40 bg-primary/10 text-primary";

  const badge = (
    <span
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

  if (!userId) return badge;

  return (
    <>
      <button
        type="button"
        title="Ver como esta posição foi calculada"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex shrink-0 transition hover:opacity-80"
      >
        {badge}
      </button>
      <RankExplainDialog
        open={open}
        onOpenChange={setOpen}
        userId={userId}
        fallbackName={name ?? null}
      />
    </>
  );
}

function RankExplainDialog({
  open,
  onOpenChange,
  userId,
  fallbackName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  fallbackName: string | null;
}) {
  const q = useCommunityLeaderboard(30, RANK_LIMIT, open);
  const row = (q.data ?? []).find((r) => r.user_id === userId);
  const name = row?.display_name ?? fallbackName ?? "Este membro";

  const lines = row
    ? [
        { label: "Publicações", count: row.posts, weight: SCORE_WEIGHTS.posts },
        { label: "Comentários", count: row.comments, weight: SCORE_WEIGHTS.comments },
        { label: "Gostos recebidos", count: row.likes_received, weight: SCORE_WEIGHTS.likes },
        {
          label: "Reações recebidas",
          count: row.reactions_received,
          weight: SCORE_WEIGHTS.reactions,
        },
        { label: "Shorts publicados", count: row.shorts, weight: SCORE_WEIGHTS.shorts },
      ].filter((l) => l.count > 0)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-border bg-surface-1">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-primary" />
            {row ? `Top ${row.rank} · ${name}` : name}
          </DialogTitle>
          <DialogDescription>
            Posição calculada pela atividade na Comunidade nos últimos 30 dias.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">A carregar…</p>
        ) : !row ? (
          <p className="text-sm text-muted-foreground">
            Este membro já não está entre os {RANK_LIMIT} mais envolvidos.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface-2">
              {lines.map((l) => (
                <li
                  key={l.label}
                  className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm"
                >
                  <span className="text-foreground/90">{l.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {l.count} × {l.weight} ={" "}
                    <span className="font-semibold text-foreground">{l.count * l.weight}</span>
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-semibold text-primary">{row.score} pontos</span>
              </li>
            </ul>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Cada Short vale {SCORE_WEIGHTS.shorts} pontos, cada publicação{" "}
              {SCORE_WEIGHTS.posts}, cada comentário {SCORE_WEIGHTS.comments}, cada gosto
              recebido {SCORE_WEIGHTS.likes} e cada reação recebida {SCORE_WEIGHTS.reactions}.
              Só os {RANK_LIMIT} primeiros recebem badge, e a equipa MM não entra no ranking.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

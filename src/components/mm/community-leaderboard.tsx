import { useState } from "react";
import { MemberAvatar } from "@/components/mm/member-avatar";
import { RankBadge } from "@/components/mm/rank-badge";
import { useCommunityLeaderboard } from "@/hooks/use-community-ranks";
import { useMemberProfile } from "@/components/mm/member-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 365, label: "Ano" },
] as const;

/**
 * Ranking de envolvimento da comunidade. Mostra os membros mais ativos
 * com a respetiva posição (Top 1, Top 2, …) e a pontuação.
 */
export function CommunityLeaderboard({ limit = 10 }: { limit?: number }) {
  const [days, setDays] = useState<number>(30);
  const q = useCommunityLeaderboard(days, limit);
  const { open } = useMemberProfile();
  const rows = q.data ?? [];

  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Trophy className="h-3.5 w-3.5 text-primary" />
          Mais envolvidos
        </h3>
      </div>

      <div className="mb-3 inline-flex rounded-full border border-border bg-surface-2 p-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => setDays(p.days)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-medium transition",
              days === p.days
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Ainda sem atividade suficiente. Publica, comenta e sobe no ranking.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.user_id}>
              <button
                type="button"
                onClick={() => open(r.user_id)}
                className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition hover:bg-surface-2"
              >
                <span className="w-4 shrink-0 text-center text-[11px] font-semibold text-muted-foreground">
                  {r.rank}
                </span>
                <MemberAvatar name={r.display_name} avatarUrl={r.avatar_url} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-foreground">
                      {r.display_name}
                    </span>
                    <RankBadge rank={r.rank} maxRank={3} compact />
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {r.posts} pub · {r.comments} com · {r.likes_received} gostos
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-primary">
                  {r.score}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

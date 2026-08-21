import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  posts: number;
  comments: number;
  likes_received: number;
  reactions_received: number;
  shorts: number;
  score: number;
  rank: number;
};

/** Número máximo de posições premiadas com badge. */
export const RANK_LIMIT = 5;

/** Pesos usados no cálculo da pontuação de envolvimento. */
export const SCORE_WEIGHTS = {
  shorts: 6,
  posts: 5,
  comments: 3,
  likes: 2,
  reactions: 1,
} as const;

/**
 * Classificação de envolvimento da comunidade (gamificação).
 * `days` define a janela de contagem; `limit` o número de lugares.
 */
export function useCommunityLeaderboard(days = 30, limit = RANK_LIMIT, enabled = true) {
  return useQuery({
    queryKey: ["community", "leaderboard", days, limit],
    enabled,
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await supabase.rpc("community_leaderboard", {
        _days: days,
        _limit: limit,
      });
      if (error) return [];
      return (data ?? []) as LeaderboardRow[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Mapa userId → posição, para desenhar o badge "Top N" junto ao nome. */
export function useCommunityRanks(days = 30, limit = RANK_LIMIT) {
  const q = useCommunityLeaderboard(days, limit);
  const map = new Map<string, number>();
  for (const r of q.data ?? []) map.set(r.user_id, r.rank);
  return map;
}

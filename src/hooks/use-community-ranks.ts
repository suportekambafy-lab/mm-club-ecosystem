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

/**
 * Classificação de envolvimento da comunidade (gamificação).
 * `days` define a janela de contagem; `limit` o número de lugares.
 */
export function useCommunityLeaderboard(days = 30, limit = 20) {
  return useQuery({
    queryKey: ["community", "leaderboard", days, limit],
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
export function useCommunityRanks(days = 30, limit = 20) {
  const q = useCommunityLeaderboard(days, limit);
  const map = new Map<string, number>();
  for (const r of q.data ?? []) map.set(r.user_id, r.rank);
  return map;
}

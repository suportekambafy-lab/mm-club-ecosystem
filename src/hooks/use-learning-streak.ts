import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LearningStreak = {
  current_streak: number;
  longest_streak: number;
  week_minutes: number;
  total_minutes: number;
  active_days: string[];
  last_active_day: string | null;
};

export function useLearningStreak() {
  const [streak, setStreak] = useState<LearningStreak | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.user) {
      setStreak(null);
      setLoaded(true);
      return;
    }
    // Entrar na app já conta como dia ativo (1x por dia).
    await markDailyVisit();
    try {
      const { data, error } = await (supabase as unknown as {
        rpc: (fn: string) => Promise<{ data: LearningStreak[] | null; error: unknown }>;
      }).rpc("my_learning_streak");
      if (error) throw error;
      setStreak(Array.isArray(data) ? (data[0] ?? null) : null);
    } catch (error) {
      console.warn("Falha ao carregar streak", error);
      setStreak(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { streak, loaded, reload: load };
}

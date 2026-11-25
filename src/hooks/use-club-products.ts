import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { CLUB_PRODUCTS, isProductUnlocked, productOfCourse, type ClubProductId } from "@/lib/club/products";
import type { Course } from "@/data/types";

/** Que produtos extra o membro já desbloqueou. */
export function useClubProducts() {
  const { user, isAdmin, loading } = useCurrentUser();
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setReady(true); return; }
    let cancelled = false;
    (async () => {
      const next = new Set<string>();
      await Promise.all(
        CLUB_PRODUCTS.filter((p) => p.feature).map(async (p) => {
          const { data } = await supabase.rpc("has_feature", { _user_id: user.id, _feature: p.feature! });
          if (data) next.add(p.feature!);
        }),
      );
      if (!cancelled) { setOwned(next); setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [user, loading]);

  const isUnlocked = useCallback((id: ClubProductId) => isProductUnlocked(id, owned, isAdmin), [owned, isAdmin]);
  const courseUnlocked = useCallback((c: Course) => isUnlocked(productOfCourse(c)), [isUnlocked]);
  return { ready: ready && !loading, isUnlocked, courseUnlocked };
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORT_BOT_ID } from "@/lib/support-bot";

/**
 * Returns the set of user ids shown as verified (admins + o agente MM Suporte).
 * RLS: non-admin users only see their own row (if admin), admins see all.
 */
export function useAdminIds() {
  const q = useQuery({
    queryKey: ["admin-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const ids = new Set<string>(error ? [] : (data ?? []).map((r) => r.user_id));
      ids.add(SUPPORT_BOT_ID);
      return ids;
    },
    staleTime: 5 * 60_000,
  });
  return q.data ?? new Set<string>([SUPPORT_BOT_ID]);
}


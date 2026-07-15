import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the set of user ids that have the `admin` role.
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
      if (error) return new Set<string>();
      return new Set<string>((data ?? []).map((r) => r.user_id));
    },
    staleTime: 5 * 60_000,
  });
  return q.data ?? new Set<string>();
}

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CurrentUser, DashboardBlockId, Visibility } from "@/data/types";

const DEFAULT_BLOCKS: DashboardBlockId[] = [
  "continue",
  "next-live",
  "recommended",
  "news",
  "top-tools",
  "upcoming-events",
  "jade",
  "community",
];

export type CurrentUserState = {
  user: CurrentUser | null;
  isAdmin: boolean;
  loading: boolean;
};

export function useCurrentUser(): CurrentUserState {
  const currentUserIdRef = useRef<string | null>(null);
  const [state, setState] = useState<CurrentUserState>({
    user: null,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: s } = await supabase.auth.getSession();
      const authUser = s.session?.user ?? null;
      if (!authUser) {
        currentUserIdRef.current = null;
        if (!cancelled) setState({ user: null, isAdmin: false, loading: false });
        return;
      }

      const [profileRes, entsRes, adminRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", authUser.id)
          .maybeSingle(),
        supabase
          .from("user_entitlements")
          .select("entitlement")
          .eq("user_id", authUser.id),
        supabase.rpc("has_role", { _user_id: authUser.id, _role: "admin" }),
      ]);

      const name =
        profileRes.data?.display_name ??
        (authUser.user_metadata?.display_name as string | undefined) ??
        authUser.email?.split("@")[0] ??
        "MM";

      const entitlements: Visibility[] = (entsRes.data ?? []).map(
        (r) => r.entitlement as Visibility,
      );
      if (!entitlements.includes("public")) entitlements.unshift("public");

      const initials = name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

      if (cancelled) return;
      currentUserIdRef.current = authUser.id;
      setState({
        user: {
          id: authUser.id,
          name,
          email: authUser.email ?? "",
          avatarInitials: initials,
          entitlements,
          dashboard: { blocks: DEFAULT_BLOCKS },
        },
        isAdmin: Boolean(adminRes.data),
        loading: false,
      });
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        currentUserIdRef.current = null;
        setState({ user: null, isAdmin: false, loading: false });
        return;
      }
      if (event === "USER_UPDATED") {
        load();
        return;
      }
      if (event === "SIGNED_IN") {
        const nextUserId = session?.user?.id ?? null;
        if (nextUserId && nextUserId !== currentUserIdRef.current) {
          load();
        }
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

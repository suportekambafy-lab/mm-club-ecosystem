import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Token de acesso atual (ou null). Serve para só chamar server functions
 * protegidas depois de a sessão estar hidratada — sem isto os pedidos saem sem
 * cabeçalho `Authorization` e o servidor responde 500 (Unauthorized).
 */
export function useAccessToken(): { token: string | null; ready: boolean } {
  const [state, setState] = useState<{ token: string | null; ready: boolean }>({
    token: null,
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setState({ token: data.session?.access_token ?? null, ready: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setState({ token: session?.access_token ?? null, ready: true });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

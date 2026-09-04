import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type SessionHealth =
  | { ok: true; session: Session; user: User; repaired: boolean }
  | { ok: false; reason: string; skewSeconds: number | null };

function skewOf(session: Session | null): number | null {
  if (!session?.expires_at) return null;
  // Positive = token already "expired" from this device's point of view.
  return Math.round(Date.now() / 1000 - session.expires_at);
}

/**
 * Garante que a sessão local é realmente utilizável pelo servidor.
 *
 * Um `getSession()` que devolve sessão não chega: se o token estiver
 * expirado localmente (relógio do dispositivo desacertado, refresh falhado,
 * etc.) os pedidos saem anónimos e tudo parece "bloqueado". Aqui validamos
 * com o servidor e, se falhar, tentamos um refresh explícito antes de
 * desistir.
 */
export async function ensureLiveSession(): Promise<SessionHealth> {
  const { data: first } = await supabase.auth.getSession();
  let session = first.session;
  if (!session) {
    return { ok: false, reason: "no_session", skewSeconds: null };
  }

  const probe = await supabase.auth.getUser();
  if (probe.data.user) {
    return { ok: true, session, user: probe.data.user, repaired: false };
  }

  const firstError = probe.error?.message ?? "user_unavailable";

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.data.session && refreshed.data.user) {
    session = refreshed.data.session;
    return { ok: true, session, user: refreshed.data.user, repaired: true };
  }

  return {
    ok: false,
    reason: `${firstError} | refresh: ${refreshed.error?.message ?? "no_session"}`,
    skewSeconds: skewOf(session),
  };
}

/** Termina a sessão local (sem tocar noutros dispositivos). */
export async function dropLocalSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* best effort */
  }
}

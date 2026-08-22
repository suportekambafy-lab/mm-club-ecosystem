/**
 * Client-side session guard.
 *
 * - Registers the current device + session on sign-in (device trust).
 * - Polls the server so a revoked session signs out immediately.
 * - Clears the local session record on logout.
 *
 * The fingerprint is a stable, non-identifying hash of coarse browser
 * characteristics; no tracking data leaves the device beyond that.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  checkSession,
  endSession,
  registerDeviceSession,
} from "@/lib/security.functions";

const FP_KEY = "mm.sec.fp";
const TOKEN_KEY = "mm.sec.session";

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function deviceFingerprint(): string {
  const cached = window.localStorage.getItem(FP_KEY);
  if (cached) return cached;
  const raw = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    String(navigator.hardwareConcurrency ?? ""),
  ].join("|");
  const fp = `fp_${hash(raw)}${hash(raw.split("").reverse().join(""))}`;
  window.localStorage.setItem(FP_KEY, fp);
  return fp;
}

export function currentSessionToken(): string {
  let token = window.sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = `st_${crypto.randomUUID().replace(/-/g, "")}`;
    window.sessionStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

/** Called from the sign-out handler before Supabase clears the session. */
export async function endLocalSession() {
  try {
    const token = window.sessionStorage.getItem(TOKEN_KEY);
    if (token) await endSession({ data: { sessionToken: token } });
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* best effort */
  }
}

export function useSessionGuard(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    let stopped = false;

    const token = currentSessionToken();

    // Só chamar as funções protegidas com sessão Supabase válida — sem token o
    // servidor responde 500 (Unauthorized).
    const hasSession = async () => {
      const { data } = await supabase.auth.getSession();
      return Boolean(data.session?.access_token);
    };

    void hasSession().then((ok) => {
      if (!ok || stopped) return;
      registerDeviceSession({
        data: { fingerprint: deviceFingerprint(), sessionToken: token },
      }).catch(() => undefined);
    });

    const tick = async () => {
      if (stopped) return;
      if (!(await hasSession())) return;
      try {
        const res = await checkSession({ data: { sessionToken: token } });
        if (res?.revoked && !stopped) {
          window.sessionStorage.removeItem(TOKEN_KEY);
          await supabase.auth.signOut();
          window.location.href = "/auth";
        }
      } catch {
        /* offline / transient */
      }
    };

    const id = window.setInterval(tick, 60_000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [userId]);
}

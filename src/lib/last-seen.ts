import { supabase } from "@/integrations/supabase/client";

// Heartbeat de presença — alimenta o motor anti-churn (14 dias sem entrar).
// Escreve no máximo 1x por hora por dispositivo.
const KEY = "mm:last_seen_ping";
const ONE_HOUR = 3600_000;

export async function pingLastSeen(userId: string): Promise<void> {
  try {
    if (typeof window !== "undefined") {
      const last = Number(window.localStorage.getItem(KEY) ?? 0);
      if (Date.now() - last < ONE_HOUR) return;
      window.localStorage.setItem(KEY, String(Date.now()));
    }
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    // presença é best-effort, nunca bloqueia a app
  }
}

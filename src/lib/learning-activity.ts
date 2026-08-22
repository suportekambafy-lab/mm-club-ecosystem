import { supabase } from "@/integrations/supabase/client";

/**
 * Registo de atividade de aprendizagem (para streaks e meta semanal).
 *
 * O player chama `pingLearningActivity()` sempre que grava progresso. Aqui
 * agregamos: cada minuto de visualização real é enviado no máximo uma vez.
 */
let lastPing = 0;
let lastFlush = 0;
const MINUTE = 60_000;

export function pingLearningActivity(): void {
  const now = Date.now();
  const wasActiveRecently = now - lastPing < 90_000;
  lastPing = now;
  if (!wasActiveRecently) {
    // Primeira interação da sessão: conta como início de dia ativo.
    if (now - lastFlush < MINUTE) return;
    lastFlush = now;
    void recordMinutes(1);
    return;
  }
  if (now - lastFlush < MINUTE) return;
  const minutes = Math.max(1, Math.round((now - lastFlush) / MINUTE));
  lastFlush = now;
  void recordMinutes(Math.min(minutes, 5));
}

export async function recordMinutes(minutes: number, lessons = 0): Promise<void> {
  try {
    await (supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
    }).rpc("record_learning_activity", { _minutes: minutes, _lessons: lessons });
  } catch (error) {
    console.warn("Falha ao registar atividade de aprendizagem", error);
  }
}

export function recordLessonCompleted(): void {
  void recordMinutes(0, 1);
}

export const WEEKLY_GOAL_MINUTES = 90;

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LessonProgressRow = {
  course_id: string;
  lesson_id: string;
  completed: boolean;
  progress_seconds: number;
  last_watched_at: string;
};

const SELECT = "course_id, lesson_id, completed, progress_seconds, last_watched_at";
const RETRY_DELAYS_MS = [800, 2500, 6000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function currentUserId(): Promise<string | null> {
  // getSession lê o token local (sem viagem à rede); getUser falhava em redes
  // instáveis e a gravação era silenciosamente descartada.
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id ?? null;
  if (id) return id;
  const { data: u } = await supabase.auth.getUser();
  return u.user?.id ?? null;
}

export function useLessonProgress(courseId: string, lessonId: string) {
  const [row, setRow] = useState<LessonProgressRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const rowRef = useRef<LessonProgressRow | null>(null);
  const mountedRef = useRef(true);
  // Fila de gravações: garante ordem e que uma conclusão nunca é "ultrapassada"
  // por uma gravação de posição mais antiga que chegue depois ao servidor.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    rowRef.current = row;
  }, [row]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Mudou de aula: nunca reutilizar o estado da aula anterior.
    setRow(null);
    rowRef.current = null;
    setLoaded(false);
    (async () => {
      const userId = await currentUserId();
      if (!userId) {
        if (!cancelled) setLoaded(true);
        return;
      }
      let data: LessonProgressRow | null = null;
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        const res = await supabase
          .from("lesson_progress")
          .select(SELECT)
          .eq("user_id", userId)
          .eq("course_id", courseId)
          .eq("lesson_id", lessonId)
          .maybeSingle();
        if (!res.error) {
          data = res.data;
          break;
        }
        if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
      }
      if (!cancelled) {
        // Nunca perder uma conclusão que tenha sido gravada entretanto.
        setRow((prev) => (prev?.completed && data && !data.completed ? { ...data, completed: true } : data));
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId]);

  const saveProgress = useCallback(
    async (
      progressSeconds?: number,
      options?: { completed?: boolean; silent?: boolean },
    ) => {
      const userId = await currentUserId();
      if (!userId) return null;
      if (!options?.silent && mountedRef.current) setSaving(true);

      const explicitCompleted = typeof options?.completed === "boolean";
      const payload: {
        user_id: string;
        course_id: string;
        lesson_id: string;
        last_watched_at: string;
        completed?: boolean;
        progress_seconds?: number;
      } = {
        user_id: userId,
        course_id: courseId,
        lesson_id: lessonId,
        last_watched_at: new Date().toISOString(),
      };
      // Só enviamos `completed` quando é pedido explicitamente. Antes, uma
      // gravação de posição feita antes da linha carregar enviava
      // `completed: false` e apagava uma conclusão já registada.
      if (explicitCompleted) payload.completed = options!.completed;
      if (typeof progressSeconds === "number" && Number.isFinite(progressSeconds)) {
        payload.progress_seconds = Math.max(0, Math.floor(progressSeconds));
      }

      const run = async (): Promise<LessonProgressRow | null> => {
        // Uma conclusão é crítica: tenta várias vezes antes de desistir.
        const attempts = options?.completed ? RETRY_DELAYS_MS.length + 1 : 1;
        let lastError: unknown = null;
        for (let attempt = 0; attempt < attempts; attempt++) {
          try {
            const { data, error } = await supabase
              .from("lesson_progress")
              .upsert(payload, { onConflict: "user_id,course_id,lesson_id" })
              .select(SELECT)
              .maybeSingle();
            if (error) throw error;
            if (data && mountedRef.current) {
              setRow((prev) =>
                // A resposta de uma gravação de posição nunca "desmarca" a aula.
                prev?.completed && !explicitCompleted && !data.completed
                  ? { ...data, completed: true }
                  : data,
              );
            }
            return data;
          } catch (error) {
            lastError = error;
            if (attempt < attempts - 1) await sleep(RETRY_DELAYS_MS[attempt] ?? 5000);
          }
        }
        console.warn("Falha ao gravar progresso da aula", lastError);
        return null;
      };

      const task = queueRef.current.then(run, run);
      queueRef.current = task.catch(() => null);
      try {
        return await task;
      } finally {
        if (!options?.silent && mountedRef.current) setSaving(false);
      }
    },
    [courseId, lessonId],
  );

  const setCompleted = useCallback(
    async (completed: boolean) => {
      return saveProgress(rowRef.current?.progress_seconds, { completed });
    },
    [saveProgress],
  );

  return { row, completed: Boolean(row?.completed), saving, loaded, saveProgress, setCompleted };
}

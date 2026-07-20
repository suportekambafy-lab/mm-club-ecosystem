import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LessonProgressRow = {
  course_id: string;
  lesson_id: string;
  completed: boolean;
  progress_seconds: number;
  last_watched_at: string;
};

export function useLessonProgress(courseId: string, lessonId: string) {
  const [row, setRow] = useState<LessonProgressRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const rowRef = useRef<LessonProgressRow | null>(null);
  const mountedRef = useRef(true);

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
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("lesson_progress")
        .select("course_id, lesson_id, completed, progress_seconds, last_watched_at")
        .eq("user_id", u.user.id)
        .eq("course_id", courseId)
        .eq("lesson_id", lessonId)
        .maybeSingle();
      if (!cancelled) {
        setRow(data);
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
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      if (!options?.silent) setSaving(true);
      const payload: {
        user_id: string;
        course_id: string;
        lesson_id: string;
        last_watched_at: string;
        completed?: boolean;
        progress_seconds?: number;
      } = {
        user_id: u.user.id,
        course_id: courseId,
        lesson_id: lessonId,
        last_watched_at: new Date().toISOString(),
      };

      payload.completed = options?.completed ?? rowRef.current?.completed ?? false;
      if (typeof progressSeconds === "number" && Number.isFinite(progressSeconds)) {
        payload.progress_seconds = Math.max(0, Math.floor(progressSeconds));
      }

      try {
        const { data, error } = await supabase
          .from("lesson_progress")
          .upsert(payload, { onConflict: "user_id,course_id,lesson_id" })
          .select("course_id, lesson_id, completed, progress_seconds, last_watched_at")
          .maybeSingle();
        if (error) throw error;
        if (data && mountedRef.current) setRow(data);
        return data;
      } catch (error) {
        console.warn("Falha ao gravar progresso da aula", error);
        return null;
      } finally {
        if (!options?.silent && mountedRef.current) setSaving(false);
      }
    },
    [courseId, lessonId],
  );

  const setCompleted = useCallback(
    async (completed: boolean) => {
      await saveProgress(rowRef.current?.progress_seconds, { completed });
    },
    [saveProgress],
  );

  return { row, completed: Boolean(row?.completed), saving, loaded, saveProgress, setCompleted };
}

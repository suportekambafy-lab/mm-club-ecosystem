import { useCallback, useEffect, useState } from "react";
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

  const setCompleted = useCallback(
    async (completed: boolean) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setSaving(true);
      const payload = {
        user_id: u.user.id,
        course_id: courseId,
        lesson_id: lessonId,
        completed,
        last_watched_at: new Date().toISOString(),
      };
      const { data } = await supabase
        .from("lesson_progress")
        .upsert(payload, { onConflict: "user_id,course_id,lesson_id" })
        .select("course_id, lesson_id, completed, progress_seconds, last_watched_at")
        .maybeSingle();
      if (data) setRow(data);
      setSaving(false);
    },
    [courseId, lessonId],
  );

  return { row, completed: Boolean(row?.completed), saving, loaded, setCompleted };
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { coursesById } from "@/data/courses";
import { useActiveProduct } from "@/hooks/use-active-product";
import { productOfCourse } from "@/lib/club/products";
import type { ResumeItem } from "@/lib/club/resume-merge";

/**
 * Última aula aberta e ainda não terminada, dentro do produto ativo.
 * Devolve também `loaded` para a página não esconder nada antes de saber
 * se o próximo passo coincide.
 */
export function useContinueWatching(userId: string | null | undefined) {
  const [item, setItem] = useState<ResumeItem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [active] = useActiveProduct();

  useEffect(() => {
    if (!userId) {
      setItem(null);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    void supabase
      .from("lesson_progress")
      .select("course_id, lesson_id, progress_seconds")
      .eq("user_id", userId)
      .eq("completed", false)
      .gt("progress_seconds", 20)
      .order("last_watched_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (cancelled) return;
        const row = (data ?? []).find((r) => {
          const c = coursesById[r.course_id];
          return !!c && productOfCourse(c) === active;
        });
        setItem(
          row
            ? { courseId: row.course_id, lessonId: row.lesson_id, seconds: row.progress_seconds ?? 0 }
            : null,
        );
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, active]);

  return { item, loaded };
}

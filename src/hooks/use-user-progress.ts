import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { courses as allCourses } from "@/data/courses";
import type { Course } from "@/data/types";

export type ProgressByCourse = Record<
  string,
  {
    progress: number;
    lastWatchedAt: string | null;
    lastLessonId: string | null;
    completedLessons: Set<string>;
  }
>;


function totalLessons(course: Course): number {
  return course.modules?.reduce((n, m) => n + m.lessons.length, 0) ?? 0;
}

export function useUserProgress() {
  const [progress, setProgress] = useState<ProgressByCourse>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled) {
          setProgress({});
          setLoaded(true);
        }
        return;
      }
      const { data } = await supabase
        .from("lesson_progress")
        .select("course_id, lesson_id, completed, last_watched_at")
        .eq("user_id", u.user.id);

      const byCourse: ProgressByCourse = {};
      for (const row of data ?? []) {
        const bucket =
          byCourse[row.course_id] ??
          (byCourse[row.course_id] = {
            progress: 0,
            lastWatchedAt: null,
            lastLessonId: null,
            completedLessons: new Set<string>(),
          });
        if (row.completed) bucket.completedLessons.add(row.lesson_id);
        if (
          row.last_watched_at &&
          (!bucket.lastWatchedAt || row.last_watched_at > bucket.lastWatchedAt)
        ) {
          bucket.lastWatchedAt = row.last_watched_at;
          bucket.lastLessonId = row.lesson_id;
        }
      }

      for (const course of allCourses) {
        const bucket = byCourse[course.id];
        if (!bucket) continue;
        const total = totalLessons(course);
        bucket.progress = total > 0 ? bucket.completedLessons.size / total : 0;
      }
      if (!cancelled) {
        setProgress(byCourse);
        setLoaded(true);
      }
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { progress, loaded };
}

export function applyProgress(course: Course, progress: ProgressByCourse): Course {
  const p = progress[course.id];
  if (!p) return { ...course, progress: 0 };
  return { ...course, progress: p.progress };
}

export function continueFromProgress(progress: ProgressByCourse): Course[] {
  return allCourses
    .map((c) => ({ course: c, p: progress[c.id] }))
    .filter(({ p }) => p && p.progress > 0 && p.progress < 1)
    .sort((a, b) => {
      const ta = a.p?.lastWatchedAt ?? "";
      const tb = b.p?.lastWatchedAt ?? "";
      return tb.localeCompare(ta);
    })
    .map(({ course, p }) => ({ ...course, progress: p!.progress }));
}

export function recommendedFromProgress(progress: ProgressByCourse): Course[] {
  return allCourses
    .filter((c) => {
      const p = progress[c.id];
      return !p || p.progress === 0;
    })
    .slice(0, 6)
    .map((c) => ({ ...c, progress: 0 }));
}

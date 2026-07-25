import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { courses as allCourses } from "@/data/courses";
import type { Course } from "@/data/types";
import { parseDurationToMinutes } from "@/lib/course-duration";

export type ProgressByCourse = Record<
  string,
  {
    progress: number;
    lastWatchedAt: string | null;
    lastLessonId: string | null;
    completedLessons: Set<string>;
    watchedSeconds: Map<string, number>;
  }
>;


function totalLessons(course: Course): number {
  return course.modules?.reduce((n, m) => n + m.lessons.length, 0) ?? 0;
}

function lessonDurationSeconds(course: Course, lessonId: string): number {
  for (const mod of course.modules ?? []) {
    const lesson = mod.lessons.find((l) => l.id === lessonId);
    if (lesson) return parseDurationToMinutes(lesson.duration) * 60;
  }
  return 0;
}

export function useUserProgress() {
  const currentUserIdRef = useRef<string | null>(null);
  const [progress, setProgress] = useState<ProgressByCourse>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        currentUserIdRef.current = null;
        if (!cancelled) {
          setProgress({});
          setLoaded(true);
        }
        return;
      }
      const { data } = await supabase
        .from("lesson_progress")
        .select("course_id, lesson_id, completed, progress_seconds, last_watched_at")
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
            watchedSeconds: new Map<string, number>(),
          });
        if (row.completed) bucket.completedLessons.add(row.lesson_id);
        if ((row.progress_seconds ?? 0) > 0) {
          bucket.watchedSeconds.set(row.lesson_id, row.progress_seconds ?? 0);
        }
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
        let completedUnits = 0;
        for (const mod of course.modules ?? []) {
          for (const lesson of mod.lessons) {
            if (bucket.completedLessons.has(lesson.id)) {
              completedUnits += 1;
              continue;
            }
            const watched = bucket.watchedSeconds.get(lesson.id) ?? 0;
            if (watched > 0) {
              const duration = lessonDurationSeconds(course, lesson.id);
              completedUnits += duration > 0 ? Math.min(watched / duration, 0.95) : 0.05;
            }
          }
        }
        bucket.progress = total > 0 ? Math.min(completedUnits / total, 1) : 0;
      }
      if (!cancelled) {
        currentUserIdRef.current = u.user.id;
        setProgress(byCourse);
        setLoaded(true);
      }
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        currentUserIdRef.current = null;
        setProgress({});
        setLoaded(true);
        return;
      }
      if (event === "USER_UPDATED") {
        load();
        return;
      }
      if (event === "SIGNED_IN") {
        const nextUserId = session?.user?.id ?? null;
        if (nextUserId && nextUserId !== currentUserIdRef.current) {
          load();
        }
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { progress, loaded };
}
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

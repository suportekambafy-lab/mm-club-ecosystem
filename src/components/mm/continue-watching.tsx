import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { coursesById } from "@/data/courses";
import { lessonThumb } from "@/lib/course-duration";
import { courseCoverImage } from "@/lib/course-cover";
import { formatSeconds } from "@/components/mm/lesson-notes";

function durationSeconds(d: unknown): number {
  if (typeof d !== "string") return 0;
  const parts = d.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

type Item = { courseId: string; lessonId: string; seconds: number };

/** Retoma a última aula aberta e não terminada, no minuto exato. */
export function ContinueWatching({ userId }: { userId: string }) {
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("lesson_progress")
      .select("course_id, lesson_id, progress_seconds")
      .eq("user_id", userId)
      .eq("completed", false)
      .gt("progress_seconds", 20)
      .order("last_watched_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (cancelled) return;
        const row = (data ?? []).find((r) => coursesById[r.course_id]);
        setItem(row ? { courseId: row.course_id, lessonId: row.lesson_id, seconds: row.progress_seconds } : null);
      });
    return () => { cancelled = true; };
  }, [userId]);

  if (!item) return null;
  const course = coursesById[item.courseId];
  if (!course) return null;
  let found: { lesson: any; moduleTitle: string; minutes: number } | null = null;
  for (const m of course.modules ?? []) {
    const l = m.lessons.find((x: any) => x.id === item.lessonId);
    if (l) { found = { lesson: l, moduleTitle: m.title, minutes: durationSeconds((l as any).duration) / 60 }; break; }
  }
  if (!found) return null;
  const thumb = lessonThumb(found.lesson, course) || courseCoverImage(course);
  const total = Math.round(found.minutes * 60);
  const pct = total ? Math.min(100, Math.round((item.seconds / total) * 100)) : 0;

  return (
    <Link
      to="/academia/$courseId/$lessonId"
      params={{ courseId: course.id, lessonId: found.lesson.id }}
      search={{ t: item.seconds }}
      className="surface-card group flex items-center gap-4 p-3 pr-5 transition hover:border-primary/50"
    >
      <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:w-44" style={thumb ? { background: `url(${thumb}) center/cover no-repeat` } : undefined}>
        <span className="absolute inset-0 flex items-center justify-center bg-black/30"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Play className="ml-0.5 h-4 w-4" /></span></span>
        {pct > 0 && <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40"><span className="block h-full bg-primary" style={{ width: `${pct}%` }} /></span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-eyebrow text-primary">Continuar a assistir</span>
        <span className="mt-1 block truncate font-display text-base text-foreground">{found.lesson.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{course.title} · {found.moduleTitle}</span>
      </span>
      <span className="hidden shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground sm:inline">Retomar em {formatSeconds(item.seconds)}</span>
    </Link>
  );
}

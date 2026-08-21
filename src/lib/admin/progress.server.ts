/**
 * Progresso dos alunos — admin only, server only.
 * Lê `lesson_progress` com a service role e cruza com o catálogo efetivo
 * (cursos estáticos + edições do admin).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadEffectiveCourses } from "@/lib/jade-catalog.server";
import { parseDurationToMinutes } from "@/lib/course-duration";
import type { Course } from "@/data/types";
import type {
  CourseAggregate,
  ProgressOverview,
  StudentCourseProgress,
  StudentProgressRow,
} from "./progress-types";

const DAY = 86_400_000;

type FlatLesson = { id: string; title: string; index: number; seconds: number };

function flattenLessons(course: Course): FlatLesson[] {
  const out: FlatLesson[] = [];
  for (const mod of course.modules ?? []) {
    for (const lesson of mod.lessons ?? []) {
      out.push({
        id: lesson.id,
        title: lesson.title,
        index: out.length + 1,
        seconds: parseDurationToMinutes(lesson.duration) * 60,
      });
    }
  }
  return out;
}

export async function collectProgressOverview(): Promise<ProgressOverview> {
  const courses = await loadEffectiveCourses();
  const lessonsByCourse = new Map<string, FlatLesson[]>();
  const courseTitle = new Map<string, string>();
  for (const c of courses) {
    lessonsByCourse.set(c.id, flattenLessons(c));
    courseTitle.set(c.id, c.title);
  }
  const catalogLessons = [...lessonsByCourse.values()].reduce((n, l) => n + l.length, 0);

  const rows: Array<{
    user_id: string;
    course_id: string;
    lesson_id: string;
    completed: boolean;
    progress_seconds: number;
    last_watched_at: string;
  }> = [];

  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("lesson_progress")
      .select("user_id, course_id, lesson_id, completed, progress_seconds, last_watched_at")
      .order("last_watched_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
    if (from > 50_000) break;
  }

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const nameById = new Map<string, string>();
  const avatarById = new Map<string, string | null>();
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200);
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", chunk);
    for (const p of data ?? []) {
      nameById.set(p.id, p.display_name || "Aluno");
      avatarById.set(p.id, p.avatar_url ?? null);
    }
  }

  // user -> course -> lesson rows
  const byUser = new Map<string, Map<string, typeof rows>>();
  for (const r of rows) {
    const perUser = byUser.get(r.user_id) ?? new Map<string, typeof rows>();
    byUser.set(r.user_id, perUser);
    const list = perUser.get(r.course_id) ?? [];
    list.push(r);
    perUser.set(r.course_id, list);
  }

  const students: StudentProgressRow[] = [];
  const aggregate = new Map<string, CourseAggregate>();

  for (const [userId, perUser] of byUser) {
    const courseRows: StudentCourseProgress[] = [];
    let totalCompleted = 0;
    let totalStarted = 0;
    let watchedSeconds = 0;
    let lastActivityAt: string | null = null;
    let weightedDone = 0;
    let weightedTotal = 0;

    for (const [courseId, lessonRows] of perUser) {
      const flat = lessonsByCourse.get(courseId) ?? [];
      const known = new Set(flat.map((l) => l.id));
      const relevant = lessonRows.filter((r) => known.size === 0 || known.has(r.lesson_id));
      if (relevant.length === 0) continue;

      const completedIds = new Set(relevant.filter((r) => r.completed).map((r) => r.lesson_id));
      const secondsById = new Map(relevant.map((r) => [r.lesson_id, r.progress_seconds ?? 0]));
      const courseWatched = relevant.reduce((n, r) => n + (r.progress_seconds ?? 0), 0);
      const total = flat.length || relevant.length;

      let last: (typeof relevant)[number] | null = null;
      for (const r of relevant) {
        if (!last || r.last_watched_at > last.last_watched_at) last = r;
      }
      const currentFlat = flat.find((l) => l.id === last?.lesson_id) ?? null;
      const nextFlat = flat.find((l) => !completedIds.has(l.id)) ?? null;

      const percent = total > 0 ? Math.round((completedIds.size / total) * 100) : 0;
      const entry: StudentCourseProgress = {
        courseId,
        courseTitle: courseTitle.get(courseId) ?? courseId,
        totalLessons: total,
        completedLessons: completedIds.size,
        startedLessons: relevant.length,
        percent,
        watchedSeconds: courseWatched,
        lastWatchedAt: last?.last_watched_at ?? null,
        currentLessonId: last?.lesson_id ?? null,
        currentLessonTitle: currentFlat?.title ?? null,
        currentLessonIndex: currentFlat?.index ?? null,
        currentLessonSeconds: secondsById.get(last?.lesson_id ?? "") ?? 0,
        nextLessonTitle: nextFlat?.title ?? null,
        nextLessonIndex: nextFlat?.index ?? null,
        finished: total > 0 && completedIds.size >= total,
      };
      courseRows.push(entry);

      totalCompleted += completedIds.size;
      totalStarted += relevant.length;
      watchedSeconds += courseWatched;
      weightedDone += completedIds.size;
      weightedTotal += total;
      if (entry.lastWatchedAt && (!lastActivityAt || entry.lastWatchedAt > lastActivityAt)) {
        lastActivityAt = entry.lastWatchedAt;
      }

      const agg =
        aggregate.get(courseId) ??
        ({
          courseId,
          courseTitle: entry.courseTitle,
          totalLessons: total,
          students: 0,
          finishers: 0,
          avgPercent: 0,
          completions: 0,
          lastActivityAt: null,
        } satisfies CourseAggregate);
      agg.students += 1;
      agg.completions += completedIds.size;
      if (entry.finished) agg.finishers += 1;
      agg.avgPercent += percent;
      if (entry.lastWatchedAt && (!agg.lastActivityAt || entry.lastWatchedAt > agg.lastActivityAt)) {
        agg.lastActivityAt = entry.lastWatchedAt;
      }
      aggregate.set(courseId, agg);
    }

    if (courseRows.length === 0) continue;
    courseRows.sort((a, b) => (b.lastWatchedAt ?? "").localeCompare(a.lastWatchedAt ?? ""));
    const active = courseRows[0];

    students.push({
      userId,
      name: nameById.get(userId) ?? "Aluno",
      avatarUrl: avatarById.get(userId) ?? null,
      totalCompleted,
      totalStarted,
      watchedSeconds,
      coursesStarted: courseRows.length,
      coursesFinished: courseRows.filter((c) => c.finished).length,
      overallPercent: weightedTotal > 0 ? Math.round((weightedDone / weightedTotal) * 100) : 0,
      lastActivityAt,
      activeCourseTitle: active?.courseTitle ?? null,
      activeLessonTitle: active?.currentLessonTitle ?? null,
      courses: courseRows,
    });
  }

  students.sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));

  const now = Date.now();
  const activeSince = (days: number) =>
    students.filter(
      (s) => s.lastActivityAt && now - new Date(s.lastActivityAt).getTime() <= days * DAY,
    ).length;

  const courseList = [...aggregate.values()].map((c) => ({
    ...c,
    avgPercent: c.students > 0 ? Math.round(c.avgPercent / c.students) : 0,
  }));
  courseList.sort((a, b) => b.students - a.students);

  // ---- Evolução diária (últimos 30 dias) ----
  const WINDOW_DAYS = 30;
  const dayKeys: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) {
    dayKeys.push(new Date(now - i * DAY).toISOString().slice(0, 10));
  }
  const dayIndex = new Set(dayKeys);

  type Bucket = { users: Set<string>; completed: number; seconds: number };
  const emptySeries = () => new Map<string, Bucket>();
  const globalSeries = emptySeries();
  const perCourseSeries = new Map<string, Map<string, Bucket>>();

  const touch = (series: Map<string, Bucket>, day: string) => {
    const b = series.get(day) ?? { users: new Set<string>(), completed: 0, seconds: 0 };
    series.set(day, b);
    return b;
  };

  for (const r of rows) {
    if (!r.last_watched_at) continue;
    const day = r.last_watched_at.slice(0, 10);
    if (!dayIndex.has(day)) continue;
    const g = touch(globalSeries, day);
    g.users.add(r.user_id);
    if (r.completed) g.completed += 1;
    g.seconds += r.progress_seconds ?? 0;

    const cs = perCourseSeries.get(r.course_id) ?? emptySeries();
    perCourseSeries.set(r.course_id, cs);
    const c = touch(cs, day);
    c.users.add(r.user_id);
    if (r.completed) c.completed += 1;
    c.seconds += r.progress_seconds ?? 0;
  }

  const toPoints = (series: Map<string, Bucket>) =>
    dayKeys.map((date) => {
      const b = series.get(date);
      return {
        date,
        activeStudents: b?.users.size ?? 0,
        lessonsCompleted: b?.completed ?? 0,
        watchedHours: b ? Math.round(((b.seconds ?? 0) / 3600) * 10) / 10 : 0,
      };
    });

  const timelineByCourse = courseList.map((c) => ({
    courseId: c.courseId,
    courseTitle: c.courseTitle,
    points: toPoints(perCourseSeries.get(c.courseId) ?? emptySeries()),
  }));

  return {
    timeline: toPoints(globalSeries),
    timelineByCourse,
    generatedAt: new Date().toISOString(),
    totalStudents: students.length,
    activeLast7Days: activeSince(7),
    activeLast30Days: activeSince(30),
    totalCompletions: students.reduce((n, s) => n + s.totalCompleted, 0),
    totalWatchedSeconds: students.reduce((n, s) => n + s.watchedSeconds, 0),
    catalogLessons,
    students,
    courses: courseList,
  };
}

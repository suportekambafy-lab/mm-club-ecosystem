import type { Course, Lesson, Module } from "@/data/types";
import type { ProgressByCourse } from "@/hooks/use-user-progress";
import { computeLessonsCount, parseDurationToMinutes } from "@/lib/course-duration";

/**
 * Trilho guiado: qual é, em concreto, o próximo passo do membro.
 *
 * Regra: retomamos o curso com atividade mais recente e ainda por concluir;
 * se não houver nenhum, começamos pelo primeiro curso acessível. Dentro do
 * curso a próxima aula é a primeira não concluída (a partir da última vista),
 * para o membro nunca ter de decidir por onde continuar.
 */
export type NextStep = {
  kind: "start" | "resume" | "finish";
  course: Course;
  module: Module;
  lesson: Lesson;
  /** Índice (1-based) da aula dentro do curso e total de aulas. */
  lessonIndex: number;
  lessonsTotal: number;
  lessonsDone: number;
  /** Aulas que faltam no módulo atual. */
  moduleRemaining: number;
  moduleTotal: number;
  /** Aulas que faltam para o certificado do curso. */
  certificateRemaining: number;
  coursePercent: number;
  minutes: number;
};

function flatten(course: Course): Array<{ module: Module; lesson: Lesson }> {
  const out: Array<{ module: Module; lesson: Lesson }> = [];
  for (const m of course.modules ?? []) {
    for (const l of m.lessons) out.push({ module: m, lesson: l });
  }
  return out;
}

function pickCourse(courses: Course[], progress: ProgressByCourse): Course | null {
  const started = courses
    .map((c) => ({ c, p: progress[c.id] }))
    .filter(({ p }) => p && p.progress > 0 && p.progress < 1)
    .sort((a, b) => (b.p?.lastWatchedAt ?? "").localeCompare(a.p?.lastWatchedAt ?? ""));
  if (started[0]) return started[0].c;
  const untouched = courses.find((c) => !progress[c.id] || progress[c.id]!.progress === 0);
  return untouched ?? courses[0] ?? null;
}

export function computeNextStep(
  courses: Course[],
  progress: ProgressByCourse,
): NextStep | null {
  const course = pickCourse(courses, progress);
  if (!course) return null;

  const items = flatten(course);
  if (items.length === 0) return null;

  const bucket = progress[course.id];
  const completed = bucket?.completedLessons ?? new Set<string>();
  const lessonsTotal = computeLessonsCount(course);
  const lessonsDone = items.filter(({ lesson }) => completed.has(lesson.id)).length;

  const lastIndex = bucket?.lastLessonId
    ? items.findIndex(({ lesson }) => lesson.id === bucket.lastLessonId)
    : -1;

  // Primeiro não concluído a partir da última aula vista; se todas as
  // seguintes estiverem feitas, procura desde o início.
  let idx = -1;
  if (lastIndex >= 0) {
    idx = items.findIndex(({ lesson }, i) => i >= lastIndex && !completed.has(lesson.id));
  }
  if (idx < 0) idx = items.findIndex(({ lesson }) => !completed.has(lesson.id));
  if (idx < 0) idx = Math.max(lastIndex, 0);

  const { module, lesson } = items[idx]!;
  const moduleTotal = module.lessons.length;
  const moduleRemaining = module.lessons.filter((l) => !completed.has(l.id)).length;
  const certificateRemaining = Math.max(lessonsTotal - lessonsDone, 0);

  const kind: NextStep["kind"] =
    lessonsDone === 0 ? "start" : certificateRemaining <= 2 ? "finish" : "resume";

  return {
    kind,
    course,
    module,
    lesson,
    lessonIndex: idx + 1,
    lessonsTotal,
    lessonsDone,
    moduleRemaining,
    moduleTotal,
    certificateRemaining,
    coursePercent: Math.round((bucket?.progress ?? 0) * 100),
    minutes: Math.max(1, parseDurationToMinutes(lesson.duration)),
  };
}

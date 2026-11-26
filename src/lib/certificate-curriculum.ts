import { z } from "zod";
import type { Course } from "@/data/types";
import { parseDurationToSeconds } from "./course-duration";

const lessonSchema = z.object({ id: z.string().trim().min(1), duration: z.string().min(1) }).passthrough();
const moduleSchema = z.object({ lessons: z.array(lessonSchema) }).passthrough();
const overrideSchema = z.object({
  courses: z.record(z.object({ title: z.string().trim().min(1).optional(), releaseAt: z.string().optional() }).passthrough()).default({}),
  modulesByCourse: z.record(z.array(moduleSchema)).default({}),
  lessons: z.record(z.object({ duration: z.string().optional() }).passthrough()).default({}),
  newCourses: z.array(z.object({ id: z.string().min(1), title: z.string().min(1), releaseAt: z.string().optional(), modules: z.array(moduleSchema) }).passthrough()).default([]),
});

/** Canonical certificate values mirror catalogue overrides, never client totals. */
export function certificateCurriculum(base: Course[], rawOverrides: unknown, courseId: string) {
  const overrides = overrideSchema.parse(rawOverrides ?? {});
  const source = base.find((c) => c.id === courseId) ?? overrides.newCourses.find((c) => c.id === courseId);
  if (!source) throw new Error("Curso não encontrado.");
  const patch = overrides.courses[courseId];
  const title = patch?.title ?? source.title;
  const releaseAt = patch?.releaseAt ?? source.releaseAt;
  const modules = overrides.modulesByCourse[courseId] ?? source.modules ?? [];
  const lessons = modules.flatMap((m) => m.lessons).map((l) => {
    const id = z.string().trim().min(1).parse(l.id);
    const duration = overrides.lessons[id]?.duration ?? l.duration;
    const seconds = parseDurationToSeconds(duration);
    if (seconds <= 0 || !Number.isFinite(seconds)) throw new Error("Duração da aula indisponível.");
    return { id, seconds };
  });
  if (!lessons.length || new Set(lessons.map((l) => l.id)).size !== lessons.length) throw new Error("Aulas do curso inválidas.");
  return { title, releaseAt, lessonIds: lessons.map((l) => l.id), hours: Math.round(lessons.reduce((sum, l) => sum + l.seconds, 0) / 360) / 10 };
}
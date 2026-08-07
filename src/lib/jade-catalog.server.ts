import { courses as staticCourses } from "@/data/courses";
import type { Course, Module } from "@/data/types";

/**
 * Catálogo efetivo: cursos estáticos + cursos/edições feitos no admin
 * (guardados na linha `admin_overrides` com id "courses").
 */
export async function loadEffectiveCourses(): Promise<Course[]> {
  const base: Course[] = staticCourses.map((c) => ({ ...c }));
  const byId = new Map<string, Course>(base.map((c) => [c.id, c]));

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("admin_overrides")
      .select("data")
      .eq("id", "courses")
      .maybeSingle();
    const ov = (data?.data ?? {}) as {
      courses?: Record<string, Partial<Course>>;
      modulesByCourse?: Record<string, Module[]>;
      newCourses?: Course[];
    };

    for (const custom of ov.newCourses ?? []) {
      if (!custom?.id || byId.has(custom.id)) continue;
      const copy = { ...custom } as Course;
      byId.set(copy.id, copy);
      base.push(copy);
    }

    for (const [id, patch] of Object.entries(ov.courses ?? {})) {
      const c = byId.get(id);
      if (c && patch) Object.assign(c, patch);
    }

    for (const [id, mods] of Object.entries(ov.modulesByCourse ?? {})) {
      const c = byId.get(id);
      if (c && Array.isArray(mods)) {
        c.modules = mods;
        c.lessonsCount = mods.reduce((s, m) => s + (m.lessons?.length ?? 0), 0);
      }
    }
  } catch {
    // sem acesso às overrides: usa o catálogo estático
  }

  return base;
}

export function buildCatalogOutline(courses: Course[]): string {
  const lines: string[] = [];
  lines.push(`\n\nCURSOS DISPONÍVEIS (${courses.length}): ${courses.map((c) => c.title).join(", ")}\n`);
  for (const course of courses) {
    lines.push(
      `### ${course.title} (id: ${course.id}) — ${course.lessonsCount ?? 0} aulas · ${course.duration ?? "—"}`,
    );
    if (course.tagline) lines.push(course.tagline);
    let n = 0;
    for (const mod of course.modules ?? []) {
      lines.push(`- Módulo: ${mod.title}`);
      for (const lesson of mod.lessons ?? []) {
        n += 1;
        lines.push(
          `  - Aula ${n}: ${lesson.title} (${lesson.duration ?? "—"}) → /academia/${course.id}/${lesson.id}`,
        );
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function courseTitles(courses: Course[]): string {
  return courses.map((c) => c.title).join(", ");
}

/**
 * Detecta referências ambíguas a aulas/módulos sem curso identificado no
 * histórico da conversa (ex.: "o que fala a aula 5?").
 */
export function detectAmbiguousLessonReference(
  lastUserText: string,
  conversationText: string,
  courses: Course[],
): string | null {
  const ref = /\b(aula|aulas|m[oó]dulo|m[oó]dulos|v[ií]deo)\s*(n[.º°]?\s*)?\d+/i.test(lastUserText);
  if (!ref) return null;
  const haystack = conversationText.toLowerCase();
  const mentioned = courses.filter((c) => {
    const title = c.title.toLowerCase();
    return haystack.includes(title) || haystack.includes(c.id.toLowerCase());
  });
  if (mentioned.length === 1) return null;
  return courses.map((c) => `[[${c.title}]]`).join("\n");
}

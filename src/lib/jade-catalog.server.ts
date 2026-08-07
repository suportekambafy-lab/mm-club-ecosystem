import { courses } from "@/data/courses";

/**
 * Estrutura real da Academia (cursos → módulos → aulas) para dar ao agente
 * consciência do catálogo e permitir desambiguar perguntas como "a aula 5".
 */
export function buildCatalogOutline(): string {
  const lines: string[] = [];
  for (const course of courses) {
    lines.push(
      `### ${course.title} (id: ${course.id}) — ${course.lessonsCount ?? 0} aulas · ${course.duration ?? "—"}`,
    );
    if (course.tagline) lines.push(course.tagline);
    let n = 0;
    for (const mod of course.modules ?? []) {
      lines.push(`- Módulo: ${mod.title}`);
      for (const lesson of mod.lessons) {
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

export function courseTitles(): string {
  return courses.map((c) => c.title).join(", ");
}

/**
 * Detecta referências ambíguas a aulas/módulos sem curso identificado no
 * histórico da conversa (ex.: "o que fala a aula 5?").
 */
export function detectAmbiguousLessonReference(
  lastUserText: string,
  conversationText: string,
): string | null {
  const ref = /\b(aula|aulas|m[oó]dulo|m[oó]dulos|v[ií]deo)\s*(n[.º°]?\s*)?\d+/i.test(lastUserText);
  if (!ref) return null;
  const haystack = conversationText.toLowerCase();
  const mentioned = courses.filter((c) => {
    const title = c.title.toLowerCase();
    return haystack.includes(title) || haystack.includes(c.id.toLowerCase());
  });
  if (mentioned.length === 1) return null;
  return courses.map((c, i) => `${i + 1}. ${c.title}`).join("\n");
}

import type { Course } from "@/data/types";

/** Curso em destaque no catálogo — aparece sempre primeiro. */
export const FEATURED_COURSE_ID = "marca-milionaria-legacy";
/** Curso original — fica sempre no fim da lista. */
export const LAST_COURSE_ID = "marca-milionaria";

export function isFeaturedCourse(course: Pick<Course, "id">) {
  return course.id === FEATURED_COURSE_ID;
}

function rank(id: string) {
  if (id === FEATURED_COURSE_ID) return -1;
  if (id === LAST_COURSE_ID) return 1;
  return 0;
}

/** Ordena mantendo a ordem original, mas com o Legacy à frente e o Marca Milionária no fim. */
export function sortCatalog<T extends { id: string }>(list: T[]): T[] {
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item.id) - rank(b.item.id) || a.index - b.index)
    .map(({ item }) => item);
}

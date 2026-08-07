import { useCallback } from "react";
import type { Course } from "@/data/types";
import { isCourseReleased } from "@/data/courses";
import { useCurrentUser } from "@/hooks/use-current-user";

/** Um curso "em breve" tem pré-visualização de admin se já tiver aulas. */
export function courseHasLessons(course: Course) {
  return (course.modules ?? []).some((m) => (m.lessons ?? []).length > 0);
}

/**
 * Devolve uma função que decide se um curso está acessível.
 * Admins podem abrir cursos "em breve" que já tenham aulas carregadas.
 */
export function useCourseAccess() {
  const { isAdmin } = useCurrentUser();
  const canOpen = useCallback(
    (course: Course) =>
      isCourseReleased(course) || (isAdmin && courseHasLessons(course)),
    [isAdmin],
  );
  return { isAdmin, canOpen };
}

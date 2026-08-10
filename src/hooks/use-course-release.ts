import { useCallback } from "react";
import type { Course } from "@/data/types";
import { isCourseReleased } from "@/data/courses";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTicker } from "@/hooks/use-ticker";

/** Um curso "em breve" tem pré-visualização de admin se já tiver aulas. */
export function courseHasLessons(course: Course) {
  return (course.modules ?? []).some((m) => (m.lessons ?? []).length > 0);
}

/**
 * Devolve uma função que decide se um curso está acessível.
 * Admins podem abrir cursos "em breve" que já tenham aulas carregadas.
 *
 * Usa o relógio central para reavaliar o acesso ao segundo: quando o contador
 * de lançamento chega a zero, o curso desbloqueia sem recarregar a página.
 */
export function useCourseAccess() {
  const { isAdmin } = useCurrentUser();
  const now = useTicker(1000);
  const canOpen = useCallback(
    (course: Course) =>
      isCourseReleased(course, new Date(now)) ||
      (isAdmin && courseHasLessons(course)),
    [isAdmin, now],
  );
  return { isAdmin, canOpen };
}

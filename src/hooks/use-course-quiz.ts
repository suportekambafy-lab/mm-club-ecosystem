import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCourseQuizState, type QuizModuleState } from "@/lib/quiz.functions";
import { useAccessToken } from "@/hooks/use-access-token";

export type CourseQuizState = {
  staff: boolean;
  modules: Record<string, QuizModuleState>;
  loaded: boolean;
  refetch: () => void;
};

/**
 * Estado dos testes de fim de módulo do curso: quais estão publicados e quais
 * o membro já aprovou. Usado para desbloquear o módulo seguinte.
 */
export function useCourseQuiz(courseId: string): CourseQuizState {
  const fetchState = useServerFn(getCourseQuizState);
  // Só chamar com sessão hidratada: sem token o pedido falha com 500.
  const { token } = useAccessToken();
  const q = useQuery({
    queryKey: ["course-quiz-state", courseId, Boolean(token)],
    queryFn: () => fetchState({ data: { courseId } }),
    enabled: Boolean(token),
    staleTime: 30_000,
    retry: false,
  });

  const modules: Record<string, QuizModuleState> = {};
  for (const m of q.data?.modules ?? []) modules[m.moduleId] = m;

  return {
    staff: Boolean(q.data?.staff),
    modules,
    loaded: q.isSuccess,
    refetch: () => void q.refetch(),
  };
}

/**
 * Devolve o conjunto de módulos bloqueados: um módulo fica bloqueado quando
 * algum módulo anterior tem teste publicado e ainda não foi aprovado.
 */
export function lockedModuleIds(
  moduleIds: string[],
  state: CourseQuizState,
): { locked: Set<string>; blockedBy: Record<string, string> } {
  const locked = new Set<string>();
  const blockedBy: Record<string, string> = {};
  if (state.staff || !state.loaded) return { locked, blockedBy };

  let blocker: string | null = null;
  for (const id of moduleIds) {
    if (blocker) {
      locked.add(id);
      blockedBy[id] = blocker;
      continue;
    }
    const m = state.modules[id];
    if (m?.published && m.questionsAvailable > 0 && !m.passed) blocker = id;
  }
  return { locked, blockedBy };
}

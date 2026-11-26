/**
 * Regra de deduplicação da página inicial.
 *
 * "Continuar a assistir" e "O teu próximo passo" apontam quase sempre para a
 * mesma aula. Quando apontam, é o cartão do próximo passo que mostra o minuto
 * exato de retoma e o outro simplesmente não aparece.
 */

/** Aula que o membro deixou a meio, com o segundo exato. */
export type ResumeItem = { courseId: string; lessonId: string; seconds: number };

/** Aula para onde o cartão "próximo passo" aponta. */
export type StepRef = { courseId: string; lessonId: string } | null;

/** O cartão do próximo passo já mostra esta aula? */
export function resumeMatchesStep(resume: ResumeItem | null, step: StepRef): boolean {
  if (!resume || !step) return false;
  return resume.courseId === step.courseId && resume.lessonId === step.lessonId;
}

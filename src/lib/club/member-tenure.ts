/** Selo de antiguidade do membro na comunidade (null quando ainda não tem 1 mês). */
export function memberTenureLabel(createdAt: string | null | undefined, now: Date = new Date()): string | null {
  if (!createdAt) return null;
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return null;
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 1) return null;
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return years === 1 ? "Membro há 1 ano" : `Membro há ${years} anos`;
  }
  return months === 1 ? "Membro há 1 mês" : `Membro há ${months} meses`;
}

export type OnboardingFacts = { watchedLesson: boolean; profileDone: boolean; posted: boolean; askedAi: boolean };

/** Passos do checklist de boas-vindas, pela ordem mostrada ao aluno. */
export function onboardingSteps(f: OnboardingFacts) {
  return [
    { key: "aula", label: "Assistir à primeira aula", done: f.watchedLesson, to: "/academia" },
    { key: "perfil", label: "Completar o perfil (foto e bio)", done: f.profileDone, to: "/perfil" },
    { key: "comunidade", label: "Apresentar-te na comunidade", done: f.posted, to: "/comunidade" },
    { key: "ia", label: "Fazer a primeira pergunta ao MM Inteligence", done: f.askedAi, to: "/jade" },
  ] as const;
}

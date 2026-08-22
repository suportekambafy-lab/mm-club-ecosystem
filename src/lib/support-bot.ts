/**
 * MM Suporte — identidade do agente oficial na Comunidade.
 * Este perfil não tem login: responde apenas via IA no servidor.
 */
export const SUPPORT_BOT_ID = "27d0a73c-39a7-4a4c-a49b-4ed78c1bc411";
export const SUPPORT_BOT_NAME = "MM Suporte";

/** O agente mostra selo de verificado, como a equipa. */
export function isSupportBot(userId: string | null | undefined): boolean {
  return !!userId && userId === SUPPORT_BOT_ID;
}

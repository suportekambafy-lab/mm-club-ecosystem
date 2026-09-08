/**
 * Acesso limitado para quem está em dívida.
 *
 * Um membro suspenso continua a poder entrar no clube — vê o painel, o
 * catálogo da academia e a sua área de subscrição. O que fica trancado é o
 * conteúdo: aulas, comunidade, MM Inteligence, ferramentas, lives e shorts.
 */
export const LOCKED_PREFIXES = [
  "/jade",
  "/comunidade",
  "/ferramentas",
  "/lives",
  "/shorts",
] as const;

export function isLockedPath(pathname: string): boolean {
  return LOCKED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

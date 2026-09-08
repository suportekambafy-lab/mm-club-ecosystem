/**
 * Modo "Entrar como cliente" (admin).
 *
 * Não troca de sessão — o admin continua autenticado como ele mesmo. O que
 * mudamos é a *vista*: a app passa a calcular o acesso com o estado real da
 * conta escolhida, para o admin ver exactamente o que esse membro vê
 * (conteúdo trancado, aviso de dívida, menu bloqueado).
 */
export type ViewAsTarget = {
  userId: string;
  name: string;
  email: string;
  /** Acesso real do membro (entitlement academy.access). */
  hasAccess: boolean;
  status?: string | null;
};

const KEY = "mm_view_as_v1";
const EVENT = "mm-view-as-change";

export function getViewAs(): ViewAsTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ViewAsTarget) : null;
  } catch {
    return null;
  }
}

export function setViewAs(target: ViewAsTarget) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(target));
  window.dispatchEvent(new Event(EVENT));
}

export function clearViewAs() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeViewAs(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

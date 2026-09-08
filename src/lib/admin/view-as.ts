/**
 * Modo "Entrar como cliente" (admin).
 *
 * O admin passa a estar mesmo autenticado na conta do membro. Guardamos a
 * sessão do admin para poder voltar atrás com um clique, e um marcador da
 * conta em uso para mostrar a barra de contexto.
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

/** Sessão do admin, guardada para regressar depois do modo cliente. */
const ADMIN_KEY = "mm_admin_session_v1";

export type SavedSession = { access_token: string; refresh_token: string };

export function saveAdminSession(s: SavedSession) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ADMIN_KEY, JSON.stringify(s));
}

export function takeAdminSession(): SavedSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(ADMIN_KEY);
  window.sessionStorage.removeItem(ADMIN_KEY);
  try {
    return raw ? (JSON.parse(raw) as SavedSession) : null;
  } catch {
    return null;
  }
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

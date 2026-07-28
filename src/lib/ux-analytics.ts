/**
 * UX analytics — métricas anónimas de experiência (sem dados pessoais).
 *
 * Só regista o tipo de evento e um contexto curto (página/ação). Nunca envia
 * conteúdo escrito pelo membro, emails, ids de pagamento ou tokens.
 */

export type UxEvent =
  | "toast_shown"
  | "dialog_opened"
  | "dialog_confirmed"
  | "dialog_cancelled"
  | "retry_clicked"
  | "inline_error_shown"
  | "empty_state_shown"
  | "loading_time_dashboard"
  | "loading_time_page"
  | "search_used";

type UxProps = {
  /** Zona da app: "dashboard", "comunidade", "shorts"… */
  surface?: string;
  /** Ação concreta: "delete_post", "update_card"… */
  action?: string;
  /** Duração em ms, para eventos de carregamento. */
  ms?: number;
  /** Categoria do erro, nunca a mensagem crua do servidor. */
  reason?: string;
};

const POSTHOG_TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY as
  | string
  | undefined;
const POSTHOG_HOST =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_REGION as string | undefined) === "us"
    ? "https://us.i.posthog.com"
    : "https://eu.i.posthog.com";

/** Id anónimo e estável por dispositivo — não identifica a pessoa. */
function anonId(): string {
  try {
    const key = "mm_ux_anon_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

export function trackUx(event: UxEvent, props: UxProps = {}) {
  if (typeof window === "undefined") return;
  const payload = {
    ...props,
    path: window.location.pathname,
    $process_person_profile: false,
  };

  if (import.meta.env.DEV) {
    console.debug("[ux]", event, payload);
  }

  if (!POSTHOG_TOKEN) return;
  try {
    const body = JSON.stringify({
      api_key: POSTHOG_TOKEN,
      event,
      distinct_id: anonId(),
      properties: payload,
    });
    // keepalive para o evento sobreviver a navegações imediatas.
    void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* métricas nunca podem partir a app */
  }
}

/** Mede quanto tempo uma zona demorou a ficar realmente visível. */
export function trackLoadTime(surface: string, startedAt: number) {
  const ms = Math.round(performance.now() - startedAt);
  if (!Number.isFinite(ms) || ms < 0) return;
  trackUx(surface === "dashboard" ? "loading_time_dashboard" : "loading_time_page", {
    surface,
    ms,
  });
}

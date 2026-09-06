/**
 * Estratégia de apresentação da oferta Shopify (3 meses grátis).
 *
 * Objetivo: mostrar a oferta no momento de maior intenção (durante/depois de
 * uma aula sobre Shopify) e não incomodar quem já clicou ou já dispensou.
 *
 * Regras:
 * - Quem clica no link nunca volta a ver o popup.
 * - Máximo de 4 aparições por dispositivo (no total).
 * - Escada de espera entre aparições: 3 dias → 10 dias → 30 dias.
 * - Nunca aparece na primeira visita do dispositivo (só a partir do 2º dia)
 *   — exceto no contexto de aula sobre Shopify, onde a intenção é imediata.
 * - Máximo de uma aparição por dia, seja qual for o contexto.
 */

const KEY = "mm_shopify_promo_v2";
const DAY = 24 * 60 * 60 * 1000;

/** Momentos em que a oferta pode surgir. */
export type ShopifyPromoTrigger = "dashboard" | "lesson-start" | "lesson-end";

type PromoState = {
  firstSeenAt: number;
  lastShownAt: number;
  shows: number;
  clicked: boolean;
};

const WAIT_LADDER = [3 * DAY, 10 * DAY, 30 * DAY];
const MAX_SHOWS = 4;

function read(): PromoState {
  const base: PromoState = { firstSeenAt: 0, lastShownAt: 0, shows: 0, clicked: false };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      // Migração do formato antigo (só guardava a data da última vista).
      const legacy = Number(window.localStorage.getItem("mm_shopify_promo_seen_at") ?? 0);
      if (legacy > 0) return { ...base, firstSeenAt: legacy, lastShownAt: legacy, shows: 1 };
      return base;
    }
    const parsed = JSON.parse(raw) as Partial<PromoState>;
    return {
      firstSeenAt: Number(parsed.firstSeenAt) || 0,
      lastShownAt: Number(parsed.lastShownAt) || 0,
      shows: Number(parsed.shows) || 0,
      clicked: Boolean(parsed.clicked),
    };
  } catch {
    return base;
  }
}

function write(state: PromoState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage indisponível */
  }
}

/** Marca a primeira visita do dispositivo (usada para não incomodar logo). */
export function touchShopifyPromo() {
  const state = read();
  if (state.firstSeenAt) return;
  write({ ...state, firstSeenAt: Date.now() });
}

/** Decide se a oferta pode aparecer agora, neste contexto. */
export function canShowShopifyPromo(trigger: ShopifyPromoTrigger): boolean {
  const state = read();
  if (state.clicked) return false;
  if (state.shows >= MAX_SHOWS) return false;

  const now = Date.now();
  const contextual = trigger !== "dashboard";

  // Nunca duas vezes no mesmo dia.
  if (state.lastShownAt && now - state.lastShownAt < DAY) return false;

  if (state.shows > 0) {
    const wait = WAIT_LADDER[Math.min(state.shows - 1, WAIT_LADDER.length - 1)]!;
    // Num momento de aula sobre Shopify a espera é mais curta (metade).
    const effective = contextual ? wait / 2 : wait;
    if (now - state.lastShownAt < effective) return false;
  } else if (!contextual) {
    // Primeira aparição fora de contexto: só a partir do 2º dia no clube.
    if (!state.firstSeenAt || now - state.firstSeenAt < DAY) return false;
  }

  return true;
}

/** Registra que a oferta foi mostrada. */
export function markShopifyPromoShown() {
  const state = read();
  write({
    ...state,
    firstSeenAt: state.firstSeenAt || Date.now(),
    lastShownAt: Date.now(),
    shows: state.shows + 1,
  });
}

/** Registra que o membro seguiu o link — não voltamos a mostrar. */
export function markShopifyPromoClicked() {
  write({ ...read(), clicked: true, lastShownAt: Date.now() });
}

const SHOPIFY_TOPIC = /(shopify|loja\s*online|dropship|checkout|e-?commerce)/i;

/** A aula/módulo/curso fala de Shopify? Define os momentos contextuais. */
export function isShopifyContext(...texts: Array<string | null | undefined>): boolean {
  return texts.some((t) => !!t && SHOPIFY_TOPIC.test(t));
}

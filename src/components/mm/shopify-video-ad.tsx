import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, SkipForward, X } from "lucide-react";
import {
  canShowShopifyAd,
  markShopifyAdShown,
  markShopifyPromoClicked,
  type ShopifyPromoTrigger,
} from "@/lib/shopify-promo";

const SHOPIFY_URL = "https://shopify.pxf.io/c/7738721/1061744/13624";

/** Verde institucional Shopify (marca de terceiro, fora do tema MM). */
const BRAND = "#008060";

/** Segundos antes de o botão "Ignorar anúncio" ficar ativo. */
const SKIP_AFTER = 5;

type AdTrigger = Extract<ShopifyPromoTrigger, "lesson-start" | "lesson-end">;

const COPY: Record<AdTrigger, { eyebrow: string; title: string; sub: string; cta: string; delay: number }> = {
  "lesson-start": {
    eyebrow: "Oferta parceiro MM Club",
    title: "3 meses grátis no Shopify",
    sub: "Abre a conta pelo link do clube e acompanha esta aula a montar a tua loja.",
    cta: "Abrir a minha conta",
    delay: 3500,
  },
  "lesson-end": {
    eyebrow: "Passa à prática",
    title: "3 meses grátis no Shopify",
    sub: "Acabaste a aula — aplica agora na tua própria loja, sem pagar a plataforma.",
    cta: "Montar a minha loja",
    delay: 1200,
  },
};

/**
 * Anúncio sobre o vídeo da aula, no estilo dos anúncios do YouTube:
 * ocupa o player, mostra a contagem para ignorar e depois recolhe para
 * uma faixa discreta no canto inferior. Fica dentro do player (o
 * elemento pai precisa de `position: relative`), por isso não tapa o
 * menu, o chat nem outros popups.
 */
export function ShopifyVideoAd({
  lessonId,
  trigger,
  enabled = true,
}: {
  lessonId: string;
  trigger: AdTrigger;
  enabled?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "full" | "mini" | "done">("idle");
  const [left, setLeft] = useState(SKIP_AFTER);
  const shownFor = useRef<string>("");
  const copy = COPY[trigger];

  // Nova aula/momento → recomeça o ciclo.
  useEffect(() => {
    setPhase("idle");
    setLeft(SKIP_AFTER);
  }, [lessonId, trigger]);

  useEffect(() => {
    if (!enabled || phase !== "idle") return;
    const slot = `${lessonId}:${trigger}`;
    if (shownFor.current === slot) return;
    if (!canShowShopifyAd(lessonId, trigger)) return;
    const id = window.setTimeout(() => {
      if (!canShowShopifyAd(lessonId, trigger)) return;
      shownFor.current = slot;
      markShopifyAdShown(lessonId, trigger);
      // No fim da aula os botões "Repetir / Próxima aula / Fazer teste" estão
      // no ecrã: aí o anúncio entra apenas como faixa, nunca a tapar o player.
      setPhase(trigger === "lesson-end" ? "mini" : "full");
    }, copy.delay);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, lessonId, trigger, phase]);

  // Contagem para libertar o "Ignorar anúncio".
  useEffect(() => {
    if (phase !== "full") return;
    const id = window.setInterval(() => {
      setLeft((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const handleClick = useCallback(() => {
    markShopifyPromoClicked();
    setPhase("done");
  }, []);

  if (!enabled || phase === "idle" || phase === "done") return null;

  if (phase === "mini") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-start p-2 sm:p-3">
        <div className="pointer-events-auto flex max-w-[calc(100%-0.5rem)] items-center gap-2 rounded-xl bg-black/80 px-2.5 py-2 text-left shadow-lg ring-1 ring-white/15 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 sm:gap-3 sm:px-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8"
            style={{ background: BRAND }}
          >
            <img
              src="https://www.google.com/s2/favicons?domain=shopify.com&sz=64"
              alt=""
              width={18}
              height={18}
              loading="lazy"
              decoding="async"
              className="h-4 w-4 object-contain sm:h-[18px] sm:w-[18px]"
            />
          </span>
          <a
            href={SHOPIFY_URL}
            target="_blank"
            rel="noreferrer noopener"
            onClick={handleClick}
            className="min-w-0 truncate text-[11px] font-medium text-white underline-offset-2 hover:underline sm:text-xs"
          >
            3 meses grátis no Shopify
          </a>
          <button
            type="button"
            aria-label="Fechar anúncio"
            onClick={() => setPhase("done")}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-20 overflow-hidden animate-in fade-in duration-300"
      role="region"
      aria-label="Anúncio: 3 meses grátis no Shopify"
    >
      {/* Fundo do anúncio */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, #00312a 0%, ${BRAND} 55%, #00a67e 100%)` }}
      />
      <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-black/25 blur-3xl" />

      {/* Etiqueta "Anúncio" */}
      <span className="absolute left-2 top-2 z-10 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/85 sm:left-3 sm:top-3 sm:text-[10px]">
        Anúncio
      </span>

      {/* Ignorar anúncio */}
      <div className="absolute bottom-2 right-2 z-10 sm:bottom-3 sm:right-3">
        {left > 0 ? (
          <span className="flex items-center gap-1.5 rounded-l-md bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white/80 sm:text-xs">
            Ignorar em {left}s
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setPhase("mini")}
            className="flex items-center gap-1.5 rounded-md bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-black/85 animate-in fade-in slide-in-from-right-2 sm:text-xs"
          >
            Ignorar anúncio
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Conteúdo */}
      <div className="relative z-[5] flex h-full flex-col justify-center gap-2 px-4 pb-11 pt-8 text-left sm:gap-3 sm:px-8 sm:pb-12 md:px-12">
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-3 duration-500">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-md sm:h-10 sm:w-10">
            <img
              src="https://www.google.com/s2/favicons?domain=shopify.com&sz=128"
              alt="Logotipo Shopify"
              width={22}
              height={22}
              loading="lazy"
              decoding="async"
              className="h-5 w-5 object-contain sm:h-6 sm:w-6"
            />
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70 sm:text-[10px]">
            {copy.eyebrow}
          </span>
        </div>

        <p className="max-w-[22ch] font-display text-xl leading-[1.1] text-white animate-in fade-in slide-in-from-left-4 duration-700 sm:max-w-[26ch] sm:text-3xl md:text-4xl">
          {copy.title}
        </p>
        <p className="line-clamp-2 max-w-[46ch] text-[11px] text-white/85 animate-in fade-in duration-700 sm:line-clamp-none sm:text-sm">
          {copy.sub}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-700 sm:mt-2 sm:gap-3">
          <a
            href={SHOPIFY_URL}
            target="_blank"
            rel="noreferrer noopener"
            onClick={handleClick}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-semibold shadow-lg transition hover:brightness-95 sm:px-5 sm:py-2.5 sm:text-sm"
            style={{ color: "#00312a" }}
          >
            {copy.cta}
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <span className="text-[10px] text-white/70 sm:text-xs">
            Oferta exclusiva para membros
          </span>
        </div>
      </div>

      {/* Barra de progresso do anúncio (fecha sozinho quando termina) */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
        <div
          className="h-full bg-white/70"
          style={{
            animation: `mm-ad-progress ${SKIP_AFTER + 7}s linear forwards`,
          }}
          onAnimationEnd={() => setPhase("mini")}
        />
      </div>
    </div>
  );
}

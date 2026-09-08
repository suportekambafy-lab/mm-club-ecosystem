import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import {
  canShowShopifyAd,
  markShopifyAdShown,
  markShopifyPromoClicked,
} from "@/lib/shopify-promo";
import { logPartnerEvent } from "@/lib/partner-track";

const SHOPIFY_URL = "https://shopify.pxf.io/c/7738721/1061744/13624";

/** Verde institucional Shopify (marca de terceiro, fora do tema MM). */
const BRAND = "#008060";

/** Segundos antes de o botão "Ignorar" ficar ativo. */
const SKIP_AFTER = 4;

/**
 * Anúncio em formato Shorts: um "slide" vertical entre os vídeos dos
 * membros, com etiqueta "Anúncio", contagem para ignorar e seta para
 * continuar a ver Shorts.
 */
export function ShopifyShortAd({
  slotId,
  active,
  onSkip,
  isLast = false,
}: {
  slotId: string;
  active: boolean;
  onSkip: () => void;
  /** Não há mais Shorts depois deste anúncio. */
  isLast?: boolean;
}) {
  const [left, setLeft] = useState(SKIP_AFTER);
  const [registered, setRegistered] = useState(false);

  // Regista a exposição só quando o slide está de facto no ecrã.
  useEffect(() => {
    if (!active || registered) return;
    if (canShowShopifyAd(slotId, "shorts")) markShopifyAdShown(slotId, "shorts");
    logPartnerEvent("impression", "shorts", { lessonId: slotId });
    setRegistered(true);
  }, [active, registered, slotId]);

  useEffect(() => {
    if (!active) return;
    setLeft(SKIP_AFTER);
    const id = window.setInterval(() => setLeft((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => window.clearInterval(id);
  }, [active, slotId]);

  const handleClick = useCallback(() => {
    markShopifyPromoClicked();
    logPartnerEvent("click", "shorts", { lessonId: slotId });
  }, []);

  return (
    <section
      data-shorts-ad={slotId}
      className="relative flex h-full min-h-full w-full snap-start snap-always items-center justify-center bg-black"
    >
      <div className="relative h-full w-full overflow-hidden sm:aspect-[9/16] sm:h-full sm:w-auto sm:max-w-[min(100%,calc(100dvh*9/16))]">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, #00312a 0%, ${BRAND} 55%, #00a67e 100%)` }}
        />
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-16 bottom-24 h-72 w-72 rounded-full bg-black/25 blur-3xl" />

        <span className="absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">
          Anúncio
        </span>

        <div className="absolute right-4 top-[calc(env(safe-area-inset-top)+0.85rem)] z-10">
          {left > 0 ? (
            <span className="rounded-md bg-black/55 px-2.5 py-1.5 text-[11px] font-medium text-white/80">
              Ignorar em {left}s
            </span>
          ) : (
            <button
              type="button"
              onClick={onSkip}
              className="flex items-center gap-1.5 rounded-md bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-black/85 animate-in fade-in slide-in-from-right-2"
            >
              {isLast ? "Voltar ao início" : "Ignorar"}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="relative z-[5] flex h-full flex-col justify-center gap-4 px-6 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-20 text-left">
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-3 duration-500">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-lg">
              <img
                src="https://www.google.com/s2/favicons?domain=shopify.com&sz=128"
                alt="Logotipo Shopify"
                width={24}
                height={24}
                loading="lazy"
                decoding="async"
                className="h-6 w-6 object-contain"
              />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Oferta parceiro MM Club
            </span>
          </div>

          <p className="font-display text-3xl leading-[1.05] text-white animate-in fade-in slide-in-from-left-4 duration-700 sm:text-4xl">
            3 meses grátis
            <br />
            no Shopify
          </p>
          <p className="max-w-[30ch] text-sm text-white/85 animate-in fade-in duration-700">
            Abre a tua loja pelo link do clube e começa a vender sem pagar a plataforma nos
            primeiros 3 meses.
          </p>

          <div className="flex flex-col items-start gap-2 animate-in fade-in slide-in-from-bottom-3 duration-700">
            <a
              href={SHOPIFY_URL}
              target="_blank"
              rel="noreferrer noopener"
              onClick={handleClick}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-xl transition hover:brightness-95"
              style={{ color: "#00312a" }}
            >
              Abrir a minha conta
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <span className="text-[11px] text-white/70">Oferta exclusiva para membros</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSkip}
          aria-label={isLast ? "Voltar ao início dos Shorts" : "Continuar a ver Shorts"}
          className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-10 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur transition hover:bg-black/60 lg:bottom-6"
        >
          {isLast ? "Voltar ao início" : "Continuar a ver Shorts"}
          <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
        </button>
      </div>
    </section>
  );
}

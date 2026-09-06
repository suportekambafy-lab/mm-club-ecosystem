import { useEffect, useState } from "react";
import { ArrowUpRight, X, Check } from "lucide-react";

const SHOPIFY_URL = "https://shopify.pxf.io/c/7738721/1061744/13624";
const SEEN_KEY = "mm_shopify_promo_seen_at";
const REPEAT_MS = 7 * 24 * 60 * 60 * 1000; // volta a aparecer uma vez por semana

/** Verde institucional da Shopify — cor de marca de terceiro, não do tema MM. */
const BRAND = "#008060";
const BRAND_SOFT = "rgba(0, 128, 96, 0.12)";

/**
 * Popup de oferta Shopify (3 meses grátis) — visível a todos os membros,
 * no máximo uma vez por semana por dispositivo.
 */
export function ShopifyPromoBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = 0;
    try {
      seen = Number(window.localStorage.getItem(SEEN_KEY) ?? 0);
    } catch {
      /* storage indisponível */
    }
    if (Date.now() - seen < REPEAT_MS) return;
    const id = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const dismiss = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      /* storage indisponível */
    }
  };



  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Oferta Shopify: 3 meses grátis"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={dismiss}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface-1 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Topo estilo painel de loja Shopify */}
        <div
          className="relative px-6 pb-8 pt-9 text-center"
          style={{ background: `linear-gradient(160deg, ${BRAND} 0%, #004c3f 100%)` }}
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-white/40">
            <img
              src="https://www.google.com/s2/favicons?domain=shopify.com&sz=128"
              alt="Logotipo Shopify"
              width={32}
              height={32}
              loading="lazy"
              decoding="async"
              className="h-8 w-8 object-contain"
            />
          </span>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">
            Oferta parceiro MM Club
          </p>
          <p className="mt-2 font-display text-3xl leading-[1.05] text-white">
            3 meses grátis
            <br />
            no Shopify
          </p>
          <p className="mt-2 text-sm text-white/80">
            Ao abrir a tua nova conta pelo link do clube.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <ul className="space-y-2.5">
            {[
              "Monta a loja exatamente como nas aulas",
              "Sem pagar a plataforma nos primeiros 3 meses",
              "Pagamentos, envios e domínio incluídos",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{ background: BRAND_SOFT, color: BRAND }}
                >
                  <Check className="h-2.5 w-2.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <a
            href={SHOPIFY_URL}
            target="_blank"
            rel="noreferrer noopener"
            onClick={dismiss}
            className="flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition hover:brightness-110"
            style={{ background: BRAND }}
          >
            Criar a minha loja agora
            <ArrowUpRight className="h-4 w-4" />
          </a>

          <button
            type="button"
            onClick={dismiss}
            className="w-full text-center text-xs text-muted-foreground transition hover:text-foreground"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Crown, ShieldCheck, Sparkles, Star } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCatalog, startCheckout } from "@/lib/billing.functions";
import { formatMoney } from "@/lib/billing/types";
import { cn } from "@/lib/utils";

type CheckoutSearch = { plan?: string };

export const Route = createFileRoute("/checkout")({
  validateSearch: (s: Record<string, unknown>): CheckoutSearch => ({
    plan: typeof s.plan === "string" ? s.plan : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Planos MM Club — Escolhe a tua adesão" },
      {
        name: "description",
        content:
          "Adesão ao MM Club: Academia completa, comunidade privada, lives, MM Studio e MM Intelligence. Mensal ou anual, cancelas quando quiseres.",
      },
      { property: "og:title", content: "Planos MM Club" },
      {
        property: "og:description",
        content:
          "Academia, comunidade privada, lives e ferramentas de IA numa só adesão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlansPage,
});

const INCLUDED = [
  "Academia completa e novos cursos",
  "Comunidade privada de empreendedores",
  "Lives e salas interativas + replays",
  "MM Intelligence (assistente de IA)",
  "MM Studio para criativos e vídeo",
  "MM Shorts e eventos do clube",
];

function cadenceLabel(interval: string, count: number): string {
  if (interval === "year") return count > 1 ? `/ ${count} anos` : "/ ano";
  if (interval === "month") return count > 1 ? `/ ${count} meses` : "/ mês";
  return "";
}

function PlansPage() {
  const { plan: recommended } = useSearch({ from: "/checkout" });
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: catalog, isLoading } = useQuery({
    queryKey: ["catalog", "subscription"],
    queryFn: () => getCatalog({ data: { kinds: ["subscription"] } }),
    staleTime: 5 * 60_000,
  });

  const product = catalog?.[0] ?? null;
  const prices = [...(product?.prices ?? [])].sort(
    (a, b) => a.amountCents - b.amountCents,
  );

  const handleSelect = async (priceSlug: string) => {
    setPending(priceSlug);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = `/auth?redirect=${encodeURIComponent("/checkout")}`;
        return;
      }
      const res = await startCheckout({
        data: { priceSlug, origin: window.location.origin },
      });
      window.location.href = res.checkoutUrl;
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível abrir o checkout. Tenta novamente.",
      );
      setPending(null);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-[520px] bg-[radial-gradient(ellipse_at_top,oklch(0.82_0.13_82_/_0.18),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:56px_56px]"
      />

      {error ? (
        <div className="mx-auto mt-4 max-w-3xl rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="relative mx-auto max-w-5xl px-4 py-16 md:py-24">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Adesão MM Club
          </span>
          <h1 className="mt-6 font-display text-4xl leading-[1.05] tracking-tight text-foreground md:text-6xl">
            Um clube.
            <br />
            <span className="text-muted-foreground">Acesso total.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm text-muted-foreground md:text-base">
            Todos os planos dão acesso completo ao MM Club. Escolhe a duração
            que faz sentido para ti — cancelas quando quiseres.
          </p>
        </motion.header>

        <section className="mx-auto mt-14 grid max-w-3xl gap-6 md:mt-20 md:grid-cols-2">
          {isLoading
            ? [0, 1].map((i) => (
                <div
                  key={i}
                  className="h-[520px] animate-pulse rounded-3xl bg-surface-1 ring-1 ring-border"
                />
              ))
            : prices.map((price, i) => {
                const isYearly = price.interval === "year";
                const isRecommended = recommended
                  ? recommended === price.slug
                  : isYearly;
                const monthly =
                  isYearly && price.intervalCount === 1
                    ? price.amountCents / 12
                    : null;
                return (
                  <motion.article
                    key={price.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.08 * i,
                      ease: "easeOut",
                    }}
                    className={cn(
                      "group relative flex flex-col rounded-3xl p-7 ring-1 transition-all duration-300",
                      isRecommended
                        ? "bg-surface-1 text-foreground ring-2 ring-primary shadow-[0_40px_120px_-40px_oklch(0.82_0.13_82_/_0.55)] md:-translate-y-3"
                        : "bg-surface-1 text-foreground ring-border hover:-translate-y-1 hover:ring-primary/40",
                    )}
                  >
                    {isRecommended ? (
                      <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground shadow-lg">
                        <Sparkles className="h-3 w-3" /> Melhor valor
                      </span>
                    ) : null}

                    <div className="mt-2 flex items-center gap-2 text-primary">
                      {isYearly ? (
                        <Crown className="h-5 w-5" />
                      ) : (
                        <Star className="h-5 w-5" />
                      )}
                      <h2 className="font-display text-2xl tracking-tight text-foreground">
                        {price.displayLabel ??
                          (isYearly ? "Anual" : "Mensal")}
                      </h2>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {isYearly
                        ? "Doze meses de foco, ao melhor preço por mês."
                        : "Começa hoje, sem compromisso de longo prazo."}
                    </p>

                    <div className="mt-6 flex items-baseline gap-1.5">
                      <span className="font-display text-5xl leading-none tracking-tight">
                        {formatMoney(price.amountCents, price.currency)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {cadenceLabel(price.interval, price.intervalCount)}
                      </span>
                    </div>
                    {monthly ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Equivale a {formatMoney(Math.round(monthly), price.currency)} por mês
                      </p>
                    ) : null}
                    {price.trialDays > 0 ? (
                      <p className="mt-1.5 text-xs text-primary">
                        {price.trialDays} dias de teste incluídos
                      </p>
                    ) : null}

                    <div className="my-6 h-px w-full bg-border" />

                    <ul className="flex-1 space-y-3">
                      {INCLUDED.map((text) => (
                        <li key={text} className="flex items-start gap-3 text-sm">
                          <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/15 text-primary">
                            <Check className="h-3 w-3" />
                          </span>
                          <span>{text}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      disabled={pending === price.slug}
                      onClick={() => handleSelect(price.slug)}
                      className={cn(
                        "mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3.5 text-sm font-semibold transition disabled:opacity-60",
                        isRecommended
                          ? "bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_oklch(0.82_0.13_82_/_0.6)] hover:bg-gold-soft"
                          : "bg-foreground text-background hover:opacity-90",
                      )}
                    >
                      {pending === price.slug
                        ? "A abrir checkout..."
                        : isYearly
                          ? "Escolher anual"
                          : "Começar agora"}
                    </button>
                  </motion.article>
                );
              })}
        </section>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mx-auto mt-14 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground"
        >
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Pagamento seguro
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-primary" /> Cancela quando quiseres
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-primary" /> Reembolso em 14 dias
          </span>
        </motion.div>

        <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link to="/termos" className="underline hover:text-foreground">
              Termos e Condições
            </Link>
            <Link to="/privacidade" className="underline hover:text-foreground">
              Política de Privacidade
            </Link>
            <Link to="/reembolsos" className="underline hover:text-foreground">
              Política de Reembolsos
            </Link>
            <a
              href="mailto:geral@mmclub.pt"
              className="underline hover:text-foreground"
            >
              Contacto
            </a>
          </nav>
          <p className="mt-4">
            © {new Date().getFullYear()} MM Club · Snowcountry, Lda.
          </p>
        </footer>
      </div>
    </div>
  );
}

import { createFileRoute, useSearch, useNavigate, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, Crown, Sparkles, Star, X, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { cn } from "@/lib/utils";

type CheckoutSearch = { plan?: "start" | "plus" | "elite" };

export const Route = createFileRoute("/checkout")({
  validateSearch: (s: Record<string, unknown>): CheckoutSearch => {
    const p = s.plan;
    return {
      plan: p === "start" || p === "plus" || p === "elite" ? p : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Planos MM Club — Escolhe a tua adesão" },
      {
        name: "description",
        content:
          "MM Club Start, Plus e Elite. Acesso aos cursos, comunidade privada, lives, ferramentas e templates exclusivos.",
      },
    ],
  }),
  component: PlansPage,
});

type Benefit = { text: string; checked: boolean };

type Plan = {
  id: "start" | "plus" | "elite";
  priceId: string;
  name: string;
  icon: React.ReactNode;
  price: string;
  cadence: string;
  equivalent?: string;
  badge?: string;
  highlight?: boolean;
  bestFor: string;
  cta: string;
  benefits: Benefit[];
};

const PLANS: Plan[] = [
  {
    id: "start",
    priceId: "mm_club_start_monthly",
    name: "MM Club Start",
    icon: <Star className="h-5 w-5" />,
    price: "29,90 €",
    cadence: "/ mês",
    bestFor: "Para quem quer começar hoje sem compromisso.",
    cta: "Começar agora",
    benefits: [
      { text: "Acesso completo ao MM Club", checked: true },
      { text: "Todos os cursos disponíveis", checked: true },
      { text: "Comunidade privada e lives", checked: true },
      { text: "Suporte IA e ferramentas", checked: true },
      { text: "Poupança face ao mensal", checked: false },
      { text: "Prioridade em novos lançamentos", checked: false },
    ],
  },
  {
    id: "plus",
    priceId: "mm_club_plus_semestral",
    name: "MM Club Plus",
    icon: <Zap className="h-5 w-5" />,
    price: "149,90 €",
    cadence: "/ 6 meses",
    equivalent: "≈ 24,98 €/mês",
    badge: "Mais Popular",
    highlight: true,
    bestFor: "Seis meses de foco, com poupança real.",
    cta: "Escolher Plus",
    benefits: [
      { text: "Tudo do plano Start", checked: true },
      { text: "6 meses de acesso sem preocupações", checked: true },
      { text: "Poupança de 29,50 € face ao mensal", checked: true },
      { text: "Comunidade privada e lives", checked: true },
      { text: "Prioridade em novos lançamentos", checked: false },
      { text: "Melhor valor no longo prazo", checked: false },
    ],
  },
  {
    id: "elite",
    priceId: "mm_club_elite_yearly",
    name: "MM Club Elite",
    icon: <Crown className="h-5 w-5" />,
    price: "249,90 €",
    cadence: "/ ano",
    equivalent: "≈ 20,83 €/mês",
    badge: "Melhor Valor",
    bestFor: "O ano inteiro, ao melhor preço por mês.",
    cta: "Escolher Elite",
    benefits: [
      { text: "Tudo do plano Plus", checked: true },
      { text: "12 meses de acesso completo", checked: true },
      { text: "Poupança de 108,90 € face ao mensal", checked: true },
      { text: "Prioridade em novos cursos e funcionalidades", checked: true },
      { text: "Melhor custo por mês", checked: true },
      { text: "Acesso antecipado a eventos", checked: true },
    ],
  },
];

function BenefitRow({ text, checked }: Benefit) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full",
          checked
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground/60",
        )}
      >
        {checked ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span className={checked ? "" : "text-muted-foreground/70 line-through"}>
        {text}
      </span>
    </li>
  );
}

function PlansPage() {
  const { plan: recommendedPlan } = useSearch({ from: "/checkout" });
  const navigate = useNavigate();
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (plan: Plan) => {
    setPendingPlan(plan.id);
    setError(null);
    navigate({ to: "/checkout/pay", search: { plan: plan.id } });
  };



  return (
    <>
      <PaymentTestModeBanner />

      {/* Ambient background */}
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

        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-center"
          >
            {recommendedPlan ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Recomendado pelo teu diagnóstico
              </span>
            ) : null}
            <h1 className="mt-6 font-display text-4xl leading-[1.05] tracking-tight text-foreground md:text-6xl">
              {recommendedPlan ? (
                <>O teu plano ideal está pronto.</>
              ) : (
                <>
                  Escolhe a tua adesão
                  <br />
                  <span className="text-muted-foreground">e entra no clube.</span>
                </>
              )}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm text-muted-foreground md:text-base">
              {recommendedPlan
                ? "Destacámos a recomendação do teu diagnóstico — mas és livre de escolher outro plano."
                : "Todos os planos incluem o acesso completo ao MM Club. Escolhe a duração que mais te convém — cancelas quando quiseres."}
            </p>
          </motion.header>

          {/* Cards */}
          <section className="mt-14 grid gap-6 md:mt-20 md:grid-cols-3">
            {PLANS.map((plan, i) => {
              const isRecommended = recommendedPlan === plan.id;
              const isHero = isRecommended || plan.highlight;
              return (
                <motion.article
                  key={plan.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.08 * i, ease: "easeOut" }}
                  className={cn(
                    "group relative flex flex-col rounded-3xl p-7 ring-1 transition-all duration-300",
                    isRecommended
                      ? "bg-surface-1 text-foreground ring-2 ring-primary shadow-[0_40px_120px_-40px_oklch(0.82_0.13_82_/_0.55)] md:-translate-y-3"
                      : plan.highlight
                      ? "bg-linear-to-br from-violet to-violet-deep text-violet-foreground ring-transparent shadow-[0_40px_120px_-40px_oklch(0.35_0.15_290_/_0.6)] md:-translate-y-3"
                      : "bg-surface-1 text-foreground ring-border hover:ring-primary/40 hover:-translate-y-1",
                  )}
                >
                  {/* Sheen */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(600px circle at var(--x,50%) var(--y,0%), oklch(1 0 0 / 0.06), transparent 40%)",
                      }}
                    />
                  </div>

                  {/* Badge */}
                  {isRecommended ? (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground shadow-lg">
                      <Sparkles className="h-3 w-3" /> Recomendado
                    </span>
                  ) : plan.badge ? (
                    <span
                      className={cn(
                        "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-lg",
                        plan.highlight
                          ? "bg-primary text-primary-foreground"
                          : "bg-foreground text-background",
                      )}
                    >
                      {plan.badge}
                    </span>
                  ) : null}

                  {/* Tier + best for */}
                  <h2 className="mt-2 font-display text-2xl tracking-tight">
                    {plan.name}
                  </h2>
                  <p
                    className={cn(
                      "mt-1.5 text-xs",
                      plan.highlight
                        ? "text-violet-foreground/75"
                        : "text-muted-foreground",
                    )}
                  >
                    {plan.bestFor}
                  </p>

                  {/* Price */}
                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="font-display text-5xl leading-none tracking-tight">
                      {plan.price}
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        plan.highlight
                          ? "text-violet-foreground/80"
                          : "text-muted-foreground",
                      )}
                    >
                      {plan.cadence}
                    </span>
                  </div>
                  {plan.equivalent && (
                    <p
                      className={cn(
                        "mt-1.5 text-xs",
                        plan.highlight
                          ? "text-violet-foreground/75"
                          : "text-muted-foreground",
                      )}
                    >
                      {plan.equivalent}
                    </p>
                  )}

                  {/* Divider */}
                  <div
                    className={cn(
                      "my-6 h-px w-full",
                      plan.highlight ? "bg-white/15" : "bg-border",
                    )}
                  />

                  {/* Benefits */}
                  <ul className="flex-1 space-y-3">
                    {plan.benefits.map((b) => (
                      <BenefitRow key={b.text} {...b} />
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    type="button"
                    disabled={pendingPlan === plan.id}
                    onClick={() => handleSelect(plan)}
                    className={cn(
                      "mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3.5 text-sm font-semibold transition disabled:opacity-60",
                      isHero
                        ? "bg-primary text-primary-foreground hover:bg-gold-soft shadow-[0_10px_30px_-10px_oklch(0.82_0.13_82_/_0.6)]"
                        : "bg-foreground text-background hover:opacity-90",
                    )}
                  >
                    {pendingPlan === plan.id ? "A abrir checkout..." : plan.cta}
                  </button>
                </motion.article>
              );
            })}
          </section>

          {/* Trust bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mx-auto mt-14 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground"
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Pagamento seguro
              via Paddle
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" /> Cancela quando quiseres
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" /> Reembolso em 14 dias
            </span>
          </motion.div>

          {/* Footer */}
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
            <p className="mt-4">© {new Date().getFullYear()} MM Club · Snowcountry, Lda.</p>
          </footer>
        </div>
      </div>
    </>
  );
}

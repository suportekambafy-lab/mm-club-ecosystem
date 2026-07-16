import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { Check, Crown, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

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
  intro: string;
  features: string[];
};

const startFeatures = [
  "Acesso completo ao MM Club",
  "Todos os cursos disponíveis",
  "Novos cursos adicionados regularmente",
  "Suporte IA",
  "Ferramentas e recursos exclusivos",
  "Templates e checklists",
  "Lives exclusivas para membros",
  "Comunidade privada",
  "Atualizações contínuas",
];

const PLANS: Plan[] = [
  {
    id: "start",
    priceId: "mm_club_start_monthly",
    name: "MM Club Start",
    icon: <Star className="h-5 w-5" />,
    price: "29,90 €",
    cadence: "/ mês",
    intro: "Ideal para quem quer começar hoje.",
    features: startFeatures,
  },
  {
    id: "plus",
    priceId: "mm_club_plus_semestral",
    name: "MM Club Plus",
    icon: <Star className="h-5 w-5" />,
    price: "149,90 €",
    cadence: "/ 6 meses",
    equivalent: "Equivalente a 24,98 €/mês",
    badge: "Mais Popular",
    highlight: true,
    intro: "Inclui tudo do Start, mais:",
    features: [
      "6 meses de acesso sem preocupações",
      "Poupança de 29,50 € face ao plano mensal",
    ],
  },
  {
    id: "elite",
    priceId: "mm_club_elite_yearly",
    name: "MM Club Elite",
    icon: <Crown className="h-5 w-5" />,
    price: "249,90 €",
    cadence: "/ ano",
    equivalent: "Equivalente a 20,83 €/mês",
    badge: "Melhor Valor",
    intro: "Inclui tudo do Plus, mais:",
    features: [
      "12 meses de acesso completo",
      "Poupança de 108,90 € face ao plano mensal",
      "Prioridade no acesso a novos cursos e funcionalidades",
    ],
  },
];

function PlansPage() {
  const navigate = useNavigate();
  const { plan: recommendedPlan } = useSearch({ from: "/checkout" });
  const { openCheckout, loading } = usePaddleCheckout();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email ?? undefined });
    });
  }, []);

  const handleSelect = async (plan: Plan) => {
    setPendingPlan(plan.id);
    try {
      await openCheckout({
        priceId: plan.priceId,
        customerEmail: user?.email,
        customData: user ? { userId: user.id } : undefined,
      });
    } finally {
      setPendingPlan(null);
    }
  };

  return (
    <>
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <header className="text-center">
          {recommendedPlan ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Recomendado pelo teu diagnóstico
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Crown className="h-4 w-4" /> Adesão MM Club
            </span>
          )}
          <h1 className="mt-5 font-display text-4xl leading-tight text-foreground md:text-5xl">
            {recommendedPlan ? "O teu plano ideal está pronto." : "Escolhe a tua adesão"}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            {recommendedPlan
              ? "Destacámos a recomendação do teu diagnóstico — mas és livre de escolher outro plano."
              : "Todos os planos incluem o acesso completo ao MM Club. Escolhe a duração que mais te convém."}
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isRecommended = recommendedPlan === plan.id;
            return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-3xl p-6 ring-1 transition ${
                isRecommended
                  ? "bg-surface-1 text-foreground ring-2 ring-primary shadow-[0_30px_80px_-30px_oklch(0.82_0.13_82_/_0.5)] md:-translate-y-2"
                  : plan.highlight
                  ? "bg-linear-to-br from-violet to-violet-deep text-violet-foreground ring-transparent shadow-xl md:-translate-y-2"
                  : "bg-surface-1 text-foreground ring-border"
              }`}
            >
              {isRecommended ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground shadow-lg">
                  <Sparkles className="h-3 w-3" /> Recomendado
                </span>
              ) : plan.badge ? (
                <span
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                    plan.highlight
                      ? "bg-primary text-primary-foreground"
                      : "bg-foreground text-background"
                  }`}
                >
                  {plan.badge}
                </span>
              ) : null}

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  plan.highlight ? "bg-white/15" : "bg-primary/10 text-primary"
                }`}
              >
                {plan.icon}
              </div>

              <h2 className="mt-5 font-display text-2xl">{plan.name}</h2>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-4xl">{plan.price}</span>
                <span
                  className={`text-sm ${
                    plan.highlight ? "text-violet-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {plan.cadence}
                </span>
              </div>
              {plan.equivalent && (
                <p
                  className={`mt-1 text-xs ${
                    plan.highlight ? "text-violet-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {plan.equivalent}
                </p>
              )}

              <p
                className={`mt-4 text-sm ${
                  plan.highlight ? "text-violet-foreground/90" : "text-muted-foreground"
                }`}
              >
                {plan.intro}
              </p>

              <ul className="mt-4 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <span
                      className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full ${
                        plan.highlight
                          ? "bg-white/20 text-violet-foreground"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={loading && pendingPlan === plan.id}
                onClick={() => handleSelect(plan)}
                className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-60 ${
                  plan.highlight
                    ? "bg-primary text-primary-foreground hover:bg-gold-soft"
                    : "bg-foreground text-background hover:opacity-90"
                }`}
              >
                {loading && pendingPlan === plan.id ? "A abrir checkout..." : "Subscrever"}
              </button>
            </article>
          ))}
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Pagamento seguro processado pela Paddle. Podes cancelar a qualquer momento.
        </p>

        <footer className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
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
            <a href="mailto:geral@mmclub.pt" className="underline hover:text-foreground">
              Contacto
            </a>
          </nav>
          <p className="mt-4">© {new Date().getFullYear()} MM Club</p>
        </footer>
      </div>
    </>
  );
}

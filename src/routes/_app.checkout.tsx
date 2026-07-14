import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/checkout")({
  head: () => ({
    meta: [
      { title: "Premium — MM Club" },
      { name: "description", content: "Upgrade Premium do MM Club com acesso ao painel pessoal e experiências exclusivas." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="overflow-hidden rounded-3xl bg-linear-to-br from-violet to-violet-deep p-8 text-violet-foreground md:p-10">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            <Crown className="h-4 w-4 fill-current" /> Premium
          </span>
          <h1 className="mt-5 font-display text-4xl leading-tight md:text-5xl">Desbloqueia o painel pessoal completo.</h1>
          <p className="mt-4 text-sm leading-relaxed text-violet-foreground/85">
            Acesso premium a recursos avançados, eventos selecionados, suporte da comunidade e experiências privadas do MM Club.
          </p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-[1fr_340px]">
        <div className="rounded-2xl bg-surface-1 p-6 ring-1 ring-border">
          <h2 className="font-display text-2xl text-foreground">Incluído</h2>
          <div className="mt-5 grid gap-3">
            {["Acesso 24/7 ao painel pessoal", "Eventos e conteúdos Premium", "Ferramentas exclusivas", "Prioridade na comunidade"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-4 w-4" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-surface-1 p-6 ring-1 ring-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="mt-5 text-sm text-muted-foreground">Plano Premium</p>
          <p className="mt-1 font-display text-4xl text-foreground">€97</p>
          <p className="mt-1 text-xs text-muted-foreground">/ mês</p>
          <Link
            to="/auth"
            search={{ redirect: "/checkout" }}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-gold-soft"
          >
            Continuar
          </Link>
        </div>
      </section>
    </div>
  );
}
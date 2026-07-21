import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/ferramentas")({
  head: () => ({
    meta: [
      { title: "Ferramentas — MM Club" },
      {
        name: "description",
        content:
          "MM Studio e biblioteca de ferramentas premium para empreendedores digitais: geração de imagens e vídeos com IA, prompts, templates e recursos.",
      },
    ],
  }),
  component: FerramentasLayout,
});

function FerramentasLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isStudio = pathname.startsWith("/ferramentas/studio");

  if (isStudio) return <Outlet />;

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-surface-1">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.82 0.13 82 / 0.18), transparent 60%), radial-gradient(ellipse 60% 60% at 100% 100%, oklch(0.55 0.22 285 / 0.10), transparent 60%)",
          }}
        />
        <div className="relative flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--hairline)] bg-background/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Novo
            </span>
            <h1 className="font-display text-4xl leading-tight text-foreground md:text-6xl">
              MM Studio
              <span className="block text-primary">criativos com IA.</span>
            </h1>
            <p className="text-base text-muted-foreground md:text-lg">
              Imagens publicitárias e vídeos profissionais para os teus produtos —
              sem escrever prompts, sem editar. Escolhe o estilo, escolhe o formato, gera.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/ferramentas/studio"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-20px_oklch(0.82_0.13_82/0.6)] transition hover:opacity-90"
              >
                Abrir MM Studio →
              </Link>
              <Link
                to="/ferramentas/studio/marca"
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hairline)] bg-background/40 px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-background/70"
              >
                Configurar Brand DNA
              </Link>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="relative h-56 w-56 rounded-3xl border border-[color:var(--hairline)] bg-gradient-to-br from-primary/20 via-background to-secondary/20 shadow-[0_40px_120px_-30px_oklch(0.82_0.13_82/0.4)]">
              <div className="absolute inset-6 rounded-2xl bg-background/60 backdrop-blur-xl" />
              <div
                className="absolute inset-10 rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.82 0.13 82 / 0.5), oklch(0.55 0.22 285 / 0.5))",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl text-foreground">Em breve</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {["Biblioteca de prompts", "Templates de página", "Calculadora de pricing", "Scripts de vendas", "Fornecedores LATAM", "Swipes de copy"].map((t) => (
            <div key={t} className="rounded-2xl border border-dashed border-border bg-surface-1 p-5">
              <p className="text-sm font-medium text-foreground">{t}</p>
              <p className="mt-1 text-xs text-muted-foreground">Disponível em breve</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

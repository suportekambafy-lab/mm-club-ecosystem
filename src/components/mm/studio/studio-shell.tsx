import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles, Image as ImageIcon, Film, Library, Package, Gem, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type StudioNav = {
  to:
    | "/ferramentas/studio"
    | "/ferramentas/studio/imagens"
    | "/ferramentas/studio/videos"
    | "/ferramentas/studio/criativos"
    | "/ferramentas/studio/produtos"
    | "/ferramentas/studio/marca";
  label: string;
  icon: typeof Sparkles;
  exact?: boolean;
};

const nav: StudioNav[] = [
  { to: "/ferramentas/studio", label: "Descobrir", icon: Sparkles, exact: true },
  { to: "/ferramentas/studio/imagens", label: "IA de Imagens", icon: ImageIcon },
  { to: "/ferramentas/studio/videos", label: "IA de Vídeos", icon: Film },
  { to: "/ferramentas/studio/criativos", label: "Os meus criativos", icon: Library },
  { to: "/ferramentas/studio/produtos", label: "Produtos", icon: Package },
  { to: "/ferramentas/studio/marca", label: "Brand DNA", icon: Gem },
];

export function StudioShell({
  balance,
  children,
}: {
  balance: number | null;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-surface-1/60 p-6 backdrop-blur-xl md:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 15% 0%, oklch(0.82 0.13 82 / 0.15), transparent 60%), radial-gradient(ellipse 60% 40% at 100% 100%, oklch(0.55 0.22 285 / 0.10), transparent 60%)",
          }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--hairline)] bg-background/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3 w-3" />
              MM Studio
            </span>
            <h1 className="font-display text-3xl leading-tight text-foreground md:text-5xl">
              Criativos profissionais.
              <br />
              <span className="text-primary">Sem escrever prompts.</span>
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground md:text-base">
              Imagens e vídeos publicitários gerados por IA, alinhados com o teu Brand DNA.
              Escolhe o estilo e o formato — nós tratamos do resto.
            </p>
          </div>
          <CreditsPill balance={balance} />
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition",
                active
                  ? "border-[color:var(--hairline)] bg-primary/10 text-primary shadow-[0_10px_30px_-15px_oklch(0.82_0.13_82/0.4)]"
                  : "border-border bg-surface-1 text-muted-foreground hover:border-[color:var(--hairline)] hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}

export function CreditsPill({ balance }: { balance: number | null }) {
  return (
    <Link
      to="/ferramentas/studio"
      className="group inline-flex items-center gap-3 self-start rounded-2xl border border-[color:var(--hairline)] bg-background/60 px-4 py-2.5 backdrop-blur-xl transition hover:bg-background/80"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-[color:var(--hairline)]">
        <Coins className="h-4 w-4" />
      </span>
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Créditos</span>
        <span className="font-display text-lg leading-none text-foreground">
          {balance === null ? "—" : balance.toLocaleString("pt-PT")}
        </span>
      </div>
    </Link>
  );
}

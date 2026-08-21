import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpRight, Copy, Check, Search, BadgePercent } from "lucide-react";
import { mmLinkCategories, mmLinkLogo, mmLinks, type MMLinkCategory } from "@/data/mm-links";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ferramentas/links")({
  head: () => ({
    meta: [
      { title: "Links Úteis — Ferramentas MM Club" },
      {
        name: "description",
        content:
          "Todas as ferramentas usadas nas aulas do MM Club num só lugar: Shopify, Lovable, IA, criativos, tráfego, pagamentos e automação.",
      },
      { property: "og:title", content: "Links Úteis — Ferramentas MM Club" },
      {
        property: "og:description",
        content:
          "A stack oficial do MM Club: links diretos para as ferramentas que usamos nas aulas, com acessos e ofertas para membros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LinksPage,
});

function LinksPage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<MMLinkCategory | "all">("all");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mmLinks.filter((l) => {
      if (cat !== "all" && l.category !== cat) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.domain.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q)
      );
    });
  }, [query, cat]);

  const grouped = useMemo(() => {
    return mmLinkCategories
      .map((c) => ({ category: c, items: results.filter((l) => l.category === c) }))
      .filter((g) => g.items.length > 0);
  }, [results]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
          Ferramentas › Links úteis
        </p>
        <h1 className="font-display text-4xl leading-[1] text-foreground md:text-5xl">
          A stack oficial do MM Club.
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Todos os links das ferramentas que usamos nas aulas — sem perder tempo a procurar. Alguns
          são links de parceria e dão benefícios extra a quem entra por aqui.
        </p>
      </section>

      <section className="space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar ferramenta…"
            className="w-full rounded-full border border-border bg-surface-1 py-3 pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-primary/50"
          />
        </label>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip active={cat === "all"} onClick={() => setCat("all")}>
            Tudo
          </FilterChip>
          {mmLinkCategories.map((c) => (
            <FilterChip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c}
            </FilterChip>
          ))}
        </div>
      </section>

      {grouped.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma ferramenta encontrada.</p>
        </div>
      )}

      {grouped.map((group) => (
        <section key={group.category} className="space-y-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {group.category}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((l) => (
              <LinkCard key={l.id} link={l} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition",
        active
          ? "border-[color:var(--hairline)] bg-primary/10 text-primary"
          : "border-border bg-surface-1 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

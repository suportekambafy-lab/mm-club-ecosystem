import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, LifeBuoy, Search } from "lucide-react";
import { helpArticles, helpCategories, type HelpCategory } from "@/data/help-articles";

export const Route = createFileRoute("/_app/ajuda/")({
  head: () => ({
    meta: [
      { title: "Centro de Ajuda — MM Club" },
      {
        name: "description",
        content:
          "Artigos curtos sobre cada função do MM Club: testes de módulo, certificados, MM Studio, lives, comunidade e subscrição.",
      },
      { property: "og:title", content: "Centro de Ajuda — MM Club" },
      {
        property: "og:description",
        content: "Respostas rápidas sobre todas as funções do MM Club.",
      },
    ],
  }),
  component: AjudaIndex,
});

function AjudaIndex() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<HelpCategory | "todos">("todos");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return helpArticles.filter((a) => {
      if (cat !== "todos" && a.category !== cat) return false;
      if (!term) return true;
      return `${a.title} ${a.summary} ${a.keywords ?? ""} ${a.category}`
        .toLowerCase()
        .includes(term);
    });
  }, [q, cat]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
          Centro de Ajuda
        </p>
        <h1 className="font-display text-4xl leading-[1] text-foreground md:text-5xl">
          Respostas rápidas
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Artigos curtos sobre cada função do clube, com link direto para o sítio onde a usas.
        </p>
      </section>

      <section className="space-y-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar ajuda (ex.: certificado, créditos, quiz)"
            className="w-full rounded-full border border-[color:var(--hairline)] bg-surface-1 py-3 pl-11 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />
        </label>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {(["todos", ...helpCategories] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c as HelpCategory | "todos")}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                cat === c
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-[color:var(--hairline)] bg-surface-1 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c === "todos" ? "Todos" : c}
            </button>
          ))}
        </div>
      </section>

      {results.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface-1 p-8 text-center">
          <p className="text-sm font-medium text-foreground">Sem artigos para esta pesquisa.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Usa o botão de suporte no canto do ecrã e falamos contigo.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {results.map((a) => (
            <Link
              key={a.slug}
              to="/ajuda/$slug"
              params={{ slug: a.slug }}
              className="group rounded-2xl border border-[color:var(--hairline)] bg-surface-1 p-5 transition hover:border-primary/50"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {a.category}
              </p>
              <h2 className="mt-1 font-display text-xl leading-tight text-foreground">{a.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{a.summary}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Ler artigo
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-4 rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-[color:var(--hairline)]">
            <LifeBuoy className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-foreground">Não encontraste a resposta?</p>
            <p className="text-sm text-muted-foreground">
              Abre o MM Suporte no canto inferior direito — respondemos por chat.
            </p>
          </div>
        </div>
        <Link
          to="/codigo"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--hairline)] px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/50"
        >
          Código do Clube <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}

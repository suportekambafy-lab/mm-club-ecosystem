import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { findHelpArticle, helpArticles } from "@/data/help-articles";

export const Route = createFileRoute("/_app/ajuda/$slug")({
  loader: ({ params }) => {
    const article = findHelpArticle(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Artigo indisponível — MM Club" }, { name: "robots", content: "noindex" }],
      };
    }
    const { article } = loaderData;
    const title = `${article.title} — Ajuda MM Club`;
    return {
      meta: [
        { title },
        { name: "description", content: article.summary },
        { property: "og:title", content: title },
        { property: "og:description", content: article.summary },
      ],
    };
  },
  notFoundComponent: ArtigoNaoEncontrado,
  component: ArtigoAjuda,
});

function ArtigoNaoEncontrado() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-foreground">Artigo não encontrado</h1>
      <p className="text-sm text-muted-foreground">Este artigo já não existe ou mudou de nome.</p>
      <Link to="/ajuda" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        Voltar ao Centro de Ajuda <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ArtigoAjuda() {
  const { article } = Route.useLoaderData();
  const related = helpArticles
    .filter((a) => a.category === article.category && a.slug !== article.slug)
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        to="/ajuda"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Centro de Ajuda
      </Link>

      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
          {article.category}
        </p>
        <h1 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
          {article.title}
        </h1>
        <p className="text-sm text-muted-foreground md:text-base">{article.summary}</p>
      </header>

      <section className="rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6">
        <h2 className="font-display text-xl text-foreground">Como funciona</h2>
        <ul className="mt-4 space-y-3">
          {article.steps.map((s) => (
            <li key={s} className="flex gap-3 text-sm text-muted-foreground">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="h-3 w-3" />
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ul>

        {article.action ? (
          <Link
            to={article.action.to as never}
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {article.action.label} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </section>

      {related.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground">Também sobre {article.category}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((a) => (
              <Link
                key={a.slug}
                to="/ajuda/$slug"
                params={{ slug: a.slug }}
                className="group rounded-2xl border border-[color:var(--hairline)] bg-surface-1 p-4 transition hover:border-primary/50"
              >
                <p className="font-medium text-foreground">{a.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{a.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PlayCircle, Search } from "lucide-react";
import { searchLessonMoments } from "@/lib/lesson-knowledge.functions";
import { InlineAlert } from "@/components/mm/inline-alert";

type Moment = {
  id: string;
  courseId: string;
  lessonId: string;
  courseTitle: string | null;
  lessonTitle: string | null;
  content: string;
  startSeconds: number | null;
  similarity: number;
};

export const Route = createFileRoute("/_app/academia/pesquisa")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  head: () => ({
    meta: [
      { title: "Pesquisar nas aulas — MM Club" },
      {
        name: "description",
        content:
          "Procura um tema e salta diretamente para o minuto exato da aula onde é explicado.",
      },
      { property: "og:title", content: "Pesquisar nas aulas — MM Club" },
      {
        property: "og:description",
        content: "Procura por tema e salta para o minuto exato da aula.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TranscriptSearchPage,
});

function timecode(seconds: number | null) {
  if (seconds == null) return null;
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function excerpt(text: string, max = 260) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

const SUGGESTIONS = ["tráfego pago", "posicionamento de marca", "preço", "oferta irresistível"];

function TranscriptSearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const run = useServerFn(searchLessonMoments);

  const [term, setTerm] = useState(q);
  const [results, setResults] = useState<Moment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (value: string) => {
      const query = value.trim();
      if (query.length < 2) return;
      setBusy(true);
      setError(null);
      try {
        const data = (await run({ data: { query, matchCount: 12 } })) as Moment[];
        setResults(data);
      } catch {
        setError("Não foi possível pesquisar agora. Tentar novamente.");
      } finally {
        setBusy(false);
      }
    },
    [run],
  );

  useEffect(() => {
    setTerm(q);
    if (q.trim().length >= 2) void search(q);
  }, [q, search]);

  function submit(value: string) {
    const query = value.trim();
    if (query.length < 2) return;
    navigate({ to: "/academia/pesquisa", search: { q: query }, replace: true });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      <header className="space-y-3">
        <p className="font-display text-[10px] uppercase tracking-[0.32em] text-primary">
          Academia
        </p>
        <h1 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
          Pesquisar dentro das aulas
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Escreve o tema que procuras. Levamos-te ao minuto exato onde é explicado.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(term);
        }}
        className="flex items-center gap-2 rounded-full bg-surface-1 px-4 py-2 ring-1 ring-border focus-within:ring-primary"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Ex.: como definir o preço do meu produto"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={busy || term.trim().length < 2}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Pesquisar
        </button>
      </form>

      {!results && !busy && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              className="rounded-full bg-surface-1 px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border transition hover:text-foreground hover:ring-primary"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      {busy && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-1" />
          ))}
        </div>
      )}

      {!busy && results && results.length === 0 && (
        <p className="rounded-2xl bg-surface-1 p-6 text-sm text-muted-foreground ring-1 ring-border">
          Sem resultados para este tema. Tenta outras palavras.
        </p>
      )}

      {!busy && results && results.length > 0 && (
        <ul className="space-y-3">
          {results.map((m) => {
            const tc = timecode(m.startSeconds);
            return (
              <li key={m.id}>
                <Link
                  to="/academia/$courseId/$lessonId"
                  params={{ courseId: m.courseId, lessonId: m.lessonId }}
                  search={m.startSeconds != null ? { t: Math.floor(m.startSeconds) } : {}}
                  preload="render"
                  className="block rounded-2xl bg-surface-1 p-5 ring-1 ring-border transition hover:ring-primary"
                >
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span className="truncate">{m.courseTitle ?? "Academia"}</span>
                    {tc && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-primary">
                        <PlayCircle className="h-3 w-3" /> {tc}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 font-display text-base text-foreground">
                    {m.lessonTitle ?? "Aula"}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {excerpt(m.content)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

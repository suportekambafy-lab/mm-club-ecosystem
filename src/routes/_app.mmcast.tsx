import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Mic, Play, Search } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineAlert } from "@/components/mm/inline-alert";
import {
  listMmcastEpisodes,
  type MmcastEpisode,
} from "@/lib/mmcast.functions";

export const Route = createFileRoute("/_app/mmcast")({
  head: () => ({
    meta: [
      { title: "MMCast — MM Club" },
      {
        name: "description",
        content:
          "Histórias reais, estratégias e conversas com pessoas que estão a construir resultados extraordinários.",
      },
      { property: "og:title", content: "MMCast — MM Club" },
      {
        property: "og:description",
        content:
          "O podcast oficial da Marca Milionária, dentro do MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MmcastPage,
});

const PAGE_SIZE = 9;

function episodeDate(ep: MmcastEpisode): string {
  const raw = ep.published_at ?? ep.created_at;
  try {
    return format(new Date(raw), "d 'de' MMMM 'de' yyyy", { locale: pt });
  } catch {
    return "";
  }
}

function MmcastPage() {
  const [episodes, setEpisodes] = useState<MmcastEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listMmcastEpisodes()
      .then((rows) => {
        if (cancelled) return;
        setEpisodes(rows);
        setError(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(episodes.map((e) => e.category).filter((c): c is string => !!c)),
      ),
    [episodes],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = episodes;
    if (category) list = list.filter((e) => e.category === category);
    if (q) {
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.guest_name ?? "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const da = new Date(a.published_at ?? a.created_at).getTime();
      const db = new Date(b.published_at ?? b.created_at).getTime();
      return sort === "newest" ? db - da : da - db;
    });
  }, [episodes, search, category, sort]);

  const isDefaultView = !search.trim() && !category && sort === "newest";
  const featured = isDefaultView ? filtered[0] : null;
  const grid = featured ? filtered.slice(1) : filtered;
  const visible = grid.slice(0, visibleCount);

  if (loading) return <MmcastSkeleton />;

  return (
    <div className="section-stack">
      {/* Cabeçalho */}
      <header className="px-1">
        <div className="flex items-center gap-2 text-primary">
          <Mic className="h-4 w-4" />
          <p className="text-[10px] font-medium uppercase tracking-[0.24em]">
            O podcast da Marca Milionária
          </p>
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight text-foreground md:text-4xl">
          MMCast
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
          Histórias reais, estratégias e conversas com pessoas que estão a
          construir resultados extraordinários.
        </p>
      </header>

      {error ? (
        <InlineAlert
          surface="mmcast"
          onRetry={() => {
            setError(false);
            setLoading(true);
            setReloadKey((k) => k + 1);
          }}
        >
          Não foi possível carregar os episódios do MMCast.
        </InlineAlert>
      ) : episodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-border bg-surface-1 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
            <Mic className="h-5 w-5" />
          </div>
          <p className="font-display text-lg text-foreground">
            Ainda não há episódios publicados.
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            O primeiro episódio do MMCast está a caminho — vais ser avisado
            assim que estrear.
          </p>
        </div>
      ) : (
        <>
          {/* Episódio em destaque */}
          {featured && (
            <Link
              to="/mmcast/$episodeId"
              params={{ episodeId: featured.id }}
              className="group block overflow-hidden rounded-3xl border border-border bg-surface-1 transition hover:border-primary/40"
            >
              <div className="grid md:grid-cols-2">
                <div className="relative aspect-video overflow-hidden md:aspect-auto md:min-h-[280px]">
                  <img
                    src={featured.thumbnail_url ?? undefined}
                    alt={featured.title}
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <span className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                    Episódio {featured.episode_number} · Estreia
                  </span>
                  <div className="absolute bottom-4 left-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition group-hover:scale-110">
                    <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-3 p-6 md:p-8">
                  <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-primary">
                    Episódio mais recente
                  </p>
                  <h2 className="font-display text-xl leading-snug text-foreground md:text-2xl">
                    {featured.title}
                  </h2>
                  {featured.guest_name && (
                    <p className="text-sm font-medium text-foreground/80">
                      Com {featured.guest_name}
                    </p>
                  )}
                  {featured.short_description && (
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {featured.short_description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {episodeDate(featured)}
                  </p>
                  <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition group-hover:gap-3">
                    Assistir episódio <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          )}

          {/* Pesquisa, filtros e ordenação */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Pesquisar por título ou convidado…"
                className="h-11 w-full rounded-full border border-border bg-surface-1 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/50"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                  category === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface-1 text-muted-foreground hover:text-foreground",
                )}
              >
                Todos
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(category === c ? null : c)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                    category === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface-1 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
                className="h-9 rounded-full border border-border bg-surface-1 px-3 text-xs font-medium text-foreground outline-none"
                aria-label="Ordenar episódios"
              >
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
              </select>
            </div>
          </div>

          {/* Grelha de episódios */}
          {visible.length === 0 ? (
            <p className="px-1 py-8 text-center text-sm text-muted-foreground">
              Nenhum episódio encontrado para esta pesquisa.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((ep) => (
                <Link
                  key={ep.id}
                  to="/mmcast/$episodeId"
                  params={{ episodeId: ep.id }}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface-1 transition hover:border-primary/40"
                >
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={ep.thumbnail_url ?? undefined}
                      alt={ep.title}
                      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                      EP {ep.episode_number}
                    </span>
                    <div className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition group-hover:opacity-100">
                      <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    <h3 className="line-clamp-2 font-display text-base leading-snug text-foreground">
                      {ep.title}
                    </h3>
                    {ep.guest_name && (
                      <p className="text-xs font-medium text-foreground/70">
                        Com {ep.guest_name}
                      </p>
                    )}
                    {ep.short_description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {ep.short_description}
                      </p>
                    )}
                    <p className="mt-auto pt-2 text-[11px] text-muted-foreground">
                      {episodeDate(ep)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {grid.length > visibleCount && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="rounded-full border border-border bg-surface-1 px-6 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/40"
              >
                Carregar mais episódios
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MmcastSkeleton() {
  return (
    <div className="section-stack">
      <div className="px-1">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="mt-3 h-9 w-40" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-[280px] w-full rounded-3xl md:h-[320px]" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-3xl border border-border">
            <Skeleton className="aspect-video w-full" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

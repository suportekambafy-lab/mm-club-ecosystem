import { useEffect, useRef, useState } from "react";
import { InlineAlert } from "@/components/mm/inline-alert";
import { NextStepCard } from "@/components/mm/next-step-card";
import { trackLoadTime } from "@/lib/ux-analytics";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Play,
} from "lucide-react";
import legacyHero from "@/assets/marca-milionaria-legacy-hero.jpg.asset.json";
import { CourseCard } from "@/components/mm/course-card";
import { Rail } from "@/components/mm/rail";

import { LiveHeroBanner } from "@/components/mm/live-hero-banner";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useUserProgress,
  applyProgress,
} from "@/hooks/use-user-progress";
import { listLivesAuthed as listLives } from "@/lib/lives.functions";
import { listMmcastEpisodes, type MmcastEpisode } from "@/lib/mmcast.functions";
import { expertsById } from "@/data/experts";
import { courses } from "@/data/courses";
import { sortCatalog } from "@/lib/course-order";

import {
  CinematicHeroSkeleton,
  RailSkeleton,
} from "@/components/mm/skeletons";


import { supabase } from "@/integrations/supabase/client";
import { resolveLiveCoverUrl } from "@/lib/live-cover-url";
import { useLegacyLaunch } from "@/hooks/use-legacy-launch";




export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Início — MM Club" },
      { name: "description", content: "Continua as tuas aulas, acompanha as lives e vê o último episódio do MMCast." },
      { property: "og:title", content: "Início — MM Club" },
      { property: "og:description", content: "As tuas aulas, lives e MMCast num só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});


function DashboardPage() {
  const { user: sessionUser, loading: userLoading } = useCurrentUser();
  const { progress, loaded: progressLoaded } = useUserProgress();

  // Real live from backend — takes priority over static nextLive placeholder.
  type RealLive = Awaited<ReturnType<typeof listLives>>[number];
  const [realFeaturedLive, setRealFeaturedLive] = useState<RealLive | null>(null);
  const [replays, setReplays] = useState<RealLive[]>([]);
  const [livesLoaded, setLivesLoaded] = useState(false);

  const [livesError, setLivesError] = useState(false);
  const [livesReloadKey, setLivesReloadKey] = useState(0);
  const startedAt = useRef(typeof performance !== "undefined" ? performance.now() : 0);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listLives()
        .then((rows) => {
          if (cancelled) return;
          const list = rows as RealLive[];
          const active = list.find((l) => l.status === "live");
          const upcoming = list
            .filter((l) => l.status === "scheduled" && new Date(l.starts_at).getTime() > Date.now() - 3600_000)
            .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
          setRealFeaturedLive(active ?? upcoming ?? null);
          setReplays(
            list
              .filter((l) => l.status === "ended" || l.status === "published")
              .sort(
                (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
              ),
          );

          setLivesError(false);
          setLivesLoaded(true);
        })
        .catch(() => {
          if (cancelled) return;
          setLivesError(true);
          setLivesLoaded(true);
        });
    };
    load();
    const channel = supabase
      .channel("dashboard-lives-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lives" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [livesReloadKey]);

  // Revelação progressiva: assim que a sessão e o progresso estão prontos o
  // painel aparece. As lives entram depois, com o seu próprio estado.
  const ready = !userLoading && progressLoaded;

  useEffect(() => {
    if (ready) trackLoadTime("dashboard", startedAt.current);
  }, [ready]);

  if (!ready) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 md:space-y-10">

      {/* Cinematic hero — full bleed, autoplay muted loop, editorial overlay */}
      <CinematicHero name={sessionUser?.name ?? ""} loading={userLoading && !sessionUser} />

      {/* Live activa ou próxima em destaque (com contador) */}
      {!livesLoaded ? null : livesError ? (
        <InlineAlert
          surface="dashboard"
          onRetry={() => {
            setLivesLoaded(false);
            setLivesError(false);
            setLivesReloadKey((k) => k + 1);
          }}
        >
          Não foi possível carregar as sessões ao vivo.
        </InlineAlert>
      ) : (
        realFeaturedLive &&
        (realFeaturedLive.status === "live" || realFeaturedLive.status === "scheduled") && (
          <LiveHeroBanner live={realFeaturedLive} />
        )
      )}

      {/* Trilho guiado: a aula exata a ver a seguir */}
      <NextStepCard />


      <Rail
        title="Academia"
        action={
          <Link
            to="/academia"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Ver tudo <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        {sortCatalog(courses).map((c) => (
          <CourseCard
            key={c.id}
            course={applyProgress(c, progress)}
            resumeLessonId={progress[c.id]?.lastLessonId ?? null}
            className="w-[44vw] max-w-[300px] shrink-0 sm:w-[340px]"
          />
        ))}

      </Rail>

      <MmcastBlock />

      {replays.length > 0 && (
        <Rail
          title="Aulas ao vivo"
          
          action={
            <Link
              to="/lives"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver tudo <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {replays.slice(0, 4).map((l) => (
            <ReplayCard key={l.id} live={l} />
          ))}
        </Rail>
      )}



    </div>
  );
}

function MmcastBlock() {
  const [ep, setEp] = useState<MmcastEpisode | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMmcastEpisodes()
      .then((rows) => {
        if (!cancelled) setEp(rows[0] ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ep) return null;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between px-1">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-primary">
            MMCast
          </p>
          <h2 className="mt-1.5 font-display text-xl leading-tight text-foreground md:text-2xl">
            Último episódio
          </h2>
        </div>
        <Link
          to="/mmcast"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <Link
        to="/mmcast/$episodeId"
        params={{ episodeId: ep.id }}
        className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface-1 transition hover:border-primary/40 sm:flex-row"
      >
        <div className="relative aspect-video shrink-0 overflow-hidden sm:aspect-auto sm:h-auto sm:w-64 md:w-80">
          <img
            src={ep.thumbnail_url ?? undefined}
            alt={ep.title}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
          <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">
            EP {ep.episode_number}
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-2 p-5 md:p-6">
          <h3 className="line-clamp-2 font-display text-lg leading-snug text-foreground">
            {ep.title}
          </h3>
          {ep.guest_name && (
            <p className="text-sm font-medium text-foreground/70">
              Com {ep.guest_name}
            </p>
          )}
          <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition group-hover:gap-3">
            <Play className="h-3.5 w-3.5" fill="currentColor" /> Assistir agora
          </span>
        </div>
      </Link>
    </section>
  );
}

function ReplayCard({
  live,
}: {
  live: { id: string; title: string; starts_at: string; cover_url?: string | null; expert_id?: string | null };
}) {
  const coverUrl = resolveLiveCoverUrl(live.cover_url ?? null);
  const dateStr = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(
    new Date(live.starts_at),
  );
  const expert = live.expert_id ? expertsById[live.expert_id] : undefined;

  return (
    <Link
      to="/lives/$liveId"
      params={{ liveId: live.id }}
      className="group w-[44vw] max-w-[300px] shrink-0 overflow-hidden card-soft bg-surface-1 transition hover:-translate-y-0.5 hover:border-primary/40 sm:w-[340px]"
    >
      <div
        className="relative aspect-video w-full bg-surface-2"
        style={
          coverUrl
            ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
          <Play className="h-3 w-3" />
          Replay
        </span>
      </div>
      <div className="p-4">
        <p className="line-clamp-2 font-display text-sm leading-tight text-foreground">{live.title}</p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {dateStr}
          {expert ? ` · ${expert.name}` : ""}
        </p>
      </div>
    </Link>
  );
}


function CinematicHero({ name }: { name: string; loading?: boolean }) {
  const legacy = useLegacyLaunch();
  const firstName = name.split(" ")[0];

  return (
    <section className="relative -mx-3 overflow-hidden bg-surface-2 sm:-mx-4 md:-mx-8">
      <div className="relative min-h-[260px] md:min-h-[300px]">
        <img
          src={legacyHero.url}
          alt="Marca Milionária Legacy"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/75 to-background/20" />
        <div className="relative flex min-h-[260px] flex-col justify-end px-6 py-7 md:min-h-[300px] md:px-10 md:py-9">
          <p className="text-sm text-foreground/80">{firstName ? `Olá, ${firstName}.` : "Bem-vindo ao MM Club."}</p>
          <h1 className="mt-3 max-w-lg font-display text-3xl leading-tight text-foreground md:text-4xl">
            Marca Milionária <span className="text-primary">Legacy</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{legacy.released ? "As tuas aulas já estão disponíveis." : legacy.headline}</p>
          <Link
            to="/academia/$courseId"
            params={{ courseId: "marca-milionaria-legacy" }}
            className="btn-arrow mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft"
          >
            {legacy.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 md:space-y-10">
      <CinematicHeroSkeleton />
      <RailSkeleton cards={3} />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { InlineAlert } from "@/components/mm/inline-alert";
import { NextStepCard } from "@/components/mm/next-step-card";
import { OnboardingChecklist } from "@/components/mm/onboarding-checklist";
import { ContinueWatching } from "@/components/mm/continue-watching";
import { useContinueWatching } from "@/hooks/use-continue-watching";
import { useNextStep } from "@/hooks/use-next-step";
import { resumeMatchesStep } from "@/lib/club/resume-merge";
import { ActiveProductModules } from "@/components/mm/product-modules";
import { trackLoadTime } from "@/lib/ux-analytics";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Play,
  Pause,
} from "lucide-react";
import dashboardHero from "@/assets/dashboard-hero.jpg";
import { Button } from "@/components/ui/button";
import legacyHero from "@/assets/marca-milionaria-legacy-hero.jpg.asset.json";
import { CourseCard } from "@/components/mm/course-card";
import { Rail } from "@/components/mm/rail";

import { LiveHeroBanner } from "@/components/mm/live-hero-banner";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
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
  const { loading: userLoading, user } = useCurrentUser();
  const { step, loaded: stepLoaded } = useNextStep();
  const { item: resume } = useContinueWatching(user?.id);
  // A mesma aula nunca aparece duas vezes: se o próximo passo já é a aula a
  // retomar, é ele que mostra o minuto exato e o outro cartão fica de fora.
  const merged = resumeMatchesStep(
    resume,
    step ? { courseId: step.course.id, lessonId: step.lesson.id } : null,
  );
  const [episode, setEpisode] = useState<MmcastEpisode | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMmcastEpisodes().then((rows) => {
      if (!cancelled) setEpisode(rows[0] ?? null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
  const ready = !userLoading && stepLoaded;

  useEffect(() => {
    if (ready) trackLoadTime("dashboard", startedAt.current);
  }, [ready]);

  if (!ready) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 md:space-y-10">

      {/* Cinematic hero — full bleed, autoplay muted loop, editorial overlay */}
      <CinematicHero episode={episode} />

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

      {user && <OnboardingChecklist userId={user.id} />}
      {resume && stepLoaded && !merged && <ContinueWatching item={resume} />}

      {/* Trilho guiado: a aula exata a ver a seguir, com o minuto de retoma */}
      <NextStepCard step={step} resumeSeconds={merged && resume ? resume.seconds : null} />


      <ActiveProductModules />

      <MmcastBlock ep={episode} />

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

function MmcastBlock({ ep }: { ep: MmcastEpisode | null }) {
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
        <div className="relative aspect-video shrink-0 self-center overflow-hidden sm:w-64 md:w-80">
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


function CinematicHero({ episode }: { episode: MmcastEpisode | null }) {
  const legacy = useLegacyLaunch();
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = episode ? 2 : 1;

  useEffect(() => {
    if (paused || count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % count), 7000);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  const thumb = episode?.thumbnail_url || dashboardHero;
  const fade = "absolute inset-0 transition-opacity duration-1000 motion-reduce:transition-none";

  return (
    <section aria-label="Destaques do MM Club" className="relative -mx-3 overflow-hidden sm:-mx-4 md:-mx-8">
      <div className="relative min-h-[450px] bg-surface-2 sm:min-h-[380px] sm:aspect-video md:aspect-[21/9] md:min-h-[420px] md:max-h-[600px]">
        <div aria-hidden={slide !== 0} className={`${fade} ${slide === 0 ? "opacity-100" : "opacity-0"}`}>
          <img src={legacyHero.url} alt="Marca Milionária Legacy" decoding="async" fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover" />
        </div>

        {episode && (
          <div aria-hidden={slide !== 1} className={`${fade} ${slide === 1 ? "opacity-100" : "opacity-0"}`}>
            <img src={thumb} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
            <div className="absolute inset-x-0 top-0 aspect-video overflow-hidden md:hidden">
              <img src={thumb} alt={episode.title} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            </div>
            <img src={thumb} alt="" aria-hidden className="hidden md:block absolute inset-0 h-full w-full object-contain md:object-right" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-background/20 to-transparent" />
        <div className="absolute inset-0 flex items-end">
          <div className="w-full px-6 pb-14 md:px-14 md:pb-20">
            {slide === 0 ? (
              <div>
                <p className="text-xs font-medium uppercase text-primary">{legacy.released ? "Já disponível" : "Novo curso"}</p>
                <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight text-foreground md:text-6xl">
                  Marca Milionária <span className="text-primary">Legacy</span>
                </h1>
                <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-lg">{legacy.released ? "Já podes começar. Todas as aulas abertas para membros." : `${legacy.headline}.`}</p>
                <Button asChild className="btn-arrow mt-5">
                  <Link to="/academia">{legacy.cta} <ArrowRight /></Link>
                </Button>
              </div>
            ) : episode ? (
              <div>
                <p className="text-xs font-medium uppercase text-primary">Episódio {episode.episode_number}{episode.guest_name ? ` · ${episode.guest_name}` : ""}</p>
                <h1 className="mt-3 font-display text-3xl leading-tight text-foreground md:text-6xl">MM<span className="text-primary">Cast</span></h1>
                <p className="mt-3 max-w-xl text-base leading-snug text-foreground md:text-xl">{episode.title}</p>
                <Button asChild className="btn-arrow mt-4">
                  <Link to="/mmcast/$episodeId" params={{ episodeId: episode.id }}><Play /> Ver episódio <ArrowRight /></Link>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        {count > 1 && (
          <div className="absolute bottom-3 right-5 flex items-center gap-1 md:bottom-5 md:right-10">
            {Array.from({ length: count }).map((_, index) => (
              <Button key={index} variant="ghost" size="icon" onClick={() => setSlide(index)}
                aria-label={`Ver destaque ${index + 1}: ${index === 1 ? "MMCast" : "Marca Milionária Legacy"}`} aria-pressed={slide === index}
                className="h-9 w-9">
                <span className={`h-1.5 rounded-full transition-all motion-reduce:transition-none ${slide === index ? "w-6 bg-primary" : "w-1.5 bg-foreground/40"}`} />
              </Button>
            ))}
            <Button variant="ghost" size="icon" className="h-9 w-9 text-foreground" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Retomar destaques" : "Pausar destaques"} title={paused ? "Retomar destaques" : "Pausar destaques"}>
              {paused ? <Play /> : <Pause />}
            </Button>
          </div>
        )}
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

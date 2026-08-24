import { useEffect, useRef, useState } from "react";
import { InlineAlert } from "@/components/mm/inline-alert";
import { NextStepCard } from "@/components/mm/next-step-card";
import { StreakCard } from "@/components/mm/streak-card";
import { trackLoadTime } from "@/lib/ux-analytics";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Play,
  Users,
} from "lucide-react";
import dashboardHero from "@/assets/dashboard-hero.jpg";
import { CourseCard } from "@/components/mm/course-card";
import { Rail } from "@/components/mm/rail";

import { LiveHeroBanner } from "@/components/mm/live-hero-banner";
import { currentUser as fallbackUser } from "@/data/user";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useUserProgress,
  applyProgress,
  continueFromProgress,
  recommendedFromProgress,
} from "@/hooks/use-user-progress";
import { listLivesAuthed as listLives } from "@/lib/lives.functions";
import { expertsById } from "@/data/experts";
import { courses } from "@/data/courses";
import { useBunnyThumb } from "@/hooks/use-bunny-thumb";
import {
  CinematicHeroSkeleton,
  RailSkeleton,
  TextLines,
} from "@/components/mm/skeletons";


import { supabase } from "@/integrations/supabase/client";
import { resolveLiveCoverUrl } from "@/lib/live-cover-url";




export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MM Club" },
      { name: "description", content: "O teu ecossistema privado da Marca Milionária." },
    ],
  }),
  component: DashboardPage,
});


function DashboardPage() {
  const { user: sessionUser, loading: userLoading } = useCurrentUser();
  const user = sessionUser ?? fallbackUser;
  const { progress, loaded: progressLoaded } = useUserProgress();
  const cont = continueFromProgress(progress);
  const recommended = recommendedFromProgress(progress);

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
    <div className="section-stack">

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

      {/* Sequência de aprendizagem e meta semanal */}
      <StreakCard />

      {/* Rails na ordem editorial */}
      {cont.length > 0 && (
        <Rail
          title="Continua a aprender"
          subtitle="Onde ficaste da última vez."
          action={
            <Link
              to="/academia"
              className="hidden text-xs font-medium text-primary hover:underline md:inline-flex md:items-center md:gap-1"
            >
              Ver tudo <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {cont.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              resumeLessonId={progress[c.id]?.lastLessonId ?? null}
              showResumeThumb
              className="w-[44vw] max-w-[300px] shrink-0 sm:w-[340px]"
            />
          ))}

        </Rail>
      )}

      <Rail
        title="Explorar Academia"
        subtitle="Todo o catálogo do ecossistema MM."
        action={
          <Link
            to="/academia"
            className="hidden text-xs font-medium text-primary hover:underline md:inline-flex md:items-center md:gap-1"
          >
            Ver tudo <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        {courses.map((c) => (
          <CourseCard
            key={c.id}
            course={applyProgress(c, progress)}
            resumeLessonId={progress[c.id]?.lastLessonId ?? null}
            className="w-[44vw] max-w-[300px] shrink-0 sm:w-[340px]"
          />
        ))}

      </Rail>

      {replays.length > 0 && (
        <Rail
          title="Aulas ao vivo"
          subtitle="Todas as sessões gravadas, disponíveis quando quiseres."
          action={
            <Link
              to="/lives"
              className="hidden text-xs font-medium text-primary hover:underline md:inline-flex md:items-center md:gap-1"
            >
              Ver tudo <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {replays.map((l) => (
            <ReplayCard key={l.id} live={l} />
          ))}
        </Rail>
      )}



      {realFeaturedLive?.status !== "live" && realFeaturedLive && (
        <section>
          <div className="mb-4 flex items-end justify-between px-1">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-primary">
                Próxima Live
              </p>
              <h2 className="mt-1.5 font-display text-xl leading-tight text-foreground md:text-2xl">
                O palco privado do clube.
              </h2>
            </div>
          </div>
          <LiveHeroBanner live={realFeaturedLive} />
        </section>
      )}

      {/* Curadoria só faz sentido com catálogo suficiente para escolher. */}
      {recommended.length >= 3 && (
        <Rail
          title="Recomendado para ti"
          subtitle="Curadoria com base no teu percurso."
        >
          {recommended.map((c) => (
            <CourseCard key={c.id} course={c} className="w-[44vw] max-w-[300px] shrink-0 sm:w-[340px]" />
          ))}
        </Rail>
      )}


      <JadeCTA />
      <CommunityBlock />
    </div>
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
      className="group w-[44vw] max-w-[300px] shrink-0 overflow-hidden rounded-3xl border border-border bg-surface-1 transition hover:-translate-y-0.5 hover:border-primary/40 sm:w-[340px]"
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


function CinematicHero({ name, loading }: { name: string; loading?: boolean }) {
  const firstName = name.split(" ")[0];

  return (
    <section className="relative -mx-3 overflow-hidden sm:-mx-4 md:-mx-8">
      <div className="relative aspect-[16/9] w-full bg-black md:aspect-[21/9]">
        <img
          src={dashboardHero}
          alt="MM Club"
          decoding="async"
          fetchPriority="high"
          width={1600}
          height={693}
          className="absolute inset-0 h-full w-full object-cover brightness-[0.62] contrast-[1.05] saturate-[0.9]"
        />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/20 to-background/45" />


        <div className="absolute inset-0 flex items-end">
          <div className="w-full px-6 pb-8 md:px-14 md:pb-16">
            <p className="font-display text-[10px] uppercase tracking-[0.32em] text-primary md:text-xs">
              MM Club
            </p>
            <h1 className="mt-3 font-display text-3xl leading-[1.02] tracking-tight text-foreground md:text-6xl lg:text-7xl">
              Bom regresso,{" "}
              {loading || !firstName ? (
                <span className="inline-block h-[0.9em] w-[6ch] animate-pulse rounded-md bg-surface-2 align-middle" />
              ) : (
                <span className="text-primary">{firstName}</span>
              )}
              {!loading && firstName ? "." : ""}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-lg">
              Continua a construir a tua Marca Milionária.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}




function JadeCTA() {
  return (
    <Link
      to="/jade"
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-surface-1 p-6 ring-1 ring-border transition hover:ring-[color:var(--hairline)] md:flex-row md:items-center md:justify-between md:p-8"
    >
      <div className="flex items-center gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
            MM Inteligence
          </p>
          <h3 className="mt-1 font-display text-xl text-foreground md:text-2xl">
            A inteligência do clube.
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Treinada com a base de conhecimento MM. Pergunta o que quiseres.
          </p>
        </div>
      </div>
      <span className="inline-flex w-max items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition group-hover:bg-gold-soft">
        Abrir chat <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

type RecentPost = {
  id: string;
  content: string;
  created_at: string;
  author: { display_name: string | null } | null;
};

function CommunityBlock() {
  const [posts, setPosts] = useState<RecentPost[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("community_posts")
      .select("id, content, created_at, author:profiles!community_posts_author_id_fkey(display_name)")
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (cancelled) return;
        setPosts((data as unknown as RecentPost[]) ?? []);
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fresh = posts.filter(
    (p) => Date.now() - new Date(p.created_at).getTime() < 86_400_000,
  ).length;

  return (
    <section className="rounded-2xl bg-surface-1 p-6 ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg text-foreground">Comunidade</h3>
          </div>
          {!hydrated ? (
            <TextLines lines={1} className="mt-3 max-w-xs" />
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {posts.length === 0
                ? "Ainda sem publicações. Sê o primeiro a partilhar."
                : fresh > 0
                  ? `${fresh} ${fresh === 1 ? "nova publicação" : "novas publicações"} nas últimas 24 h.`
                  : "Grupo privado, avisos e networking."}
            </p>
          )}
        </div>
        <Link
          to="/comunidade"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:brightness-110"
        >
          Ver comunidade <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}



function DashboardSkeleton() {
  return (
    <div className="space-y-16">
      <CinematicHeroSkeleton />
      <RailSkeleton cards={3} />
    </div>
  );
}

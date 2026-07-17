import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Play,
  Users,
  Bot,
  Bell,
} from "lucide-react";
import { CourseCard } from "@/components/mm/course-card";
import { Rail } from "@/components/mm/rail";
import { ExpertAvatar } from "@/components/mm/expert-avatar";
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
import { supabase } from "@/integrations/supabase/client";

import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";


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
  const { progress } = useUserProgress();
  const cont = continueFromProgress(progress);
  const featured = cont[0];
  const recommended = recommendedFromProgress(progress);

  // Real live from backend — takes priority over static nextLive placeholder.
  type RealLive = Awaited<ReturnType<typeof listLives>>[number];
  const [realFeaturedLive, setRealFeaturedLive] = useState<RealLive | null>(null);
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
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="space-y-16">
      {/* Cinematic hero — full bleed, autoplay muted loop, editorial overlay */}
      <CinematicHero name={sessionUser?.name ?? ""} loading={userLoading && !sessionUser} />

      {/* Live activa em destaque */}
      {realFeaturedLive?.status === "live" && (
        <LiveHeroBanner live={realFeaturedLive} />
      )}

      {/* Continuar a construir */}
      {featured && <ContinueHero course={featured} />}

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
            <CourseCard key={c.id} course={c} className="w-[340px] shrink-0" />
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
            className="w-[340px] shrink-0"
          />
        ))}
      </Rail>

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

      <Rail
        title="Recomendado para ti"
        subtitle="Curadoria com base no teu percurso."
      >
        {recommended.map((c) => (
          <CourseCard key={c.id} course={c} className="w-[340px] shrink-0" />
        ))}
      </Rail>

      <JadeCTA />
      <CommunityBlock />
    </div>
  );
}

function CinematicHero({ name }: { name: string }) {
  const videoId = "J-ivFkMIHCQ";
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&playsinline=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1`;
  const firstName = name.split(" ")[0];
  return (
    <section className="relative -mx-3 overflow-hidden sm:-mx-4 md:-mx-8">
      <div className="relative aspect-[16/9] w-full bg-black md:aspect-[21/9]">
        <iframe
          src={src}
          title="MM Club"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full scale-[1.5] border-0"
          loading="lazy"
        />
        {/* Cinematic gradients — bottom heavy so text sits on darkness */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-background/30" />

        {/* Editorial overlay */}
        <div className="absolute inset-0 flex items-end">
          <div className="w-full px-6 pb-8 md:px-14 md:pb-16">
            <p className="font-display text-[10px] uppercase tracking-[0.32em] text-primary md:text-xs">
              MM Club
            </p>
            <h1 className="mt-3 font-display text-3xl leading-[1.02] tracking-tight text-foreground md:text-6xl lg:text-7xl">
              Bom regresso,{" "}
              <span className="text-primary">{firstName}</span>.
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



function ContinueHero({ course }: { course: import("@/data/types").Course }) {

  const expert = expertsById[course.expertId];
  const firstLessonId = course.modules?.[0]?.lessons?.[0]?.id;
  const linkProps = firstLessonId
    ? {
        to: "/academia/$courseId/$lessonId" as const,
        params: { courseId: course.id, lessonId: firstLessonId },
      }
    : {
        to: "/academia/$courseId" as const,
        params: { courseId: course.id },
      };
  return (
    <Link
      {...linkProps}
      className="group relative flex flex-col overflow-hidden rounded-2xl ring-1 ring-border transition hover:ring-[color:var(--hairline)] md:flex-row"
    >
      <div
        className="aspect-[16/9] md:aspect-auto md:h-[280px] md:w-[55%]"
        style={{ background: course.cover }}
      >
        <div className="h-full w-full bg-gradient-to-tr from-black/60 via-black/10 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-6 bg-surface-1 p-6 md:p-8">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
            Continuar
          </p>
          <h2 className="mt-3 font-display text-2xl leading-tight text-foreground md:text-3xl">
            {course.title}
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {course.tagline}
          </p>
          {expert && (
            <div className="mt-4">
              <ExpertAvatar expert={expert} showName showRole asLink={false} />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{Math.round(course.progress * 100)}% concluído</span>
            <span>·</span>
            <span>{course.duration}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round(course.progress * 100)}%` }}
            />
          </div>
          <div className="pt-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition group-hover:bg-gold-soft">
              <Play className="h-3.5 w-3.5 fill-current" /> Continuar
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function JadeCTA() {
  return (
    <Link
      to="/jade"
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-surface-1 p-6 ring-1 ring-border transition hover:ring-[color:var(--hairline)] md:flex-row md:items-center md:justify-between md:p-8"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-[color:var(--hairline)]">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
            MM Intelligence
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

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl bg-surface-1 p-6 ring-1 ring-border">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg text-foreground">Comunidade</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Grupo privado, avisos e networking.
        </p>
        <Link
          to="/comunidade"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          Entrar <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="rounded-2xl bg-surface-1 p-6 ring-1 ring-border">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg text-foreground">Atividade recente</h3>
        </div>
        {hydrated && posts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Ainda sem publicações. Sê o primeiro a partilhar na comunidade.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {posts.map((p) => (
              <li key={p.id} className="text-sm">
                <span className="font-medium text-foreground">
                  {p.author?.display_name ?? "Membro"}
                </span>
                <span className="ml-2 text-muted-foreground line-clamp-1">
                  {p.content}
                </span>
                <span className="ml-2 text-[11px] text-muted-foreground/70">
                  {formatDistanceToNow(new Date(p.created_at), { locale: pt, addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}


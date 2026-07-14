import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Play,
  Sparkles,
  Calendar,
  BookOpen,
  Wrench,
  Users,
  Radio,
  Bot,
  Zap,
  Bell,
} from "lucide-react";
import { CourseCard } from "@/components/mm/course-card";
import { Rail } from "@/components/mm/rail";
import { ExpertAvatar } from "@/components/mm/expert-avatar";
import { currentUser } from "@/data/user";
import { continueWatching, recommendedForUser } from "@/lib/personalization";
import { nextLive } from "@/data/lives";
import { news } from "@/data/news";
import { topTools } from "@/data/tools";
import { upcomingEvents } from "@/data/events";
import { communityNotices } from "@/data/community";
import { expertsById } from "@/data/experts";
import type { DashboardBlockId, NewsType } from "@/data/types";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — MM Club" },
      { name: "description", content: "O teu ecossistema privado da Marca Milionária." },
    ],
  }),
  component: DashboardPage,
});

const newsMeta: Record<NewsType, { icon: typeof BookOpen; label: string }> = {
  course: { icon: BookOpen, label: "Novo curso" },
  expert: { icon: Users, label: "Novo especialista" },
  live: { icon: Radio, label: "Nova live" },
  tool: { icon: Wrench, label: "Nova ferramenta" },
  jade: { icon: Bot, label: "Jade" },
};

function DashboardPage() {
  const user = currentUser;
  const cont = continueWatching(user);
  const featured = cont[0];
  const recommended = recommendedForUser(user);

  const blocks: Record<DashboardBlockId, React.ReactNode> = {
    continue:
      cont.length > 0 ? (
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
            <CourseCard key={c.id} course={c} className="w-[300px] shrink-0" />
          ))}
        </Rail>
      ) : null,
    recommended: (
      <Rail
        title="Recomendado para ti"
        subtitle="Curadoria com base no teu percurso."
      >
        {recommended.map((c) => (
          <CourseCard key={c.id} course={c} className="w-[300px] shrink-0" />
        ))}
      </Rail>
    ),
    "next-live": nextLive ? <NextLiveCard /> : null,
    news: <NewsRail />,
    "top-tools": <TopToolsBlock />,
    "upcoming-events": <UpcomingEventsBlock />,
    jade: <JadeCTA />,
    community: <CommunityBlock />,
  };

  return (
    <div className="space-y-12">
      {/* Hero — Continuar */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
              Bem-vindo de volta
            </p>
            <h1 className="mt-2 font-display text-3xl leading-tight text-foreground md:text-4xl">
              Olá, {user.name}.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O teu clube está vivo. Continua onde ficaste ou descobre o que há de novo.
            </p>
          </div>
        </div>

        {featured && <ContinueHero course={featured} />}
      </section>

      {user.dashboard.blocks.map((b) => (
        <div key={b}>{blocks[b]}</div>
      ))}
    </div>
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

function NextLiveCard() {
  if (!nextLive) return null;
  const expert = expertsById[nextLive.expertId];
  const [distance, setDistance] = useState<string>("");
  useEffect(() => {
    setDistance(
      formatDistanceToNow(new Date(nextLive.startsAt), {
        locale: pt,
        addSuffix: true,
      }),
    );
  }, []);
  return (
    <section className="grid gap-4 rounded-2xl bg-surface-1 p-6 ring-1 ring-border md:grid-cols-[1fr_auto] md:items-center md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <div
          className="h-24 w-24 shrink-0 rounded-xl ring-1 ring-[color:var(--hairline)]"
          style={{ background: nextLive.cover }}
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
              <Radio className="h-3 w-3" /> Próxima live
            </span>
            <span className="text-xs text-muted-foreground">{distance}</span>
          </div>
          <h3 className="mt-2 font-display text-xl text-foreground">
            {nextLive.title}
          </h3>
          {expert && (
            <div className="mt-3">
              <ExpertAvatar expert={expert} size="sm" showName showRole />
            </div>
          )}
        </div>
      </div>
      <Link
        to="/lives"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft"
      >
        <Calendar className="h-4 w-4" /> Adicionar
      </Link>
    </section>
  );
}

function NewsRail() {
  return (
    <Rail
      title="Novidades"
      subtitle="Tudo o que se moveu esta semana no clube."
    >
      {news.map((item) => {
        const Meta = newsMeta[item.type];
        const Icon = Meta.icon;
        return (
          <Link
            key={item.id}
            to={item.href}
            className="group flex w-[300px] shrink-0 flex-col justify-between gap-4 rounded-xl bg-surface-1 p-5 ring-1 ring-border transition hover:ring-[color:var(--hairline)]"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
                <Icon className="h-3 w-3" /> {Meta.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{item.timeAgo}</span>
            </div>
            <div>
              <p className="font-display text-base leading-tight text-foreground line-clamp-2">
                {item.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-primary opacity-0 transition group-hover:opacity-100">
              Explorar <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        );
      })}
    </Rail>
  );
}

function TopToolsBlock() {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between px-1">
        <div>
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            As tuas ferramentas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Atalhos rápidos para o dia-a-dia.</p>
        </div>
        <Link
          to="/ferramentas"
          className="text-xs font-medium text-primary hover:underline"
        >
          Ver tudo
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {topTools.map((t) => (
          <Link
            key={t.id}
            to="/ferramentas"
            className="group flex flex-col justify-between gap-3 rounded-xl bg-surface-1 p-4 ring-1 ring-border transition hover:ring-[color:var(--hairline)]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                {t.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function UpcomingEventsBlock() {
  return (
    <Rail title="Próximos eventos" subtitle="MM Summit, presenciais e masterclasses.">
      {upcomingEvents.map((ev) => (
        <Link
          key={ev.id}
          to="/eventos"
          className="group flex w-[340px] shrink-0 flex-col overflow-hidden rounded-xl bg-surface-1 ring-1 ring-border transition hover:ring-[color:var(--hairline)]"
        >
          <div className="h-32" style={{ background: ev.cover }} />
          <div className="flex flex-col gap-2 p-5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
              {ev.type} · {ev.date}
            </span>
            <h3 className="font-display text-lg leading-tight text-foreground">
              {ev.title}
            </h3>
            <p className="text-xs text-muted-foreground">{ev.location}</p>
          </div>
        </Link>
      ))}
    </Rail>
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
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
            Jade
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

function CommunityBlock() {
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
          <h3 className="font-display text-lg text-foreground">Avisos recentes</h3>
        </div>
        <ul className="mt-3 space-y-2">
          {communityNotices.slice(0, 2).map((n) => (
            <li key={n.id} className="text-sm">
              <span className="text-foreground">{n.title}</span>
              <span className="ml-2 text-xs text-muted-foreground">{n.timeAgo}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

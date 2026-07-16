import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Play, Search, Users, ChevronDown, Lock, ArrowRight, Clock } from "lucide-react";
import { liveCourses, upcomingCourses } from "@/data/courses";
import { expertsById } from "@/data/experts";
import type { Course } from "@/data/types";

export const Route = createFileRoute("/_app/academia/")({
  head: () => ({
    meta: [
      { title: "Academia — MM Club" },
      {
        name: "description",
        content:
          "Os teus cursos MM Club: continua onde ficaste e explora todo o catálogo do ecossistema.",
      },
    ],
  }),
  component: AcademiaPage,
});

function AcademiaPage() {
  const continuing = liveCourses.filter((c) => c.progress > 0 && c.progress < 1);
  const enrolled = liveCourses;
  // Featured: prefer next in progress, otherwise first live course.
  const featured = continuing[0] ?? liveCourses[0];

  return (
    <div className="space-y-16">
      {/* Featured cinematic hero — MasterClass energy */}
      {featured && <FeaturedHero course={featured} />}

      {/* Continue Watching — poster rail */}
      {continuing.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-end justify-between px-1">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-primary">
                A tua jornada
              </p>
              <h2 className="mt-1.5 font-display text-2xl leading-tight text-foreground md:text-3xl">
                Continua onde ficaste.
              </h2>
            </div>
          </div>
          <div className="scrollbar-none -mx-1 flex gap-5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {continuing.map((c) => (
              <PosterCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}

      {/* Enrolled Courses grid — streaming poster feel */}
      <section className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between px-1">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-primary">
              Academia MM
            </p>
            <h2 className="mt-1.5 font-display text-2xl leading-tight text-foreground md:text-3xl">
              O catálogo completo.
            </h2>
            <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">
              Streaming premium de conhecimento — todos os cursos, sem ruído.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex h-11 min-w-[220px] items-center gap-2 rounded-full border border-border bg-surface-1 px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Procurar curso..."
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button
              type="button"
              className="hidden h-11 items-center gap-2 rounded-full border border-border bg-surface-1 px-4 text-sm text-foreground transition hover:border-[color:var(--hairline)] md:flex"
            >
              Todos
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {enrolled.map((c) => (
            <PosterCard key={c.id} course={c} inGrid />
          ))}
        </div>
      </section>

      {/* Em breve */}
      {upcomingCourses.length > 0 && (
        <section className="space-y-5">
          <div className="px-1">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
              <Lock className="h-3 w-3" /> Em breve
            </div>
            <h2 className="font-display text-2xl text-foreground md:text-3xl">
              Próximos lançamentos
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingCourses.map((c) => (
              <ComingSoonCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FeaturedHero({ course }: { course: Course }) {
  const expert = expertsById[course.expertId];
  const firstLesson = course.modules?.[0]?.lessons?.[0];
  const linkProps = firstLesson
    ? {
        to: "/academia/$courseId/$lessonId" as const,
        params: { courseId: course.id, lessonId: firstLesson.id },
      }
    : { to: "/academia/$courseId" as const, params: { courseId: course.id } };
  const percent = Math.round(course.progress * 100);

  return (
    <Link
      {...linkProps}
      className="group relative -mx-3 block overflow-hidden sm:-mx-4 md:-mx-8"
    >
      <div
        className="relative aspect-[16/10] w-full md:aspect-[21/9]"
        style={{ background: course.cover }}
      >
        {/* Cinematic gradient stack */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/30 to-transparent" />

        <div className="absolute inset-0 flex items-end">
          <div className="w-full px-6 pb-8 md:px-14 md:pb-14 lg:max-w-3xl">
            <p className="font-display text-[10px] uppercase tracking-[0.32em] text-primary md:text-xs">
              {percent > 0 ? "Continua a assistir" : "Destaque"}
            </p>
            <h1 className="mt-3 font-display text-3xl leading-[1.02] tracking-tight text-foreground md:text-5xl lg:text-6xl">
              {course.title}
            </h1>
            {course.tagline && (
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                {course.tagline}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition group-hover:bg-gold-soft">
                <Play className="h-4 w-4 fill-current" />
                {percent > 0 ? "Continuar" : "Começar agora"}
              </span>
              {expert && (
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-9 w-9 shrink-0 rounded-full ring-1 ring-hairline"
                    style={
                      expert.logo
                        ? { backgroundImage: `url(${expert.logo})`, backgroundSize: "cover", backgroundPosition: "center" }
                        : { background: expert.photo }
                    }
                  />
                  <div className="text-xs">
                    <p className="font-medium text-foreground">{expert.name}</p>
                    <p className="text-muted-foreground">{expert.role}</p>
                  </div>
                </div>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {course.duration}
              </span>
            </div>

            {percent > 0 && (
              <div className="mt-5 max-w-md">
                <div className="h-1 overflow-hidden rounded-full bg-surface-3/50">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {percent}% concluído
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function PosterCard({ course, inGrid }: { course: Course; inGrid?: boolean }) {
  const expert = expertsById[course.expertId];
  const firstLesson = course.modules?.[0]?.lessons?.[0];
  const linkProps =
    firstLesson && course.progress > 0
      ? {
          to: "/academia/$courseId/$lessonId" as const,
          params: { courseId: course.id, lessonId: firstLesson.id },
        }
      : { to: "/academia/$courseId" as const, params: { courseId: course.id } };
  const percent = Math.round(course.progress * 100);

  return (
    <Link
      {...linkProps}
      className={
        (inGrid ? "" : "w-[320px] shrink-0 ") +
        "group relative flex flex-col overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border transition-all duration-500 hover:-translate-y-1 hover:ring-[color:var(--hairline)] hover:shadow-[0_28px_80px_-30px_oklch(0.82_0.13_82_/_0.35)]"
      }
    >
      <div
        className="relative aspect-[16/10] overflow-hidden"
        style={{ background: course.cover }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 50%, oklch(0.82 0.13 82 / 0.22), transparent 70%)",
          }}
        />

        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white backdrop-blur-md">
          <Clock className="h-3 w-3" />
          {course.duration}
        </div>

        <div className="absolute right-3 top-3 flex h-11 w-11 translate-y-1 items-center justify-center rounded-full bg-primary opacity-0 shadow-[0_10px_30px_-8px_oklch(0.82_0.13_82_/_0.7)] transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <Play className="h-4 w-4 fill-primary-foreground text-primary-foreground" />
        </div>

        {percent > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/40">
            <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-display text-lg leading-tight tracking-tight text-foreground line-clamp-2">
          {course.title}
        </h3>
        {expert && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            <span className="text-foreground">{expert.name}</span>
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            {expert.role}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Play className="h-3 w-3" />
            {course.lessonsCount} aulas
          </span>
          {percent > 0 && <span className="text-primary">{percent}%</span>}
        </div>
      </div>
    </Link>
  );
}



function ComingSoonCard({ course }: { course: Course }) {
  const expert = expertsById[course.expertId];
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border">
      <div className="aspect-[16/9]" style={{ background: course.cover }}>
        <div className="h-full w-full bg-linear-to-t from-black/70 to-transparent" />
      </div>
      <div className="flex flex-col gap-2 p-5">
        <div className="inline-flex w-max items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
          <Lock className="h-3 w-3" /> Em breve
        </div>
        <h3 className="font-display text-lg leading-tight text-foreground">
          {course.title}
        </h3>
        {expert && (
          <p className="text-xs text-muted-foreground">
            Especialista: <span className="text-foreground">{expert.name}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
      </div>
    </div>
  );
}

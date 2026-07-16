import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Play, Search, Users, ChevronDown, Lock } from "lucide-react";
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
  const enrolled = liveCourses; // for now, all live courses are enrolled

  return (
    <div className="space-y-8">
      {/* Continue Watching */}
      <section className="overflow-hidden rounded-3xl border border-border bg-surface-1 p-6 md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-violet/20 text-violet">
            <Play className="h-4 w-4 fill-current" />
          </span>
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            Continua onde ficaste
          </h2>
        </div>

        {continuing.length ? (
          <div className="scrollbar-none -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
            {continuing.map((c) => (
              <ContinueCard key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ainda não começaste nenhum curso. Escolhe um em baixo e mergulha.
          </p>
        )}
      </section>

      {/* Enrolled Courses header */}
      <section className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-2xl text-foreground md:text-3xl">
              Cursos inscritos
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mergulha, aprende e liberta o teu potencial.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex h-11 min-w-[220px] items-center gap-2 rounded-2xl border border-border bg-surface-1 px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Procurar curso..."
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button
              type="button"
              className="flex h-11 items-center gap-2 rounded-2xl border border-border bg-surface-1 px-4 text-sm text-foreground transition hover:border-[color:var(--hairline)]"
            >
              Todos
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {enrolled.map((c) => (
            <EnrolledRow key={c.id} course={c} />
          ))}
        </div>
      </section>

      {/* Em breve */}
      {upcomingCourses.length > 0 && (
        <section className="space-y-5">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
              <Lock className="h-3 w-3" /> Em breve
            </div>
            <h2 className="font-display text-xl text-foreground md:text-2xl">
              Próximos lançamentos
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingCourses.map((c) => (
              <ComingSoonCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ContinueCard({ course }: { course: Course }) {
  const expert = expertsById[course.expertId];
  const firstLesson = course.modules?.[0]?.lessons?.[0];
  const linkProps = firstLesson
    ? {
        to: "/academia/$courseId/$lessonId" as const,
        params: { courseId: course.id, lessonId: firstLesson.id },
      }
    : { to: "/academia/$courseId" as const, params: { courseId: course.id } };

  return (
    <Link
      {...linkProps}
      className="group flex w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl bg-surface-2 transition hover:bg-surface-3"
    >
      <div className="relative aspect-video overflow-hidden" style={{ background: course.cover }}>
        {firstLesson?.cover && (
          <img
            src={firstLesson.cover}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
        <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-background transition group-hover:scale-110">
          <Play className="h-5 w-5 translate-x-0.5 fill-current" />
        </span>
        <div className="absolute inset-x-3 bottom-3">
          <div className="relative h-1 rounded-full bg-white/25">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              style={{ width: `${Math.round(course.progress * 100)}%` }}
            />
          </div>
        </div>
      </div>
      <div className="p-4">
        <p className="line-clamp-1 text-sm font-medium text-foreground">{course.title}</p>
        {expert && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            Especialista: <span className="text-foreground">{expert.name}</span>
          </p>
        )}
        <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {Math.round(course.progress * 100)}% · {course.duration}
        </p>
      </div>
    </Link>
  );
}

function EnrolledRow({ course }: { course: Course }) {
  const expert = expertsById[course.expertId];
  const percent = Math.round(course.progress * 100);
  const firstLesson = course.modules?.[0]?.lessons?.[0];
  const linkProps = firstLesson
    ? {
        to: "/academia/$courseId/$lessonId" as const,
        params: { courseId: course.id, lessonId: firstLesson.id },
      }
    : { to: "/academia/$courseId" as const, params: { courseId: course.id } };

  return (
    <Link
      {...linkProps}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-4 transition hover:border-[color:var(--hairline)] hover:bg-surface-2 md:flex-row md:items-center md:gap-6 md:px-6"
    >
      {/* Cover */}
      <div
        className="aspect-[16/9] w-full shrink-0 overflow-hidden rounded-xl md:h-16 md:w-24 md:aspect-auto"
        style={{ background: course.cover }}
      >
        <div className="h-full w-full bg-linear-to-tr from-black/60 to-transparent" />
      </div>

      {/* Title + mentor */}
      <div className="min-w-0 md:w-56">
        <p className="truncate font-display text-base text-foreground">{course.title}</p>
        {expert && (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full text-[9px] font-semibold text-white"
              style={expert.logo ? { background: "#000" } : { background: expert.photo }}
              aria-hidden
            >
              {expert.logo ? (
                <img src={expert.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                expert.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
              )}
            </span>
            <span className="truncate">
              Especialista: <span className="text-foreground">{expert.name}</span>
            </span>
          </div>
        )}
      </div>

      {/* Duration */}
      <div className="hidden md:block md:w-24">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Duração
        </p>
        <p className="mt-0.5 text-sm text-foreground">{course.duration}</p>
      </div>

      {/* Progress */}
      <div className="flex-1">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">{percent}%</span>
          <span className="text-muted-foreground">
            {percent === 100 ? "Concluído" : percent > 0 ? "Em curso" : "Por começar"}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-linear-to-r from-primary to-violet"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground md:gap-6">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {50 + Math.round(course.lessonsCount * 3)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          {course.modules?.length ?? 0}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5" />
          {course.lessonsCount}
        </span>
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

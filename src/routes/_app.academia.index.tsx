import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Search, ChevronDown, Lock, Clock, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { courses as allCourses, formatCourseRelease } from "@/data/courses";
import { useCourseAccess } from "@/hooks/use-course-release";
import { useAdminOverridesVersion } from "@/hooks/use-admin-overrides";
import { expertsById } from "@/data/experts";
import { objectives } from "@/data/objectives";
import type { Course } from "@/data/types";
import { useUserProgress, type ProgressByCourse } from "@/hooks/use-user-progress";
import { useBunnyThumb } from "@/hooks/use-bunny-thumb";
import { courseCoverBackground } from "@/lib/course-cover";
import { computeCourseDuration, computeLessonsCount, findLesson, lessonThumb, parseDurationToMinutes, formatMinutes } from "@/lib/course-duration";
import { CardGridSkeleton, RailSkeleton } from "@/components/mm/skeletons";
import { NextStepCard } from "@/components/mm/next-step-card";
import { Skeleton } from "@/components/ui/skeleton";
import { trackUx } from "@/lib/ux-analytics";


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

function firstLessonOf(course: Course) {
  return course.modules?.[0]?.lessons?.[0] ?? null;
}

function resumeLessonOf(course: Course, progress: ProgressByCourse) {
  const p = progress[course.id];
  const last = p?.lastLessonId ? findLesson(course, p.lastLessonId) : null;
  return last ?? firstLessonOf(course);
}

function AcademiaPage() {
  const { progress, loaded } = useUserProgress();
  useAdminOverridesVersion();
  const { canOpen } = useCourseAccess();
  const liveCourses = useMemo(() => allCourses.filter((c) => canOpen(c)), [canOpen]);
  const upcomingCourses = useMemo(() => allCourses.filter((c) => !canOpen(c)), [canOpen]);

  const { continuing, enrolled, featured } = useMemo(() => {
    const enrolled = liveCourses.map((c) => ({
      ...c,
      progress: progress[c.id]?.progress ?? 0,
    }));
    const continuing = enrolled
      .filter((c) => c.progress > 0 && c.progress < 1)
      .sort((a, b) => {
        const ta = progress[a.id]?.lastWatchedAt ?? "";
        const tb = progress[b.id]?.lastWatchedAt ?? "";
        return tb.localeCompare(ta);
      });
    return { continuing, enrolled, featured: continuing[0] ?? enrolled[0] };
  }, [progress, liveCourses]);

  // Pesquisa e filtro do catálogo (local, sem pedidos ao servidor).
  const [query, setQuery] = useState("");
  const [objective, setObjective] = useState<string>("all");

  const catalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...enrolled, ...upcomingCourses.map((c) => ({ ...c, progress: 0 }))];
    return all.filter((c) => {
      if (objective !== "all" && c.objectiveId !== objective) return false;
      if (!q) return true;
      const expert = expertsById[c.expertId];
      return [c.title, c.tagline, c.description, expert?.name, expert?.role]
        .filter(Boolean)
        .some((field) => (field as string).toLowerCase().includes(q));
    });
  }, [enrolled, upcomingCourses, query, objective]);

  // Métrica anónima: saber se a pesquisa é usada e se devolve resultados.
  const searchTracked = useRef<number | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    if (searchTracked.current) clearTimeout(searchTracked.current);
    searchTracked.current = window.setTimeout(() => {
      trackUx("search_used", {
        surface: "academia",
        reason: catalog.length === 0 ? "no_results" : "results",
      });
    }, 900);
    return () => {
      if (searchTracked.current) clearTimeout(searchTracked.current);
    };
  }, [query, catalog.length]);

  const isFiltering = query.trim().length > 0 || objective !== "all";


  // Wait for real progress before painting hero/cards, so covers and
  // "continua onde ficaste" never flash the wrong state.
  if (!loaded) return <AcademiaSkeleton />;



  return (
    <div className="section-stack max-w-full overflow-x-clip">
      <NextStepCard />

      {featured && <FeaturedHero course={featured} progress={progress} />}


      {continuing.length > 0 && (
        <section className="space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-1">
            <div>
              <p className="type-eyebrow text-primary">
                A tua jornada
              </p>
              <h2 className="type-section mt-1.5 text-foreground">
                Continua onde ficaste.
              </h2>
            </div>
          </div>
          <div className="scrollbar-none -mx-1 flex gap-5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {continuing.map((c) => (
              <PosterCard key={c.id} course={c} progress={progress} showResumeThumb />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 px-1 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="type-eyebrow text-primary">
              Academia MM
            </p>
            <h2 className="type-section mt-1.5 text-foreground">
              O catálogo completo.
            </h2>
            <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">
              Streaming premium de conhecimento — todos os cursos, sem ruído.
            </p>
            <Link
              to="/academia/pesquisa"
              search={{ q: "" }}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface-1 px-4 py-2 text-xs font-medium text-foreground ring-1 ring-border transition hover:ring-primary"
            >
              <Search className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Procurar dentro das aulas
            </Link>
          </div>


          <div className="flex min-w-0 items-center gap-3">
            <label className="flex h-11 w-full min-w-0 items-center gap-2 rounded-full border border-border bg-surface-1 px-4 md:w-[260px]">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Procurar curso</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Procurar curso..."
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpar pesquisa"
                  className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <div className="relative hidden md:block">
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                aria-label="Filtrar por objetivo"
                className="h-11 appearance-none rounded-full border border-border bg-surface-1 pl-4 pr-10 text-sm text-foreground outline-none transition hover:border-[color:var(--hairline)]"
              >
                <option value="all">Todos</option>
                {objectives.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        </div>

        {catalog.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-1 px-6 py-14 text-center">
            <Search className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm text-foreground">Nenhum curso corresponde à tua procura.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tenta outras palavras ou vê o catálogo completo.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setObjective("all");
              }}
              className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft"
            >
              Ver todos os cursos
            </button>
          </div>
        ) : (
          <>
            {isFiltering && (
              <p className="px-1 text-xs text-muted-foreground" aria-live="polite">
                {catalog.length} {catalog.length === 1 ? "curso" : "cursos"}
              </p>
            )}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {catalog.map((c) =>
                canOpen(c) ? (
                  <PosterCard key={c.id} course={c} progress={progress} inGrid />
                ) : (
                  <ComingSoonCard key={c.id} course={c} />
                ),
              )}
            </div>
          </>
        )}

      </section>

    </div>
  );
}

function FeaturedHero({
  course,
  progress,
}: {
  course: Course;
  progress: ProgressByCourse;
}) {
  const expert = expertsById[course.expertId];
  const resumeLesson = resumeLessonOf(course, progress);
  const linkProps = resumeLesson
    ? {
        to: "/academia/$courseId/$lessonId" as const,
        params: { courseId: course.id, lessonId: resumeLesson.id },
      }
    : { to: "/academia/$courseId" as const, params: { courseId: course.id } };
  const courseProgress = progress[course.id];
  // Per-lesson real progress: watched seconds / lesson duration seconds
  const lessonDurationMin = resumeLesson ? parseDurationToMinutes(resumeLesson.duration) : 0;
  const lessonDurationSec = lessonDurationMin * 60;
  const watchedSec = resumeLesson
    ? courseProgress?.watchedSeconds.get(resumeLesson.id) ?? 0
    : 0;
  const isLessonCompleted = resumeLesson
    ? courseProgress?.completedLessons.has(resumeLesson.id) ?? false
    : false;
  const lessonPercent = isLessonCompleted
    ? 100
    : lessonDurationSec > 0
      ? Math.min(100, Math.round((watchedSec / lessonDurationSec) * 100))
      : 0;
  const started = watchedSec > 0 || isLessonCompleted || (course.progress ?? 0) > 0;
  const lessonDurationLabel = lessonDurationMin > 0 ? formatMinutes(lessonDurationMin) : resumeLesson?.duration || "";
  // For "continua a assistir", prefer the lesson thumbnail — that's what the user
  // was actually watching. Try sync resolution first (YouTube / Bunny CDN URL /
  // Bunny iframe when VITE_BUNNY_PULL_ZONE is set), then fall back to Bunny
  // OEmbed for iframe embeds we can't resolve locally.
  const syncThumb = started ? lessonThumb(resumeLesson, course) : null;
  const { thumb: oembedThumb } = useBunnyThumb(
    started && !syncThumb ? resumeLesson?.videoUrl : null,
  );
  const thumb = syncThumb ?? oembedThumb;
  const heroBackground = thumb
    ? `url(${thumb}) center/cover no-repeat, #000`
    : courseCoverBackground(course);

  return (
    <Link
      {...linkProps}
      className="group surface-card relative flex flex-col overflow-hidden md:flex-row md:items-stretch"
    >
      {/* Cover — compact left panel on desktop, short banner on mobile */}
      <div
        className="relative aspect-[16/9] w-full shrink-0 overflow-hidden md:h-auto md:w-[44%] lg:w-[40%]"
        style={{ background: heroBackground }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent md:bg-gradient-to-r md:from-transparent md:to-background/30" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 transition group-hover:scale-110 group-hover:bg-gold-soft">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </div>
        {started && (
          <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
            <div className="h-1 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${lessonPercent}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Text — right panel */}
      <div className="flex flex-1 flex-col justify-center gap-3 px-5 py-5 md:gap-4 md:px-8 md:py-7">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.3em] text-primary">
            {started ? "Continua a assistir" : "Destaque"}
          </p>
          <h1 className="mt-2 font-display text-2xl leading-[1.05] tracking-tight text-foreground md:text-4xl">
            {course.title}
          </h1>
          {resumeLesson ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Aula: <span className="text-foreground">{resumeLesson.title}</span>
            </p>
          ) : course.tagline ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {course.tagline}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition group-hover:bg-gold-soft">
            <Play className="h-4 w-4 fill-current" />
            {started ? "Continuar" : "Começar agora"}
          </span>
          {expert && (
            <div className="flex items-center gap-2.5">
              <div
                className="h-9 w-9 shrink-0 rounded-full ring-1 ring-hairline"
                style={
                  expert.logo
                    ? {
                        backgroundImage: `url(${expert.logo})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : { background: expert.photo }
                }
              />
              <div className="text-xs">
                <p className="font-medium text-foreground">{expert.name}</p>
                <p className="text-muted-foreground">{expert.role}</p>
              </div>
            </div>
          )}
          {lessonDurationLabel && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {lessonDurationLabel}
            </span>
          )}
        </div>

        {started && (
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {lessonPercent}% desta aula
          </p>
        )}
      </div>
    </Link>
  );
}

function PosterCard({
  course,
  progress,
  inGrid,
  showResumeThumb,
}: {
  course: Course;
  progress: ProgressByCourse;
  inGrid?: boolean;
  showResumeThumb?: boolean;
}) {
  const expert = expertsById[course.expertId];
  const percent = Math.round(course.progress * 100);
  const resumeLesson = resumeLessonOf(course, progress);
  const linkProps =
    resumeLesson && percent > 0
      ? {
          to: "/academia/$courseId/$lessonId" as const,
          params: { courseId: course.id, lessonId: resumeLesson.id },
        }
      : { to: "/academia/$courseId" as const, params: { courseId: course.id } };
  const totalDuration = computeCourseDuration(course);
  const lessonsCount = computeLessonsCount(course);
  // Catalog cards always show the COURSE cover. Cards in "Continua onde
  // ficaste" show the frame of the lesson the member stopped at.
  const syncThumb = showResumeThumb && percent > 0 ? lessonThumb(resumeLesson, course) : null;
  const { thumb: oembedThumb } = useBunnyThumb(
    showResumeThumb && percent > 0 && !syncThumb ? resumeLesson?.videoUrl : null,
  );
  const resumeThumb = syncThumb ?? oembedThumb;
  const posterBackground = resumeThumb
    ? `url(${resumeThumb}) center/cover no-repeat, #000`
    : courseCoverBackground(course);


  return (
    <Link
      {...linkProps}
      className={
        (inGrid ? "" : "w-[min(82vw,320px)] shrink-0 ") +
        "group relative flex flex-col overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border transition-all duration-500 hover:-translate-y-1 hover:ring-[color:var(--hairline)] hover:shadow-[0_28px_80px_-30px_oklch(0.82_0.13_82_/_0.35)]"
      }
    >
      <div
        className="relative aspect-[16/10] overflow-hidden"
        style={{ background: posterBackground }}
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
          {totalDuration}
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
        <h3 className="type-card text-foreground line-clamp-2">
          {course.title}
        </h3>
        {percent > 0 && resumeLesson ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            Continuar em:{" "}
            <span className="text-foreground">{resumeLesson.title}</span>
          </p>
        ) : expert ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            <span className="text-foreground">{expert.name}</span>
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            {expert.role}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Play className="h-3 w-3" />
            {lessonsCount} aulas
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
    <Link
      to="/academia/$courseId"
      params={{ courseId: course.id }}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border transition-all duration-500 hover:-translate-y-1 hover:ring-[color:var(--hairline)]"
    >
      <div className="aspect-[16/9]" style={{ background: courseCoverBackground(course) }}>
        <div className="h-full w-full bg-linear-to-t from-black/70 to-transparent" />
      </div>
      <div className="flex flex-col gap-2 p-5">
        <div className="inline-flex w-max items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
          <Lock className="h-3 w-3" /> Em breve
        </div>
        <h3 className="font-display text-lg leading-tight text-foreground">
          {course.title}
        </h3>
        {course.releaseAt && (
          <p className="inline-flex items-center gap-1.5 text-xs text-primary">
            <Clock className="h-3 w-3" /> Disponível a {formatCourseRelease(course)}
          </p>
        )}
        {expert && (
          <p className="text-xs text-muted-foreground">
            Especialista: <span className="text-foreground">{expert.name}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
      </div>
    </Link>
  );
}

function AcademiaSkeleton() {
  return (
    <div className="section-stack max-w-full overflow-x-clip">
      <RailSkeleton cards={3} cardClassName="w-[300px] shrink-0" />
      <section className="space-y-5">
        <div className="space-y-2.5 px-1">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <CardGridSkeleton cards={8} />
      </section>
    </div>
  );
}

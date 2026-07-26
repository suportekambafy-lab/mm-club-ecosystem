import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, Clock, Play } from "lucide-react";
import { coursesById } from "@/data/courses";
import "@/data/admin-store";
import { useAdminOverridesVersion } from "@/hooks/use-admin-overrides";
import { expertsById } from "@/data/experts";
import { ExpertAvatar } from "@/components/mm/expert-avatar";
import type { Course, Lesson, Module } from "@/data/types";
import { useUserProgress } from "@/hooks/use-user-progress";
import { courseCoverBackground } from "@/lib/course-cover";
import { computeCourseDuration, computeLessonsCount, findLesson, lessonThumb } from "@/lib/course-duration";
import { useBunnyThumb } from "@/hooks/use-bunny-thumb";
import { Skeleton } from "@/components/ui/skeleton";


export const Route = createFileRoute("/_app/academia/$courseId/")({
  loader: ({ params }) => {
    if (!coursesById[params.courseId]) throw notFound();
    return { courseId: params.courseId };
  },
  head: () => ({ meta: [{ title: "Curso — MM Club" }] }),
  component: CourseDetail,
});

function CourseDetail() {
  const { courseId } = Route.useLoaderData();
  useAdminOverridesVersion(); // re-render when admin overrides change
  const course = coursesById[courseId];
  const expert = expertsById[course.expertId];
  const { progress, loaded } = useUserProgress();
  const p = progress[course.id];

  const percent = Math.round((p?.progress ?? 0) * 100);
  const resumeLesson =
    (p?.lastLessonId ? findLesson(course, p.lastLessonId) : null) ??
    course.modules?.[0]?.lessons?.[0] ??
    null;
  const firstLesson = resumeLesson;
  const totalDuration = computeCourseDuration(course);
  const totalLessons = computeLessonsCount(course);
  const heroSyncThumb = lessonThumb(firstLesson, course);
  const { thumb: heroOembedThumb } = useBunnyThumb(heroSyncThumb ? null : firstLesson?.videoUrl);
  const heroThumb = heroSyncThumb ?? heroOembedThumb;
  const heroBg = heroThumb
    ? `url(${heroThumb}) center/cover no-repeat, #000`
    : courseCoverBackground(course);



  if (!loaded) return <CourseDetailSkeleton />;

  return (
    <div className="max-w-full space-y-10 overflow-x-clip">
      <Link
        to="/academia"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Academia
      </Link>

      <section className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        {firstLesson ? (
          <Link
            to="/academia/$courseId/$lessonId"
            params={{ courseId: course.id, lessonId: firstLesson.id }}
            aria-label={percent > 0 ? "Continuar aula" : "Reproduzir primeira aula"}
            className="group relative aspect-video overflow-hidden rounded-2xl ring-1 ring-border"
            style={{ background: heroBg }}

          >
            <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/10 to-transparent" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-2xl shadow-primary/30 transition group-hover:bg-gold-soft">
                <Play className="h-6 w-6 fill-primary-foreground text-primary-foreground" />
              </span>
            </span>
          </Link>
        ) : (
          <div
            className="relative aspect-video overflow-hidden rounded-2xl ring-1 ring-border"
            style={{ background: courseCoverBackground(course) }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/10 to-transparent" />
          </div>
        )}


        <div className="flex min-w-0 flex-col gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
              Curso · MM Club
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight text-foreground md:text-4xl">
              {course.title}
            </h1>
            {expert && (
              <p className="mt-2 text-sm text-muted-foreground">
                Especialista: <span className="text-foreground">{expert.name}</span>
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">{course.tagline}</p>
          </div>

          {expert && (
            <div className="rounded-xl bg-surface-1 p-4 ring-1 ring-border">
              <ExpertAvatar expert={expert} size="lg" showName showRole />
              <p className="mt-3 text-xs text-muted-foreground">{expert.shortBio}</p>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {totalDuration}
            </span>
            <span>·</span>
            <span>{totalLessons} aulas</span>
          </div>

          {firstLesson && (
            <Link
              to="/academia/$courseId/$lessonId"
              params={{ courseId: course.id, lessonId: firstLesson.id }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft"
            >
              <Play className="h-4 w-4 fill-current" />
              {percent > 0 ? "Continuar" : "Começar curso"}
            </Link>
          )}

          {percent > 0 && (
            <div>
              <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">
                  Progresso
                  {resumeLesson && (
                    <span className="ml-2 text-foreground/80">
                      · Próxima: {resumeLesson.title}
                    </span>
                  )}
                </span>
                <span className="text-primary">{percent}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}

        </div>
      </section>

      <section className="max-w-3xl">
        <h2 className="font-display text-xl text-foreground">Sobre este curso</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {course.description}
        </p>
      </section>

      {course.modules && course.modules.length > 0 && (
        <section className="space-y-5">
          <h2 className="font-display text-xl text-foreground">Conteúdo do curso</h2>
          <div className="space-y-3">
            {course.modules.map((m: Module, mi: number) => (
              <div key={m.id} className="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-border">
                <div className="border-b border-border px-4 py-4 sm:px-5">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-primary">
                      Módulo {String(mi + 1).padStart(2, "0")}
                    </span>
                    <h3 className="truncate font-display text-base text-foreground">{m.title}</h3>
                  </div>
                </div>
                <ul>
                  {m.lessons.map((l: Lesson, li: number) => (
                    <CourseLessonRow
                      key={l.id}
                      lesson={l}
                      course={course}
                      index={li}
                    />
                  ))}

                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CourseLessonRow({
  lesson,
  course,
  index,
}: {
  lesson: Lesson;
  course: Course;
  index: number;
}) {
  const syncThumb = lessonThumb(lesson, course);
  const { thumb: oembedThumb } = useBunnyThumb(syncThumb ? null : lesson.videoUrl);
  const thumb = syncThumb ?? oembedThumb;

  return (
    <li>
      <Link
        to="/academia/$courseId/$lessonId"
        params={{ courseId: course.id, lessonId: lesson.id }}
        className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/50 px-4 py-3 transition last:border-b-0 hover:bg-surface-2 sm:gap-4 sm:px-5"
      >
        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-border sm:h-16 sm:w-28">
          {thumb ? (
            <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: courseCoverBackground(course) }} />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
            <Play className="h-4 w-4 fill-white text-white" />
          </span>
          {lesson.completed && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">
            {String(index + 1).padStart(2, "0")}. {lesson.title}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{lesson.duration}</span>
      </Link>
    </li>
  );
}
function CourseDetailSkeleton() {
  return (
    <div className="max-w-full space-y-10 overflow-x-clip">
      <Skeleton className="h-4 w-24" />
      <section className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex items-center gap-3 pt-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          <Skeleton className="h-1 w-full rounded-full" />
          <Skeleton className="h-11 w-40 rounded-full" />
        </div>
      </section>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl bg-surface-1 p-4 ring-1 ring-border">
            <Skeleton className="h-16 w-28 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

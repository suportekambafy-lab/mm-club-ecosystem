import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronDown, Clock, Lock, Play } from "lucide-react";
import { coursesById, formatCourseRelease } from "@/data/courses";
import { useCourseAccess } from "@/hooks/use-course-release";
import "@/data/admin-store";
import { useAdminOverridesVersion } from "@/hooks/use-admin-overrides";
import { expertsById } from "@/data/experts";
import { ExpertAvatar } from "@/components/mm/expert-avatar";
import type { Course, Lesson, Module } from "@/data/types";
import { useUserProgress } from "@/hooks/use-user-progress";
import { courseCoverBackground } from "@/lib/course-cover";
import { computeCourseDuration, computeLessonsCount, findLesson, lessonThumb, parseDurationToMinutes } from "@/lib/course-duration";
import { CourseCertificate } from "@/components/mm/course-certificate";
import { useBunnyThumb } from "@/hooks/use-bunny-thumb";
import { Skeleton } from "@/components/ui/skeleton";
import { ReleaseCountdown } from "@/components/mm/release-countdown";
import { CourseComments } from "@/components/mm/course-comments";
import { ModuleQuiz } from "@/components/mm/module-quiz";
import { ChallengeLivesModule } from "@/components/mm/challenge-lives-module";
import { isFeaturedCourse } from "@/lib/course-order";

import { useCourseQuiz, lockedModuleIds } from "@/hooks/use-course-quiz";
import type { QuizModuleState } from "@/lib/quiz.functions";



export const Route = createFileRoute("/_app/academia/$courseId/")({
  validateSearch: (search: Record<string, unknown>): { quiz?: string } => {
    const quiz = typeof search.quiz === "string" && search.quiz ? search.quiz : undefined;
    return quiz ? { quiz } : {};
  },
  loader: ({ params }) => {
    if (!coursesById[params.courseId]) throw notFound();
    return { courseId: params.courseId };
  },
  head: () => ({ meta: [{ title: "Curso — MM Club" }] }),
  component: CourseDetail,
});

function CourseDetail() {
  const { courseId } = Route.useLoaderData();
  const { quiz: focusQuizModuleId } = Route.useSearch();
  useAdminOverridesVersion(); // re-render when admin overrides change
  const course = coursesById[courseId];
  const expert = expertsById[course.expertId];
  const { progress, loaded } = useUserProgress();
  const { canOpen } = useCourseAccess();
  const p = progress[course.id];
  const quiz = useCourseQuiz(course.id);
  const { locked, blockedBy } = lockedModuleIds(
    (course.modules ?? []).map((m: Module) => m.id),
    quiz,
  );

  const percent = Math.round((p?.progress ?? 0) * 100);
  const resumeLesson =
    (p?.lastLessonId ? findLesson(course, p.lastLessonId) : null) ??
    course.modules?.[0]?.lessons?.[0] ??
    null;
  const firstLesson = resumeLesson;
  const resumeLessonModuleId =
    resumeLesson
      ? (course.modules?.find((m) => m.lessons.some((l) => l.id === resumeLesson.id))?.id ?? null)
      : null;
  const totalDuration = computeCourseDuration(course);
  const totalLessons = computeLessonsCount(course);
  const heroSyncThumb = lessonThumb(firstLesson, course);
  const { thumb: heroOembedThumb } = useBunnyThumb(heroSyncThumb ? null : firstLesson?.videoUrl);
  const heroThumb = heroSyncThumb ?? heroOembedThumb;
  const heroBg = heroThumb
    ? `url(${heroThumb}) center/cover no-repeat, #000`
    : courseCoverBackground(course);



  if (!loaded) return <CourseDetailSkeleton />;

  if (!canOpen(course)) {
    return (
      <div className="max-w-full space-y-8 overflow-x-clip">
        <Link
          to="/academia"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Academia
        </Link>
        <div className="overflow-hidden rounded-3xl ring-1 ring-border">
          <div className="aspect-[16/7]" style={{ background: courseCoverBackground(course) }}>
            <div className="h-full w-full bg-linear-to-t from-black/80 to-transparent" />
          </div>
          <div className="space-y-3 bg-surface-1 p-6 md:p-8">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
              <Lock className="h-3 w-3" /> Em breve
            </div>
            <h1 className="font-display text-2xl text-foreground md:text-3xl">{course.title}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{course.description}</p>
            <p className="inline-flex items-center gap-1.5 text-sm text-primary">
              <Clock className="h-4 w-4" /> Disponível a {formatCourseRelease(course)}
            </p>
            {course.releaseAt && (
              <ReleaseCountdown releaseAt={course.releaseAt} className="pt-2" />
            )}

          </div>
        </div>
        <CourseComments courseId={course.id} />
      </div>
    );
  }


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

          <CourseCertificate
            courseId={course.id}
            courseTitle={course.title}
            hours={Math.round((parseDurationToMinutes(totalDuration) / 60) * 10) / 10}
            lessonsTotal={totalLessons}
            lessonsDone={p?.completedLessons?.size ?? 0}
            completed={percent >= 100}
          />

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
              <ModuleAccordion
                key={m.id}
                module={m}
                index={mi}
                course={course}
                locked={locked.has(m.id)}
                blocker={blockedBy[m.id] ?? null}
                quizState={quiz.modules[m.id]}
                completedLessons={p?.completedLessons}
                defaultOpen={focusQuizModuleId === m.id || resumeLessonModuleId === m.id || mi === 0}
                autoOpenQuiz={focusQuizModuleId === m.id}
                onQuizPassed={quiz.refetch}
              />
            ))}
            {isFeaturedCourse(course) && (
              <ChallengeLivesModule index={course.modules.length} courseId={course.id} />
            )}
          </div>
        </section>
      )}


      <CourseComments courseId={course.id} />
    </div>

  );
}

function ModuleAccordion({
  module,
  index,
  course,
  locked,
  blocker,
  quizState,
  completedLessons,
  defaultOpen,
  autoOpenQuiz,
  onQuizPassed,
}: {
  module: Module;
  index: number;
  course: Course;
  locked: boolean;
  blocker: string | null;
  quizState: QuizModuleState | undefined;
  completedLessons: Set<string> | undefined;
  defaultOpen: boolean;
  autoOpenQuiz: boolean;
  onQuizPassed: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const blockerTitle = blocker
    ? (course.modules?.find((x: Module) => x.id === blocker)?.title ?? "anterior")
    : null;
  const completedCount =
    module.lessons.length > 0
      ? module.lessons.filter((l: Lesson) => completedLessons?.has(l.id) || l.completed).length
      : 0;
  const pendingLessons = module.lessons
    .filter((l: Lesson) => !(completedLessons?.has(l.id) || l.completed))
    .map((l: Lesson) => ({ id: l.id, title: l.title }));
  const moduleDone = module.lessons.length > 0 && pendingLessons.length === 0;

  return (
    <div className="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-border px-4 py-4 text-left transition hover:bg-surface-2/50 sm:px-5"
        aria-expanded={open}
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
        {module.cover && (
          <span
            aria-hidden
            className="h-10 w-16 shrink-0 rounded-lg border border-border bg-surface-2 bg-cover bg-center"
            style={{
              background: /^(https?:|\/|data:|blob:)/.test(module.cover.trim())
                ? `url("${module.cover.trim()}") center/cover no-repeat`
                : module.cover,
              backgroundSize: "cover",
            }}
          />
        )}

        <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-primary">
            Módulo {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="truncate font-display text-base text-foreground">{module.title}</h3>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {completedCount}/{module.lessons.length}
        </span>
        {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </button>

      {locked && (
        <p className="px-4 py-2 text-xs text-muted-foreground sm:px-5">
          <Lock className="mr-1.5 inline h-3 w-3" /> Conclui o teste do módulo “{blockerTitle}” para
          desbloquear
        </p>
      )}

      {open && (
        <>
          <ul>
            {module.lessons.map((l: Lesson, li: number) => (
              <CourseLessonRow
                key={l.id}
                lesson={l}
                course={course}
                index={li}
                locked={locked}
              />
            ))}
          </ul>
          {!locked && (
            <ModuleQuiz
              courseId={course.id}
              moduleId={module.id}
              moduleTitle={module.title}
              state={quizState}
              moduleLessonsCompleted={moduleDone}
              pendingLessons={pendingLessons}
              totalLessons={module.lessons.length}
              completedLessonsCount={completedCount}
              autoOpen={autoOpenQuiz}
              onPassed={onQuizPassed}
            />
          )}
        </>
      )}
    </div>
  );
}

function CourseLessonRow({
  lesson,
  course,
  index,
  locked,
}: {
  lesson: Lesson;
  course: Course;
  index: number;
  locked?: boolean;
}) {
  const syncThumb = lessonThumb(lesson, course);
  const { thumb: oembedThumb } = useBunnyThumb(syncThumb ? null : lesson.videoUrl);
  const thumb = syncThumb ?? oembedThumb;

  const inner = (
    <>
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-border sm:h-16 sm:w-28">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: courseCoverBackground(course) }} />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
          {locked ? (
            <Lock className="h-4 w-4 text-white" />
          ) : (
            <Play className="h-4 w-4 fill-white text-white" />
          )}
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
      <span className="shrink-0 text-xs text-muted-foreground">
        {locked ? <Lock className="h-3.5 w-3.5" /> : lesson.duration}
      </span>
    </>
  );

  const rowClass =
    "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/50 px-4 py-3 transition last:border-b-0 sm:gap-4 sm:px-5";

  if (locked) {
    return (
      <li>
        <div
          aria-disabled
          title="Bloqueado até aprovares o teste do módulo anterior"
          className={`${rowClass} cursor-not-allowed opacity-50`}
        >
          {inner}
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        to="/academia/$courseId/$lessonId"
        params={{ courseId: course.id, lessonId: lesson.id }}
        className={`${rowClass} hover:bg-surface-2`}
      >
        {inner}
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

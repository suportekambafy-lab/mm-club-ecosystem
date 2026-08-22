import { createFileRoute, notFound } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  PlayCircle,
  MessagesSquare,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
} from "lucide-react";
import { VideoWatermark } from "@/components/mm/video-watermark";
import { coursesById } from "@/data/courses";
import "@/data/admin-store";
import { useAdminOverridesVersion } from "@/hooks/use-admin-overrides";
import type { Course, Lesson, Module } from "@/data/types";
import { cn } from "@/lib/utils";
import { parseVideoUrl } from "@/lib/video-source";
import { useLessonProgress } from "@/hooks/use-lesson-progress";
import { lessonThumb } from "@/lib/course-duration";
import { useBunnyThumb } from "@/hooks/use-bunny-thumb";
import { TranscriptProgress } from "@/components/mm/transcript-progress";
import { LessonResources } from "@/components/mm/lesson-resources";
import { LessonNotes } from "@/components/mm/lesson-notes";
import { pingLearningActivity, recordLessonCompleted } from "@/lib/learning-activity";
import { useCourseQuiz, lockedModuleIds } from "@/hooks/use-course-quiz";


export const Route = createFileRoute("/_app/academia/$courseId/$lessonId")({
  validateSearch: (search: Record<string, unknown>): { t?: number } => {
    const t = search.t == null ? undefined : Number(search.t) || undefined;
    return t === undefined ? {} : { t };
  },
  loader: ({ params }) => {
    const course = coursesById[params.courseId];
    if (!course) throw notFound();
    return { courseId: params.courseId, lessonId: params.lessonId };
  },
  head: () => ({ meta: [{ title: "Aula — MM Club" }] }),
  component: LessonPlayer,
});

function LessonPlayer() {
  const { courseId, lessonId } = Route.useLoaderData();
  const { t: deepLinkSeconds } = Route.useSearch();
  const navigate = Route.useNavigate();
  const overridesVersion = useAdminOverridesVersion();

  // Recompute from (possibly-overridden) in-memory data so admin edits show up.
  const data = useMemo(() => {
    const course = coursesById[courseId];
    if (!course || !course.modules) return null;
    const flat: Array<{ lesson: Lesson; module: Module; index: number }> = [];
    let counter = 0;
    for (const m of course.modules) {
      for (const l of m.lessons) flat.push({ lesson: l, module: m, index: counter++ });
    }
    let currentIdx = flat.findIndex((x) => x.lesson.id === lessonId);
    if (currentIdx === -1) currentIdx = 0; // fallback: lesson was deleted
    const current = flat[currentIdx];
    if (!current) return null;
    return { course, current, next: flat[currentIdx + 1] ?? null };
  }, [courseId, lessonId, overridesVersion]);

  // IMPORTANT: All hooks below must run unconditionally to preserve hook order
  // across renders (including when `data` transitions from null → value).
  const currentLessonId = data?.current.lesson.id ?? "__no_lesson__";
  const courseIdForProgress = data?.course.id ?? "__no_course__";
  const videoUrl = data?.current.lesson.videoUrl ?? "";
  const source = videoUrl ? parseVideoUrl(videoUrl) : null;
  const { row, completed, saving, loaded, saveProgress, setCompleted } = useLessonProgress(
    courseIdForProgress,
    currentLessonId,
  );

  // Cada gravação de progresso conta como atividade do dia (streak/meta semanal).
  const trackedSaveProgress = useCallback<SaveLessonProgress>(
    (seconds, options) => {
      pingLearningActivity();
      return saveProgress(seconds, options);
    },
    [saveProgress],
  );

  const toggleCompleted = useCallback(() => {
    const next = !completed;
    void setCompleted(next);
    if (next) recordLessonCompleted();
  }, [completed, setCompleted]);

  // Controlo directo do player (usado pelas notas para voltar ao minuto).
  const seekRef = useRef<((seconds: number) => void) | null>(null);

  // Bloqueio sequencial: se o módulo desta aula está trancado por um teste
  // não aprovado, volta à página do curso já com o teste em foco.
  const quiz = useCourseQuiz(courseIdForProgress);
  const { locked: lockedModules, blockedBy } = lockedModuleIds(
    (coursesById[courseId]?.modules ?? []).map((m: Module) => m.id),
    quiz,
  );
  const currentModuleId = data?.current.module.id;
  const moduleLocked = Boolean(currentModuleId && lockedModules.has(currentModuleId));
  const blockerModuleId = currentModuleId ? blockedBy[currentModuleId] : undefined;
  useEffect(() => {
    if (!moduleLocked) return;
    void navigate({
      to: "/academia/$courseId",
      params: { courseId },
      search: blockerModuleId ? { quiz: blockerModuleId } : {},
      replace: true,
    });
  }, [moduleLocked, navigate, courseId, blockerModuleId]);

  // Última aula do módulo com teste publicado e ainda não aprovado: em vez de
  // saltar para o módulo seguinte (que está trancado), leva ao teste.
  const currentModuleState = currentModuleId ? quiz.modules[currentModuleId] : undefined;
  const nextLesson = data?.next ?? null;
  const isLastOfModule = Boolean(
    currentModuleId && (!nextLesson || nextLesson.module.id !== currentModuleId),
  );
  const quizPending = Boolean(
    !quiz.staff &&
      isLastOfModule &&
      currentModuleState?.published &&
      (currentModuleState?.questionsAvailable ?? 0) > 0 &&
      !currentModuleState?.passed,
  );
  const goToModuleQuiz = useCallback(() => {
    if (!currentModuleId) return;
    void navigate({
      to: "/academia/$courseId",
      params: { courseId },
      search: { quiz: currentModuleId },
    });
  }, [courseId, currentModuleId, navigate]);

  // Reset scroll on lesson change
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [currentLessonId]);

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Curso sem aulas disponíveis.
      </div>
    );
  }

  const { course, current, next } = data;
  const nextBlocked = Boolean(next && lockedModules.has(next.module.id));
  // Aula seguinte disponível de facto (não trancada e sem teste pendente).
  const nextOpen = next && !quizPending && !nextBlocked ? next : null;


  return (
    <div className="-mx-3 -my-4 w-[calc(100%+1.5rem)] max-w-[100vw] touch-pan-y overflow-x-clip bg-background overscroll-x-none sm:-mx-4 sm:-my-6 sm:w-[calc(100%+2rem)] md:-mx-8 md:-my-8 md:w-[calc(100%+4rem)] lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden">
      <div className="mx-auto flex w-full max-w-[1440px] min-w-0 flex-col overflow-x-clip px-3 py-4 overscroll-x-none sm:px-4 sm:py-6 md:px-6 md:py-6 lg:h-full lg:overflow-hidden">

        {/* Breadcrumb bar */}
        <div className="mb-4 flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-border bg-surface-1 px-4 py-2.5 text-sm [scrollbar-width:none] md:mb-6 md:gap-3 md:px-5 md:py-3 [&::-webkit-scrollbar]:hidden">
          <Link
            to="/academia"
            className="shrink-0 text-muted-foreground transition hover:text-foreground"
          >
            Academia
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Link
            to="/academia/$courseId"
            params={{ courseId: course.id }}
            className="shrink-0 text-muted-foreground transition hover:text-foreground"
          >
            {course.title}
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-foreground">{current.lesson.title}</span>
        </div>

        {/* Layout: modules sidebar + main content */}
        <div className="grid min-w-0 gap-4 md:gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(280px,330px)_minmax(0,1fr)]">
          {/* Modules sidebar — scrollable independently on desktop; below content on mobile */}
          <aside className="order-2 flex min-h-0 min-w-0 flex-col rounded-2xl border border-border bg-surface-1 p-3 sm:p-4 md:rounded-3xl md:p-5 lg:order-1">
            <p className="mb-4 shrink-0 font-display text-lg text-foreground">Módulos</p>
            <div className="space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
              {course.modules!.map((m: Module, mi: number) => (
                <ModuleAccordion
                  key={m.id}
                  module={m}
                  course={course}
                  courseId={course.id}
                  currentLessonId={current.lesson.id}
                  locked={lockedModules.has(m.id)}
                  defaultOpen={mi < 2 || m.lessons.some((l: Lesson) => l.id === current.lesson.id)}
                />
              ))}
            </div>
          </aside>

          {/* Main content: video + title/cta */}
          <div className="order-1 flex min-h-0 min-w-0 flex-col gap-3 sm:gap-4 md:gap-6 lg:order-2 lg:overflow-y-auto lg:pr-1">
            {/* Video player */}
            {!source ? (
              <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-black md:rounded-3xl">
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/60">
                  Vídeo desta aula ainda não está disponível.
                </div>
              </div>
            ) : loaded ? (
              <TrackedVideoPlayer
                lessonId={current.lesson.id}
                title={current.lesson.title}
                source={source}
                startSeconds={
                  // Aula já concluída recomeça do início: guardar a posição final
                  // fazia o vídeo abrir nos últimos segundos e disparar logo o
                  // "fim de aula" (o que saltava 2–3 aulas de seguida).
                  deepLinkSeconds ?? (completed ? 0 : (row?.progress_seconds ?? 0))
                }
                saveProgress={trackedSaveProgress}
                seekRef={seekRef}
                nextTitle={
                  quizPending
                    ? `Teste do módulo · ${current.module.title}`
                    : (nextOpen?.lesson.title ?? null)
                }
                onAdvance={
                  quizPending
                    ? goToModuleQuiz
                    : nextOpen
                      ? () =>
                          navigate({
                            to: "/academia/$courseId/$lessonId",
                            params: { courseId: course.id, lessonId: nextOpen.lesson.id },
                          })
                      : undefined
                }
                advanceLabel={quizPending ? "Fazer teste" : undefined}
              />

            ) : (
              <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-black md:rounded-3xl">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white/60" />
                </div>
              </div>
            )}

            <TranscriptProgress courseId={course.id} lessonId={current.lesson.id} />



            {/* Title + CTA */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-surface-2 px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-3">
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-sm text-foreground sm:text-base md:text-lg">
                  {current.lesson.title}
                </h1>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
                  <span className="truncate">{current.module.title}</span>
                  <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span className="shrink-0">Aula {current.index + 1}</span>
                </div>
              </div>

              <div className="flex min-w-0 shrink-0 items-center gap-1 overflow-x-auto pl-1 [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={toggleCompleted}
                  disabled={saving}
                  aria-label={completed ? "Marcar como não concluída" : "Marcar como concluída"}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition sm:px-3",
                    completed
                      ? "bg-primary/15 text-primary ring-1 ring-primary/40 hover:bg-primary/20"
                      : "bg-surface-3 text-foreground hover:bg-surface-3/80",
                    saving && "opacity-60",
                  )}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : completed ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden whitespace-nowrap sm:inline">
                    {completed ? "Concluída" : "Marcar concluída"}
                  </span>
                </button>
                <Link
                  to="/comunidade"
                  aria-label="Sala de discussão"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface-3 px-2.5 text-xs font-medium text-foreground transition hover:bg-surface-3/80 sm:px-3"
                >
                  <MessagesSquare className="h-3.5 w-3.5" />
                  <span className="hidden whitespace-nowrap sm:inline">Sala de discussão</span>
                </Link>

                {quizPending ? (
                  <Link
                    to="/academia/$courseId"
                    params={{ courseId: course.id }}
                    search={{ quiz: current.module.id }}
                    aria-label="Fazer o teste do módulo"
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-foreground transition hover:bg-gold-soft sm:px-4"
                  >
                    <span className="hidden whitespace-nowrap sm:inline">Teste do módulo</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : nextOpen ? (
                  <Link
                    to="/academia/$courseId/$lessonId"
                    params={{ courseId: course.id, lessonId: nextOpen.lesson.id }}
                    aria-label="Próxima aula"
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-foreground transition hover:bg-gold-soft sm:px-4"
                  >
                    <span className="hidden whitespace-nowrap sm:inline">Próxima aula</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <Link
                    to="/academia/$courseId"
                    params={{ courseId: course.id }}
                    aria-label="Terminar"
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-foreground transition hover:bg-gold-soft sm:px-4"
                  >
                    <span className="hidden whitespace-nowrap sm:inline">Terminar</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>

            <LessonResources
              description={current.lesson.description}
              links={current.lesson.links}
              materials={current.lesson.materials}
            />

            <LessonNotes
              courseId={course.id}
              lessonId={current.lesson.id}
              currentSeconds={row?.progress_seconds ?? 0}
              onSeek={(seconds) => {
                if (seekRef.current) {
                  seekRef.current(seconds);
                  document
                    .querySelector("main")
                    ?.scrollTo?.({ top: 0, behavior: "smooth" });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  return;
                }
                void navigate({
                  to: "/academia/$courseId/$lessonId",
                  params: { courseId: course.id, lessonId: current.lesson.id },
                  search: { t: seconds },
                });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleAccordion({
  module,
  course,
  courseId,
  currentLessonId,
  defaultOpen,
  locked,
}: {
  module: Module;
  course: Course;
  courseId: string;
  currentLessonId: string;
  defaultOpen: boolean;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = open ? ChevronUp : ChevronDown;

  return (
    <div className={cn("min-w-0 rounded-2xl bg-surface-2 p-3 sm:p-4", locked && "opacity-60")}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full min-w-0 items-start gap-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-snug text-foreground">{module.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {locked && <Lock className="h-3 w-3 shrink-0" />}
            {locked
              ? "Teste do módulo anterior pendente"
              : `${module.lessons.length} ${module.lessons.length === 1 ? "aula" : "aulas"}`}
          </p>
        </div>
        <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <ul className="mt-4 space-y-2.5">
          {module.lessons.map((l) => (
            <LessonRow
              key={l.id}
              lesson={l}
              course={course}
              courseId={courseId}
              active={l.id === currentLessonId}
              locked={locked}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function LessonRow({
  lesson,
  course,
  courseId,
  active,
  locked,
}: {
  lesson: Lesson;
  course: Course;
  courseId: string;
  active: boolean;
  locked?: boolean;
}) {
  const syncThumb = lessonThumb(lesson, course);
  const { thumb: oembedThumb } = useBunnyThumb(syncThumb ? null : lesson.videoUrl);
  const thumb = syncThumb ?? oembedThumb;

  return (
    <li>
      <Link
        to={locked ? "/academia/$courseId" : "/academia/$courseId/$lessonId"}
        params={locked ? ({ courseId } as never) : ({ courseId, lessonId: lesson.id } as never)}
        aria-disabled={locked}
        title={locked ? "Aprova o teste do módulo anterior para desbloquear" : undefined}
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-2xl px-2 py-2 transition sm:px-2.5",
          locked && "pointer-events-none opacity-70",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-surface-3 text-foreground hover:bg-surface-3/70",
        )}
      >
        <div
          className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-black/40"
          style={thumb ? { backgroundImage: `url(${thumb})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <PlayCircle
              className={cn(
                "h-5 w-5 drop-shadow",
                active ? "text-primary-foreground" : "text-white/90",
              )}
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{lesson.title}</p>
          <p
            className={cn(
              "text-xs",
              active ? "text-primary-foreground/75" : "text-muted-foreground",
            )}
          >
            {lesson.duration}
          </p>
        </div>
      </Link>
    </li>
  );
}




type SaveLessonProgress = ReturnType<typeof useLessonProgress>["saveProgress"];

type PlayerJsPlayer = {
  on: (event: string, callback: (data?: { seconds?: number; duration?: number }) => void) => void;
  off?: (event: string, callback?: (data?: { seconds?: number; duration?: number }) => void) => void;
  play?: () => void;
  setCurrentTime: (seconds: number) => void;
  getCurrentTime: (callback: (seconds: number) => void) => void;
};

type PlayerJsConstructor = new (element: HTMLIFrameElement) => PlayerJsPlayer;

declare global {
  interface Window {
    playerjs?: { Player: PlayerJsConstructor };
  }
}

let playerJsPromise: Promise<void> | null = null;

function loadPlayerJs() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.playerjs?.Player) return Promise.resolve();
  if (playerJsPromise) return playerJsPromise;

  playerJsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-playerjs]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js";
    script.async = true;
    script.dataset.playerjs = "true";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return playerJsPromise;
}

function trackedEmbedUrl(url: string, lessonId: string) {
  try {
    const u = new URL(url);
    u.searchParams.set("t", lessonId);
    return u.toString();
  } catch {
    return url;
  }
}

/** Retoma o Panda no segundo guardado (parâmetro `t` suportado pelo player). */
function pandaStartUrl(source: ReturnType<typeof parseVideoUrl>, startSeconds: number) {
  const url = source.embedUrl!;
  if (source.kind !== "panda" || startSeconds <= 3) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("t", String(Math.floor(startSeconds)));
    return u.toString();
  } catch {
    return url;
  }
}

function TrackedVideoPlayer({
  lessonId,
  title,
  source,
  startSeconds,
  saveProgress,
  nextTitle,
  onAdvance,
  advanceLabel,
  seekRef,
}: {
  lessonId: string;
  title: string;
  source: ReturnType<typeof parseVideoUrl>;
  startSeconds: number;
  saveProgress: SaveLessonProgress;
  nextTitle?: string | null;
  onAdvance?: () => void;
  advanceLabel?: string;
  seekRef?: React.MutableRefObject<((seconds: number) => void) | null>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<PlayerJsPlayer | null>(null);
  const lastSavedRef = useRef(0);
  const initialSeekDoneRef = useRef(false);
  const [ended, setEnded] = useState(false);
  const [embedKey, setEmbedKey] = useState(0);
  // Snapshot the resume position once per lesson. Without this, every saveProgress
  // updates the row → startSeconds prop changes → seek effect re-fires → video
  // jumps back and appears to loop.
  const startRef = useRef(startSeconds);
  // Tempo realmente visto nesta sessão desta aula. Só com visualização real é
  // que o avanço automático dispara — evita cascatas de 2–3 aulas quando o
  // vídeo abre perto do fim ou o player emite "ended" logo ao carregar.
  const watchedRef = useRef(0);
  const [canAutoAdvance, setCanAutoAdvance] = useState(false);
  const currentLessonIdRef = useRef(lessonId);
  if (currentLessonIdRef.current !== lessonId) {
    currentLessonIdRef.current = lessonId;
    startRef.current = startSeconds;
    initialSeekDoneRef.current = false;
    lastSavedRef.current = Math.max(0, Math.floor(startSeconds));
    watchedRef.current = 0;
  }

  useEffect(() => {
    setEnded(false);
    setCanAutoAdvance(false);
    watchedRef.current = 0;
  }, [lessonId]);

  const markEnded = useCallback(() => {
    setCanAutoAdvance(watchedRef.current >= 20);
    setEnded(true);
  }, []);

  const handleReplay = useCallback(() => {
    setEnded(false);
    setCanAutoAdvance(false);
    watchedRef.current = 0;
    startRef.current = 0;
    lastSavedRef.current = 0;
    if (source.kind === "file") {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        void video.play().catch(() => {});
      }
      return;
    }
    const player = playerRef.current;
    if (player) {
      player.setCurrentTime(0);
      player.play?.();
      return;
    }
    // Sem controlo remoto (ex.: Panda sem player.js) — recarrega o embed do início.
    setEmbedKey((k) => k + 1);
  }, [source.kind]);

  // Permite que as notas saltem para o minuto guardado sem recarregar a aula.
  useEffect(() => {
    if (!seekRef) return;
    seekRef.current = (seconds: number) => {
      const target = Math.max(0, Math.floor(seconds));
      setEnded(false);
      lastSavedRef.current = target;
      if (source.kind === "file") {
        const video = videoRef.current;
        if (video) {
          video.currentTime = target;
          void video.play().catch(() => {});
        }
        return;
      }
      const player = playerRef.current;
      if (player) {
        player.setCurrentTime(target);
        player.play?.();
      }
    };
    return () => {
      seekRef.current = null;
    };
  }, [seekRef, source.kind]);



  useEffect(() => {
    const video = videoRef.current;
    const startAt = startRef.current;
    if (source.kind !== "file" || !video || initialSeekDoneRef.current || startAt <= 3) return;
    const seek = () => {
      initialSeekDoneRef.current = true;
      const duration = video.duration || 0;
      // Nunca retomar nos últimos 20s: senão a aula "abre no fim".
      if (duration && startAt >= duration - 20) {
        startRef.current = 0;
        lastSavedRef.current = 0;
        return;
      }
      video.currentTime = Math.min(startAt, duration || startAt);
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener("loadedmetadata", seek, { once: true });
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [source.kind, lessonId]);

  const persist = useCallback(
    (seconds: number, completed = false, force = false) => {
      const safeSeconds = Math.max(0, Math.floor(seconds));
      const delta = safeSeconds - lastSavedRef.current;
      // Avanço normal (não salto) conta como tempo visto.
      if (delta > 0 && delta < 60) watchedRef.current += delta;
      if (!force && Math.abs(delta) < 5) return;
      lastSavedRef.current = safeSeconds;
      // Ao concluir, guardamos posição 0 para a aula reabrir do início.
      void saveProgress(completed ? 0 : safeSeconds, { completed, silent: true });
      if (completed) lastSavedRef.current = 0;
    },
    [saveProgress],
  );

  useEffect(() => {
    if ((source.kind !== "bunny" && source.kind !== "panda") || !source.embedUrl) return;
    let player: PlayerJsPlayer | null = null;
    let cancelled = false;

    const onTimeUpdate = (data?: { seconds?: number; duration?: number }) => {
      if (typeof data?.seconds === "number") persist(data.seconds);
    };
    const onSeeked = (data?: { seconds?: number }) => {
      if (typeof data?.seconds === "number") persist(data.seconds, false, true);
    };
    const onEnded = (data?: { seconds?: number; duration?: number }) => {
      persist(data?.duration ?? data?.seconds ?? lastSavedRef.current, true, true);
      markEnded();
    };
    const onPause = () => {
      player?.getCurrentTime((seconds) => persist(seconds, false, true));
    };

    void loadPlayerJs()
      .then(() => {
        if (cancelled || !iframeRef.current || !window.playerjs?.Player) return;
        player = new window.playerjs.Player(iframeRef.current);
        playerRef.current = player;
        player.on("ready", () => {
          if (cancelled) return;
          if (startRef.current > 3) player?.setCurrentTime(startRef.current);
          player?.on("timeupdate", onTimeUpdate);
          player?.on("seeked", onSeeked);
          player?.on("pause", onPause);
          player?.on("ended", onEnded);
        });
      })
      .catch((error) => console.warn("Falha ao carregar controlo do player", error));

    // O Panda Video emite eventos próprios via postMessage (panda_timeupdate/panda_ended).
    const onPandaMessage = (event: MessageEvent) => {
      if (source.kind !== "panda") return;
      const raw = event.data;
      let payload: { message?: string; currentTime?: number; video?: unknown } | null = null;
      if (typeof raw === "string") {
        try {
          payload = JSON.parse(raw);
        } catch {
          return;
        }
      } else if (raw && typeof raw === "object") {
        payload = raw as typeof payload;
      }
      const message = payload?.message;
      if (!message || typeof message !== "string" || !message.startsWith("panda_")) return;
      const seconds = typeof payload?.currentTime === "number" ? payload.currentTime : null;
      if (message === "panda_ended") {
        persist(seconds ?? lastSavedRef.current, true, true);
        markEnded();
      }
      else if (message === "panda_pause" && seconds != null) persist(seconds, false, true);
      else if (message === "panda_timeupdate" && seconds != null) persist(seconds);
    };
    if (source.kind === "panda") window.addEventListener("message", onPandaMessage);

    return () => {
      cancelled = true;
      window.removeEventListener("message", onPandaMessage);
      player?.getCurrentTime((seconds) => persist(seconds, false, true));
      player?.off?.("timeupdate", onTimeUpdate);
      player?.off?.("seeked", onSeeked);
      player?.off?.("pause", onPause);
      player?.off?.("ended", onEnded);
    };
  }, [persist, source.embedUrl, source.kind, lessonId]);

  const endOverlay = (
    <LessonEndOverlay
      open={ended}
      autoAdvance={canAutoAdvance}
      nextTitle={nextTitle ?? null}
      onAdvance={onAdvance}
      advanceLabel={advanceLabel}
      onReplay={handleReplay}
    />
  );

  if (source.kind === "file" && source.fileUrl) {
    return (
      <div className="group relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-black md:rounded-3xl">
        <video
          key={lessonId}
          ref={videoRef}
          src={source.fileUrl}
          controls
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full bg-black"
          onLoadedMetadata={(event) => {
            const startAt = startRef.current;
            if (initialSeekDoneRef.current || startAt <= 3) return;
            initialSeekDoneRef.current = true;
            const duration = event.currentTarget.duration || 0;
            if (duration && startAt >= duration - 20) {
              startRef.current = 0;
              lastSavedRef.current = 0;
              return;
            }
            event.currentTarget.currentTime = Math.min(startAt, duration || startAt);
          }}
          onTimeUpdate={(event) => persist(event.currentTarget.currentTime)}
          onPause={(event) => persist(event.currentTarget.currentTime, false, true)}
          onPlay={() => setEnded(false)}
          onEnded={(event) => {
            persist(event.currentTarget.duration || event.currentTarget.currentTime, true, true);
            markEnded();
          }}
        />
        <VideoWatermark />
        {endOverlay}
      </div>
    );
  }

  if (source.embedUrl) {
    return (
      <div className="group relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-black md:rounded-3xl">
        <iframe
          key={`${lessonId}-${embedKey}`}
          ref={iframeRef}
          src={source.kind === "bunny" ? trackedEmbedUrl(source.embedUrl, lessonId) : pandaStartUrl(source, startRef.current)}
          title={title}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
        <VideoWatermark />
        {endOverlay}
      </div>
    );
  }


  return (

    <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-black md:rounded-3xl">
      <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
        Vídeo não configurado para esta aula.
      </div>
    </div>
  );
}


/**
 * Ecrã de fim de aula (estilo YouTube): contagem de 10 segundos com
 * "Avançar" e "Repetir". Sem interação, avança automaticamente.
 */
function LessonEndOverlay({
  open,
  autoAdvance = true,
  nextTitle,
  onAdvance,
  advanceLabel,
  onReplay,
}: {
  open: boolean;
  autoAdvance?: boolean;
  nextTitle: string | null;
  onAdvance?: () => void;
  advanceLabel?: string;
  onReplay: () => void;
}) {
  const COUNTDOWN = 10;
  const [remaining, setRemaining] = useState(COUNTDOWN);
  const firedRef = useRef(false);
  const advanceRef = useRef(onAdvance);
  advanceRef.current = onAdvance;

  useEffect(() => {
    if (!open) {
      firedRef.current = false;
      setRemaining(COUNTDOWN);
      return;
    }
    if (!advanceRef.current || !autoAdvance) return;
    setRemaining(COUNTDOWN);
    const id = window.setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, autoAdvance]);

  // Avanço automático: dispara UMA única vez por aula terminada, e só quando a
  // aula foi de facto vista — nunca salta 2 ou 3 aulas de seguida.
  useEffect(() => {
    if (!open || !autoAdvance || remaining > 0 || firedRef.current) return;
    const advance = advanceRef.current;
    if (!advance) return;
    firedRef.current = true;
    advance();
  }, [open, autoAdvance, remaining]);

  const handleAdvanceClick = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    onAdvance?.();
  };

  if (!open) return null;

  const progress = onAdvance && autoAdvance ? ((COUNTDOWN - remaining) / COUNTDOWN) * 100 : 0;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 px-5 text-center backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Aula concluída</p>

      {onAdvance ? (
        <>
          <p className="max-w-md text-sm text-white/80 sm:text-base">
            A seguir: <span className="font-medium text-white">{nextTitle}</span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onReplay}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/25 px-4 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Repetir
            </button>
            <button
              type="button"
              onClick={handleAdvanceClick}
              className="relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-gold-soft"
            >
              <span
                className="absolute inset-y-0 left-0 bg-black/20 transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
              <span className="relative">
                {advanceLabel ?? "Avançar"}
                {autoAdvance ? ` (${remaining}s)` : ""}
              </span>
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="max-w-md text-sm text-white/80">Terminaste a última aula deste curso.</p>
          <button
            type="button"
            onClick={onReplay}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/25 px-4 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Repetir
          </button>
        </>
      )}
    </div>
  );
}

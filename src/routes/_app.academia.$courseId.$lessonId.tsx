import { createFileRoute, notFound } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  PlayCircle,
  Download,
  MessagesSquare,
  ArrowRight,
  Crown,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import { coursesById } from "@/data/courses";
import "@/data/admin-store";
import { useAdminOverridesVersion } from "@/hooks/use-admin-overrides";
import type { Lesson, Module } from "@/data/types";
import { cn } from "@/lib/utils";
import { parseVideoUrl } from "@/lib/video-source";
import { useLessonProgress } from "@/hooks/use-lesson-progress";

export const Route = createFileRoute("/_app/academia/$courseId/$lessonId")({
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
  const videoUrl = data?.current.lesson.videoUrl ?? DEFAULT_LESSON_YOUTUBE_URL;
  const source = parseVideoUrl(videoUrl);
  const { row, completed, saving, saveProgress, setCompleted } = useLessonProgress(
    courseIdForProgress,
    currentLessonId,
  );

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


  return (
    <div className="-mx-3 -my-4 h-[calc(100dvh-3.5rem)] max-w-[100vw] overflow-x-hidden bg-background sm:-mx-4 sm:-my-6 md:-mx-8 md:-my-8 lg:overflow-hidden">
      <div className="mx-auto flex h-full max-w-[1440px] flex-col overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-6 lg:overflow-hidden">
        {/* Breadcrumb bar */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto rounded-2xl border border-border bg-surface-1 px-4 py-2.5 text-sm md:mb-6 md:gap-3 md:px-5 md:py-3">
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
        <div className="grid min-h-0 flex-1 gap-4 md:gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
          {/* Modules sidebar — scrollable independently on desktop; below content on mobile */}
          <aside className="order-2 flex min-h-0 flex-col rounded-3xl border border-border bg-surface-1 p-4 md:p-5 lg:order-1">
            <p className="mb-4 shrink-0 font-display text-lg text-foreground">Módulos</p>
            <div className="space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
              {course.modules!.map((m: Module, mi: number) => (
                <ModuleAccordion
                  key={m.id}
                  module={m}
                  courseId={course.id}
                  currentLessonId={current.lesson.id}
                  defaultOpen={mi < 2 || m.lessons.some((l: Lesson) => l.id === current.lesson.id)}
                />
              ))}
            </div>
          </aside>

          {/* Main content: video + title/cta */}
          <div className="order-1 flex min-h-0 flex-col gap-3 sm:gap-4 md:gap-6 lg:order-2 lg:overflow-y-auto lg:pr-1">
            {/* Video player */}
            <TrackedVideoPlayer
              lessonId={current.lesson.id}
              title={current.lesson.title}
              source={source}
              startSeconds={row?.progress_seconds ?? 0}
              saveProgress={saveProgress}
            />

            {/* Title + CTA */}
            <div className="flex flex-row items-center justify-between gap-2 rounded-xl bg-surface-2 px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-3">
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

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setCompleted(!completed)}
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
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir vídeo original"
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-1 text-foreground transition hover:border-primary/40"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Crown className="h-2 w-2 fill-current" />
                  </span>
                </a>

                <Link
                  to="/comunidade"
                  aria-label="Sala de discussão"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface-3 px-2.5 text-xs font-medium text-foreground transition hover:bg-surface-3/80 sm:px-3"
                >
                  <MessagesSquare className="h-3.5 w-3.5" />
                  <span className="hidden whitespace-nowrap sm:inline">Sala de discussão</span>
                </Link>

                {next ? (
                  <Link
                    to="/academia/$courseId/$lessonId"
                    params={{ courseId: course.id, lessonId: next.lesson.id }}
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
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleAccordion({
  module,
  courseId,
  currentLessonId,
  defaultOpen,
}: {
  module: Module;
  courseId: string;
  currentLessonId: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = open ? ChevronUp : ChevronDown;

  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-start gap-2 text-left"
      >
        <div className="flex-1">
          <p className="text-[15px] leading-snug text-foreground">{module.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {module.lessons.length} {module.lessons.length === 1 ? "aula" : "aulas"}
          </p>
        </div>
        <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <ul className="mt-4 space-y-2.5">
          {module.lessons.map((l) => {
            const active = l.id === currentLessonId;
            return (
              <li key={l.id}>
                <Link
                  to="/academia/$courseId/$lessonId"
                  params={{ courseId, lessonId: l.id }}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-3 text-foreground hover:bg-surface-3/70",
                  )}
                >
                  <PlayCircle
                    className={cn(
                      "h-7 w-7 shrink-0",
                      active ? "text-primary-foreground" : "text-foreground/80",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{l.title}</p>
                    <p
                      className={cn(
                        "text-xs",
                        active
                          ? "text-primary-foreground/75"
                          : "text-muted-foreground",
                      )}
                    >
                      {l.duration}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


const DEFAULT_LESSON_YOUTUBE_URL = "https://www.youtube.com/watch?v=-alfqFwiI6Y";

type SaveLessonProgress = ReturnType<typeof useLessonProgress>["saveProgress"];

type PlayerJsPlayer = {
  on: (event: string, callback: (data?: { seconds?: number; duration?: number }) => void) => void;
  off?: (event: string, callback?: (data?: { seconds?: number; duration?: number }) => void) => void;
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

function TrackedVideoPlayer({
  lessonId,
  title,
  source,
  startSeconds,
  saveProgress,
}: {
  lessonId: string;
  title: string;
  source: ReturnType<typeof parseVideoUrl>;
  startSeconds: number;
  saveProgress: SaveLessonProgress;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastSavedRef = useRef(0);
  const initialSeekDoneRef = useRef(false);
  // Snapshot the resume position once per lesson. Without this, every saveProgress
  // updates the row → startSeconds prop changes → seek effect re-fires → video
  // jumps back and appears to loop.
  const startRef = useRef(startSeconds);
  const currentLessonIdRef = useRef(lessonId);
  if (currentLessonIdRef.current !== lessonId) {
    currentLessonIdRef.current = lessonId;
    startRef.current = startSeconds;
    initialSeekDoneRef.current = false;
    lastSavedRef.current = Math.max(0, Math.floor(startSeconds));
  }

  useEffect(() => {
    const video = videoRef.current;
    const startAt = startRef.current;
    if (source.kind !== "file" || !video || initialSeekDoneRef.current || startAt <= 3) return;
    const seek = () => {
      initialSeekDoneRef.current = true;
      video.currentTime = Math.min(startAt, video.duration || startAt);
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener("loadedmetadata", seek, { once: true });
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [source.kind, lessonId]);

  const persist = useCallback(
    (seconds: number, completed = false, force = false) => {
      const safeSeconds = Math.max(0, Math.floor(seconds));
      if (!force && Math.abs(safeSeconds - lastSavedRef.current) < 5) return;
      lastSavedRef.current = safeSeconds;
      void saveProgress(safeSeconds, { completed, silent: true });
    },
    [saveProgress],
  );

  useEffect(() => {
    if (source.kind !== "bunny" || !source.embedUrl) return;
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
    };
    const onPause = () => {
      player?.getCurrentTime((seconds) => persist(seconds, false, true));
    };

    void loadPlayerJs()
      .then(() => {
        if (cancelled || !iframeRef.current || !window.playerjs?.Player) return;
        player = new window.playerjs.Player(iframeRef.current);
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

    return () => {
      cancelled = true;
      player?.getCurrentTime((seconds) => persist(seconds, false, true));
      player?.off?.("timeupdate", onTimeUpdate);
      player?.off?.("seeked", onSeeked);
      player?.off?.("pause", onPause);
      player?.off?.("ended", onEnded);
    };
  }, [persist, source.embedUrl, source.kind, lessonId]);

  if (source.kind === "file" && source.fileUrl) {
    return (
      <div className="relative aspect-video shrink-0 overflow-hidden rounded-2xl border border-border bg-black md:rounded-3xl">
        <video
          key={lessonId}
          ref={videoRef}
          src={source.fileUrl}
          controls
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full bg-black"
          onLoadedMetadata={(event) => {
            if (initialSeekDoneRef.current || startSeconds <= 3) return;
            initialSeekDoneRef.current = true;
            event.currentTarget.currentTime = Math.min(startSeconds, event.currentTarget.duration || startSeconds);
          }}
          onTimeUpdate={(event) => persist(event.currentTarget.currentTime)}
          onPause={(event) => persist(event.currentTarget.currentTime, false, true)}
          onEnded={(event) => persist(event.currentTarget.duration || event.currentTarget.currentTime, true, true)}
        />
      </div>
    );
  }

  if (source.embedUrl) {
    return (
      <div className="relative aspect-video shrink-0 overflow-hidden rounded-2xl border border-border bg-black md:rounded-3xl">
        <iframe
          key={lessonId}
          ref={iframeRef}
          src={source.kind === "bunny" ? trackedEmbedUrl(source.embedUrl, lessonId) : source.embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-video shrink-0 overflow-hidden rounded-2xl border border-border bg-black md:rounded-3xl">
      <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
        Vídeo não configurado para esta aula.
      </div>
    </div>
  );
}


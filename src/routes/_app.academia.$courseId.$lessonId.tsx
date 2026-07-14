import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  PlayCircle,
  Download,
  MessagesSquare,
  ArrowRight,
  Crown,
} from "lucide-react";
import { coursesById } from "@/data/courses";
import type { Lesson, Module } from "@/data/types";
import { cn } from "@/lib/utils";
import { parseVideoUrl } from "@/lib/video-source";

export const Route = createFileRoute("/_app/academia/$courseId/$lessonId")({
  loader: ({ params }) => {
    const course = coursesById[params.courseId];
    if (!course || !course.modules) throw notFound();

    // Flatten lessons with module reference.
    const flat: Array<{ lesson: Lesson; module: Module; index: number }> = [];
    let counter = 0;
    for (const m of course.modules) {
      for (const l of m.lessons) {
        flat.push({ lesson: l, module: m, index: counter++ });
      }
    }
    const currentIdx = flat.findIndex((x) => x.lesson.id === params.lessonId);
    if (currentIdx === -1) throw notFound();
    const current = flat[currentIdx];
    const next = flat[currentIdx + 1] ?? null;

    return { course, current, next };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          {
            title: `${loaderData.current.lesson.title} — ${loaderData.course.title}`,
          },
          { name: "description", content: loaderData.course.tagline },
        ]
      : [{ title: "Aula — MM Club" }],
  }),
  component: LessonPlayer,
});

function LessonPlayer() {
  const { course, current, next } = Route.useLoaderData();
  const videoUrl = current.lesson.videoUrl ?? DEFAULT_LESSON_YOUTUBE_URL;
  const source = parseVideoUrl(videoUrl);

  return (
    <div className="-mx-4 -my-8 min-h-[calc(100vh-4rem)] bg-background md:-mx-8 md:-my-10">
      <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 md:py-8">
        {/* Breadcrumb bar (page-level, sits below app nav) */}
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-surface-1 px-5 py-3 text-sm">
          <Link
            to="/academia"
            className="text-muted-foreground transition hover:text-foreground"
          >
            Academia
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Link
            to="/academia/$courseId"
            params={{ courseId: course.id }}
            className="text-muted-foreground transition hover:text-foreground"
          >
            {course.title}
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="truncate text-foreground">{current.lesson.title}</span>
        </div>

        {/* Layout: modules sidebar + main content */}
        <div className="grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
          {/* Modules sidebar */}
          <aside className="rounded-3xl border border-border bg-surface-1 p-5">
            <p className="mb-4 font-display text-lg text-foreground">Módulos</p>
            <div className="space-y-3">
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
          <div className="space-y-6">
            {/* Video player — YouTube embed */}
            <div className="relative aspect-video overflow-hidden rounded-3xl border border-border bg-black">
              {source.kind === "file" && source.fileUrl ? (
                <video
                  key={current.lesson.id}
                  src={source.fileUrl}
                  controls
                  autoPlay
                  playsInline
                  className="absolute inset-0 h-full w-full bg-black"
                />
              ) : source.embedUrl ? (
                <iframe
                  key={current.lesson.id}
                  src={source.embedUrl}
                  title={current.lesson.title}
                  className="absolute inset-0 h-full w-full"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
                  Vídeo não configurado para esta aula.
                </div>
              )}
            </div>

            {/* Title + CTA */}
            <div className="flex flex-col gap-5 rounded-3xl bg-surface-2 p-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h1 className="font-display text-2xl text-foreground md:text-[26px]">
                  {current.lesson.title}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{current.module.title}</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                  <span>Aula {current.index + 1}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Download with premium ring */}
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir vídeo original"
                  className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-surface-1 text-foreground transition hover:border-primary/40"
                >
                  <Download className="h-5 w-5" />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Crown className="h-3 w-3 fill-current" />
                  </span>
                </a>

                <Link
                  to="/comunidade"
                  className="inline-flex h-14 items-center gap-2 rounded-2xl bg-surface-3 px-6 text-sm font-semibold text-foreground transition hover:bg-surface-3/80"
                >
                  <MessagesSquare className="h-4 w-4" />
                  Sala de discussão
                </Link>

                {next ? (
                  <Link
                    to="/academia/$courseId/$lessonId"
                    params={{ courseId: course.id, lessonId: next.lesson.id }}
                    className="inline-flex h-14 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:bg-gold-soft"
                  >
                    Próxima aula
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link
                    to="/academia/$courseId"
                    params={{ courseId: course.id }}
                    className="inline-flex h-14 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:bg-gold-soft"
                  >
                    Terminar curso
                    <ArrowRight className="h-4 w-4" />
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


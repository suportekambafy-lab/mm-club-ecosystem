import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, ChevronUp, Clock, Lock, PlayCircle } from "lucide-react";
import { coursesById } from "@/data/courses";
import type { Course, Lesson, Module } from "@/data/types";
import { getLive } from "@/lib/lives.functions";
import { LivePlayer } from "@/components/mm/live-player";
import { ExternalReplayPlayer } from "@/components/mm/external-replay-player";
import { ChallengeLivesModule } from "@/components/mm/challenge-lives-module";
import { CourseComments } from "@/components/mm/course-comments";
import { isFeaturedCourse } from "@/lib/course-order";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/academia/$courseId/live/$liveId")({
  loader: ({ params }) => {
    if (!coursesById[params.courseId]) throw notFound();
    return { courseId: params.courseId, liveId: params.liveId };
  },
  head: () => ({
    meta: [
      { title: "Live gravada — MM Club" },
      { name: "description", content: "Assiste à gravação da live do desafio dentro do curso." },
      { property: "og:title", content: "Live gravada — MM Club" },
      { property: "og:description", content: "Assiste à gravação da live do desafio dentro do curso." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CourseLiveReplay,
});

type LiveData = Awaited<ReturnType<typeof getLive>>;

function CourseLiveReplay() {
  const { courseId, liveId } = Route.useLoaderData();
  const { hasAccess } = Route.useRouteContext() as { hasAccess?: boolean };
  const course = coursesById[courseId] as Course;
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(false);
    getLive({ data: { id: liveId } })
      .then((d) => {
        if (alive) setData(d as LiveData);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [liveId]);

  if (hasAccess === false) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </span>
        <h1 className="font-display text-2xl">Esta gravação está trancada</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          O teu acesso está suspenso por falta de pagamento. Regulariza a subscrição para voltares a
          assistir — o teu progresso continua guardado.
        </p>
        <Link
          to="/subscricao"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Ver o meu plano
        </Link>
      </div>
    );
  }

  const live = data?.live ?? null;
  const externalRecordingUrl =
    (data as { externalRecordingUrl?: string | null } | null)?.externalRecordingUrl ?? null;

  return (
    <div className="-mx-3 -my-4 w-[calc(100%+1.5rem)] max-w-[100vw] overflow-x-clip bg-background sm:-mx-4 sm:-my-6 sm:w-[calc(100%+2rem)] md:-mx-8 md:-my-8 md:w-[calc(100%+4rem)]">
      <div className="mx-auto flex w-full max-w-[1440px] min-w-0 flex-col overflow-x-clip px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-6">
        {/* Breadcrumb */}
        <div className="mb-4 flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-border bg-surface-1 px-4 py-2.5 text-sm [scrollbar-width:none] md:mb-6 md:gap-3 md:px-5 md:py-3 [&::-webkit-scrollbar]:hidden">
          <Link to="/academia" className="shrink-0 text-muted-foreground transition hover:text-foreground">
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
          <span className="truncate text-foreground">{live?.title ?? "Live gravada"}</span>
        </div>

        <div className="grid min-w-0 items-start gap-4 md:gap-6 lg:grid-cols-[minmax(280px,330px)_minmax(0,1fr)]">
          {/* Sidebar com os módulos do curso */}
          <aside className="order-2 flex min-w-0 flex-col rounded-2xl border border-border bg-surface-1 p-3 sm:p-4 md:rounded-3xl md:p-5 lg:sticky lg:top-4 lg:order-1 lg:max-h-[calc(100dvh-6rem)]">
            <p className="mb-4 shrink-0 font-display text-lg text-foreground">Módulos</p>
            <div className="space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
              {(course.modules ?? []).map((m: Module) => (
                <SimpleModule key={m.id} module={m} courseId={course.id} />
              ))}
              {isFeaturedCourse(course) && (
                <ChallengeLivesModule
                  index={(course.modules ?? []).length}
                  courseId={course.id}
                  activeLiveId={liveId}
                />
              )}
            </div>
          </aside>

          {/* Conteúdo: gravação da live */}
          <div className="order-1 flex min-w-0 flex-col gap-3 sm:gap-4 md:gap-6 lg:order-2">
            <div className="relative w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-black md:rounded-3xl">
              {!data ? (
                <div className="flex aspect-video items-center justify-center text-sm text-white/60">
                  {error ? "Não conseguimos abrir esta gravação." : "A preparar a gravação…"}
                </div>
              ) : externalRecordingUrl ? (
                <ExternalReplayPlayer
                  url={externalRecordingUrl}
                  poster={live?.cover_url ?? undefined}
                  className="aspect-video w-full max-w-full rounded-none shadow-none ring-0"
                />
              ) : data.videoUid ? (
                <LivePlayer
                  key={`gen-${live?.stream_generation ?? 0}`}
                  videoUid={data.videoUid}
                  playbackToken={data.playbackToken}
                  segments={data.replaySegments}
                  trimStart={(data as { trimStart?: number | null }).trimStart ?? null}
                  trimEnd={(data as { trimEnd?: number | null }).trimEnd ?? null}
                  progressKey={`${liveId}:${live?.stream_generation ?? 0}`}
                  className="aspect-video w-full max-w-full rounded-none shadow-none ring-0"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-white/60">
                  A gravação desta live ainda está a ser processada.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface-1 p-4 md:rounded-3xl md:p-6">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
                <PlayCircle className="h-3 w-3" /> Live gravada · acesso livre
              </span>
              <h1 className="mt-3 font-display text-2xl text-foreground">
                {live?.title ?? "Live gravada"}
              </h1>
              {live?.starts_at && (
                <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(
                      new Date(live.starts_at),
                    )}
                  </span>
                  {data?.actualDurationSeconds ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {Math.round(data.actualDurationSeconds / 60)} min
                    </span>
                  ) : null}
                </p>
              )}
              {live?.description && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{live.description}</p>
              )}
            </div>

            <CourseComments courseId={course.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SimpleModule({ module, courseId }: { module: Module; courseId: string }) {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronUp : ChevronDown;
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2 p-3 sm:p-4">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full min-w-0 items-start gap-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-snug text-foreground">{module.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {module.lessons.length} {module.lessons.length === 1 ? "aula" : "aulas"}
          </p>
        </div>
        <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <ul className="mt-4 space-y-2">
          {module.lessons.map((l: Lesson) => (
            <li key={l.id}>
              <Link
                to="/academia/$courseId/$lessonId"
                params={{ courseId, lessonId: l.id }}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-xl bg-surface-3 px-2.5 py-2 text-sm text-foreground transition hover:bg-surface-3/70",
                )}
              >
                <PlayCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{l.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

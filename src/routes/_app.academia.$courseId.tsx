import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, Clock, Play } from "lucide-react";
import { coursesById } from "@/data/courses";
import { expertsById } from "@/data/experts";
import { ExpertAvatar } from "@/components/mm/expert-avatar";

export const Route = createFileRoute("/_app/academia/$courseId")({
  loader: ({ params }) => {
    const course = coursesById[params.courseId];
    if (!course) throw notFound();
    return { course };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.course.title} — MM Club` },
          { name: "description", content: loaderData.course.tagline },
        ]
      : [{ title: "Curso — MM Club" }],
  }),
  component: CourseDetail,
});

function CourseDetail() {
  const { course } = Route.useLoaderData();
  const expert = expertsById[course.expertId];

  return (
    <div className="space-y-10">
      <Link
        to="/academia"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Academia
      </Link>

      {/* Hero */}
      <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div
          className="relative aspect-video overflow-hidden rounded-2xl ring-1 ring-border"
          style={{ background: course.cover }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/10 to-transparent" />
          <button
            className="absolute inset-0 flex items-center justify-center"
            aria-label="Reproduzir"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-2xl shadow-primary/30 transition hover:bg-gold-soft">
              <Play className="h-6 w-6 fill-primary-foreground text-primary-foreground" />
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
              Curso · MM Club
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight text-foreground md:text-4xl">
              {course.title}
            </h1>
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
              <Clock className="h-3.5 w-3.5" /> {course.duration}
            </span>
            <span>·</span>
            <span>{course.lessonsCount} aulas</span>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft">
            <Play className="h-4 w-4 fill-current" />
            {course.progress > 0 ? "Continuar" : "Começar curso"}
          </button>

          {course.progress > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Progresso</span>
                <span className="text-primary">
                  {Math.round(course.progress * 100)}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.round(course.progress * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Descrição */}
      <section className="max-w-3xl">
        <h2 className="font-display text-xl text-foreground">Sobre este curso</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {course.description}
        </p>
      </section>

      {/* Módulos */}
      {course.modules && course.modules.length > 0 && (
        <section className="space-y-5">
          <h2 className="font-display text-xl text-foreground">Conteúdo do curso</h2>
          <div className="space-y-3">
            {course.modules.map((m: import("@/data/types").Module, mi: number) => (
              <div
                key={m.id}
                className="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-border"
              >
                <div className="border-b border-border px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-primary">
                      Módulo {String(mi + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-display text-base text-foreground">
                      {m.title}
                    </h3>
                  </div>
                </div>
                <ul>
                  {m.lessons.map((l: import("@/data/types").Lesson, li: number) => (
                    <li key={l.id}>
                      <Link
                        to="/academia/$courseId/$lessonId"
                        params={{ courseId: course.id, lessonId: l.id }}
                        className="flex items-center gap-4 border-b border-border/50 px-5 py-3 last:border-b-0 transition hover:bg-surface-2"
                      >
                        <span
                          className={
                            l.completed
                              ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                              : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground"
                          }
                        >
                          {l.completed ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm text-foreground">
                            {String(li + 1).padStart(2, "0")}. {l.title}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {l.duration}
                        </span>
                      </Link>
                    </li>
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

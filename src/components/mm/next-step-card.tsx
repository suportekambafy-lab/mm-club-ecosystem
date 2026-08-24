import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Award, Bell, Compass, Play, Target } from "lucide-react";
import { courses as allCourses } from "@/data/courses";
import { useCourseAccess } from "@/hooks/use-course-release";
import { useUserProgress } from "@/hooks/use-user-progress";
import { computeNextStep } from "@/lib/next-step";
import { lessonThumb } from "@/lib/course-duration";
import { courseCoverBackground, courseCoverImage } from "@/lib/course-cover";
import { cn } from "@/lib/utils";

/**
 * Trilho guiado — "o teu próximo passo".
 *
 * Um único bloco, sempre com uma ação concreta: a aula exata a ver a seguir,
 * onde ela encaixa no módulo e quanto falta para o certificado. Para quem
 * ainda não viu nada, mostra a primeira sessão orientada em 3 passos.
 */
export function NextStepCard({ className }: { className?: string }) {
  const { progress, loaded } = useUserProgress();
  const { canOpen } = useCourseAccess();

  const open = useMemo(() => allCourses.filter((c) => canOpen(c)), [canOpen]);
  const step = useMemo(
    () => (loaded ? computeNextStep(open, progress) : null),
    [loaded, open, progress],
  );

  if (!loaded || !step) return null;

  // Sem miniatura da aula, mostramos a capa do curso (nunca um bloco vazio).
  const thumb = lessonThumb(step.lesson, step.course) || courseCoverImage(step.course);
  const coverBackground = thumb
    ? `url(${thumb}) center/cover no-repeat, #000`
    : courseCoverBackground(step.course);
  const firstTime = step.kind === "start";

  const label =
    step.kind === "start"
      ? "Começa aqui"
      : step.kind === "finish"
        ? "Reta final"
        : "O teu próximo passo";

  return (
    <section className={cn("surface-card", className)}>
      <div className="grid gap-0 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <Link
          to="/academia/$courseId/$lessonId"
          params={{ courseId: step.course.id, lessonId: step.lesson.id }}
          aria-label={`Ver aula ${step.lesson.title}`}
          className="group relative block aspect-video w-full bg-surface-2 md:aspect-auto md:h-full"
          style={{ background: coverBackground }}
        >
          <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-300 group-hover:scale-105">
            <Play className="ml-0.5 h-5 w-5" />
          </span>
        </Link>


        <div className="space-y-4 p-5 md:p-6">
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.24em] text-primary">
              <Target className="h-3 w-3" />
              {label}
            </p>
            <h2 className="font-display text-xl leading-tight text-foreground md:text-2xl">
              {step.lesson.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {step.course.title} · {step.module.title} · {step.minutes} min
            </p>
          </div>

          {firstTime ? (
            <ol className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <li className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-3 py-2">
                <Play className="h-3.5 w-3.5 shrink-0 text-primary" />
                Vê a primeira aula
              </li>
              <li className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-3 py-2">
                <Compass className="h-3.5 w-3.5 shrink-0 text-primary" />
                Segue o trilho até ao teste
              </li>
              <li className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-3 py-2">
                <Bell className="h-3.5 w-3.5 shrink-0 text-primary" />
                Ativa as notificações
              </li>
            </ol>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Aula {step.lessonIndex} de {step.lessonsTotal} · faltam {step.moduleRemaining} neste
                  módulo
                </span>
                <span className="text-primary">{step.coursePercent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${step.coursePercent}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/academia/$courseId/$lessonId"
              params={{ courseId: step.course.id, lessonId: step.lesson.id }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Play className="h-4 w-4" />
              {firstTime ? "Começar agora" : "Continuar"}
            </Link>
            <Link
              to="/certificados"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              <Award className="h-3.5 w-3.5 text-primary" />
              {step.certificateRemaining === 0
                ? "Certificado disponível"
                : `Faltam ${step.certificateRemaining} aulas para o certificado`}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

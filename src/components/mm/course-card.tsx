import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Play, Clock, Lock } from "lucide-react";
import type { Course } from "@/data/types";
import { expertsById } from "@/data/experts";
import { ExpertAvatar } from "./expert-avatar";
import { cn } from "@/lib/utils";
import { computeCourseDuration, lessonThumb } from "@/lib/course-duration";
import { formatCourseRelease } from "@/data/courses";
import { useCourseAccess } from "@/hooks/use-course-release";
import { courseCoverBackground } from "@/lib/course-cover";
import { useBunnyThumb } from "@/hooks/use-bunny-thumb";
import { isFeaturedCourse } from "@/lib/course-order";
import { Crown } from "lucide-react";


interface Props {
  course: Course;
  className?: string;
  variant?: "default" | "wide";
  resumeLessonId?: string | null;
  /** Show the lesson thumbnail instead of the course cover (only for "Continuar a ver"). */
  showResumeThumb?: boolean;
}

export function CourseCard({ course, className, variant = "default", resumeLessonId, showResumeThumb = false }: Props) {
  const expert = expertsById[course.expertId];
  const { canOpen } = useCourseAccess();
  const isSoon = !canOpen(course);
  const isWide = variant === "wide";
  const firstLesson = course.modules?.[0]?.lessons?.[0];
  const resumeLesson =
    (resumeLessonId
      ? course.modules?.flatMap((m) => m.lessons).find((l) => l.id === resumeLessonId)
      : null) ?? firstLesson;
  const linkProps =
    !isSoon && resumeLesson && course.progress > 0
      ? {
          to: "/academia/$courseId/$lessonId" as const,
          params: { courseId: course.id, lessonId: resumeLesson.id },
        }
      : { to: "/academia/$courseId" as const, params: { courseId: course.id } };
  // Catalog cards show the COURSE cover. Only "Continua a ver" cards show the
  // frame of the lesson the member stopped at. Never invert this.
  const resumeThumbLesson = showResumeThumb && course.progress > 0 ? resumeLesson : null;
  const syncThumb = resumeThumbLesson ? lessonThumb(resumeThumbLesson, course) : null;
  const { thumb: oembedThumb } = useBunnyThumb(
    resumeThumbLesson && !syncThumb ? resumeThumbLesson.videoUrl : null,
  );
  const resumeThumb = syncThumb ?? oembedThumb;



  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={cn(isWide ? "min-w-[420px]" : "min-w-[280px]", className)}
    >
      <Link
        {...linkProps}
        className={cn(
          "group relative flex h-full flex-col overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border transition-all duration-500",
          "hover:-translate-y-1 hover:ring-[color:var(--hairline)] hover:shadow-[0_28px_80px_-30px_oklch(0.82_0.13_82_/_0.35)]",
        )}
      >
        {/* Gold hairline top accent — reveals on hover */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 z-10 h-px scale-x-0 origin-left transition-transform duration-500 group-hover:scale-x-100"
          style={{
            background:
              "linear-gradient(90deg, transparent, oklch(0.82 0.13 82 / 0.7), transparent)",
          }}
        />

        {/* Cover */}
        <div
          className={cn(
            "relative overflow-hidden",
            isWide ? "aspect-[16/8]" : "aspect-[16/10]",
          )}
          style={{
            background: resumeThumb
              ? `url(${resumeThumb}) center/cover no-repeat, #000`
              : courseCoverBackground(course),
          }}


        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 50%, oklch(0.82 0.13 82 / 0.18), transparent 70%)",
            }}
          />

          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {isFeaturedCourse(course) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground shadow-[0_10px_30px_-12px_oklch(0.82_0.13_82_/_0.8)]">
                <Crown className="h-3 w-3" />
                Legacy · Começa aqui
              </span>
            )}
            {isSoon ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary backdrop-blur-md">
                <Lock className="h-3 w-3" />
                Em breve
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white backdrop-blur-md">
                <Clock className="h-3 w-3" />
                {computeCourseDuration(course)}
              </span>
            )}
          </div>

          {!isSoon && (
            <div className="absolute right-3 top-3 flex h-10 w-10 translate-y-1 items-center justify-center rounded-full bg-primary opacity-0 shadow-[0_10px_30px_-8px_oklch(0.82_0.13_82_/_0.7)] transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
              <Play className="h-4 w-4 fill-primary-foreground text-primary-foreground" />
            </div>
          )}

          {/* progress */}
          {!isSoon && course.progress > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/40">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.round(course.progress * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="min-h-[52px]">
            <h3 className="type-card text-foreground line-clamp-2">
              {course.title}
            </h3>
            {expert && (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                Especialista:{" "}
                <span className="text-foreground">{expert.name}</span>
              </p>
            )}
          </div>


          <div className="flex items-center justify-between gap-2 pt-1">
            {expert && <ExpertAvatar expert={expert} size="sm" asLink={false} />}
            {isSoon ? (
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
                {formatCourseRelease(course)}
              </span>
            ) : course.progress >= 1 ? (
              <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
                Concluído
              </span>
            ) : course.progress > 0 ? (
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
                {Math.round(course.progress * 100)}% · a meio
              </span>
            ) : (
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Novo
              </span>
            )}
          </div>

        </div>
      </Link>
    </motion.div>
  );
}

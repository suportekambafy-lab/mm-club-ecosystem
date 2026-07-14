import { Link } from "@tanstack/react-router";
import { Play, Clock, Lock } from "lucide-react";
import type { Course } from "@/data/types";
import { expertsById } from "@/data/experts";
import { ExpertAvatar } from "./expert-avatar";
import { cn } from "@/lib/utils";

interface Props {
  course: Course;
  className?: string;
  variant?: "default" | "wide";
}

export function CourseCard({ course, className, variant = "default" }: Props) {
  const expert = expertsById[course.expertId];
  const isSoon = course.status === "coming-soon";
  const isWide = variant === "wide";
  const firstLesson = course.modules?.[0]?.lessons?.[0];
  const linkProps = firstLesson && course.progress > 0
    ? {
        to: "/academia/$courseId/$lessonId" as const,
        params: { courseId: course.id, lessonId: firstLesson.id },
      }
    : { to: "/academia/$courseId" as const, params: { courseId: course.id } };

  return (
    <Link
      {...linkProps}
      disabled={isSoon}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl bg-surface-1 ring-1 ring-border transition-all duration-300",
        !isSoon && "hover:ring-[color:var(--hairline)] hover:-translate-y-0.5",
        isSoon && "cursor-default opacity-95",
        isWide ? "min-w-[420px]" : "min-w-[280px]",
        className,
      )}
    >
      {/* Cover */}
      <div
        className={cn(
          "relative overflow-hidden",
          isWide ? "aspect-[16/8]" : "aspect-[16/10]",
        )}
        style={{ background: course.cover }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {isSoon ? (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary backdrop-blur-sm">
            <Lock className="h-3 w-3" />
            Em breve
          </div>
        ) : (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
            <Clock className="h-3 w-3" />
            {course.duration}
          </div>
        )}

        {!isSoon && (
          <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary opacity-0 shadow-lg transition-opacity duration-300 group-hover:opacity-100">
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
          <h3 className="font-display text-base leading-tight text-foreground line-clamp-2">
            {course.title}
          </h3>
          {expert && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              Especialista: <span className="text-foreground">{expert.name}</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          {expert && <ExpertAvatar expert={expert} size="sm" asLink={false} />}
          {isSoon ? (
            <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
              {course.releaseLabel ?? "Em breve"}
            </span>
          ) : course.progress > 0 ? (
            <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
              {Math.round(course.progress * 100)}%
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

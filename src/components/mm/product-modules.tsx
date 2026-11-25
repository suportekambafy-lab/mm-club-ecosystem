import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Lock, Play } from "lucide-react";
import { courses as allCourses, formatCourseRelease } from "@/data/courses";
import { useUserProgress } from "@/hooks/use-user-progress";
import { useCourseAccess } from "@/hooks/use-course-release";
import { useClubProducts } from "@/hooks/use-club-products";
import { useActiveProduct } from "@/hooks/use-active-product";
import { clubProduct, productOfCourse } from "@/lib/club/products";
import { sortCatalog } from "@/lib/course-order";
import type { Course } from "@/data/types";
import type { ProgressByCourse } from "@/hooks/use-user-progress";
import { courseCoverBackground } from "@/lib/course-cover";
export function CourseModules({ course, progress, openable, query }: { course: Course; progress: ProgressByCourse; openable: boolean; query: string }) {
  const q = query.trim().toLowerCase();
  const done = progress[course.id]?.completedLessons;
  const modules = (course.modules ?? []).filter((m) => m.lessons.length > 0).filter((m) =>
    !q || m.title.toLowerCase().includes(q) || m.lessons.some((l) => l.title.toLowerCase().includes(q)),
  );
  if (modules.length === 0) return null;
  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-end justify-end gap-3 px-1 empty:hidden">
        {!openable && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {formatCourseRelease(course) ?? "Em breve"}
          </span>
        )}
      </div>
      <div className={"grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 " + (openable ? "" : "opacity-60")}>
        {modules.map((m, i) => {
          const completed = m.lessons.filter((l) => done?.has(l.id)).length;
          const next = m.lessons.find((l) => !done?.has(l.id)) ?? m.lessons[0]!;
          const pct = Math.round((completed / m.lessons.length) * 100);
          const bg = m.cover
            ? (/^(https?:|\/)/.test(m.cover) ? `url(${m.cover}) center/cover no-repeat` : m.cover)
            : courseCoverBackground(course);
          const body = (
            <>
              <div className="relative aspect-[16/9] overflow-hidden" style={{ background: bg }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white backdrop-blur-md">
                  Módulo {i + 1}
                </span>
                <div className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary opacity-0 transition group-hover:opacity-100">
                  {openable ? <Play className="h-4 w-4 fill-primary-foreground text-primary-foreground" /> : <Lock className="h-4 w-4 text-primary-foreground" />}
                </div>
                {pct > 0 && (
                  <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/40">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="line-clamp-2 text-sm font-medium text-foreground">{m.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {completed > 0 && completed < m.lessons.length ? <>A seguir: <span className="text-foreground">{next.title}</span></> : `${m.lessons.length} aulas`}
                </p>
                {pct > 0 && <p className="mt-auto text-[10px] uppercase tracking-widest text-primary">{completed}/{m.lessons.length} concluídas</p>}
              </div>
            </>
          );
          const cls = "group flex flex-col overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-primary/60";
          return openable ? (
            <Link key={m.id} to="/academia/$courseId/$lessonId" params={{ courseId: course.id, lessonId: next.id }} className={cls}>{body}</Link>
          ) : (
            <div key={m.id} className={cls}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}

/** Módulos do produto ativo — usado na página inicial. */
export function ActiveProductModules() {
  const [active] = useActiveProduct();
  const { progress, loaded } = useUserProgress();
  const { canOpen } = useCourseAccess();
  const { ready, isUnlocked } = useClubProducts();
  if (!loaded || !ready) return null;
  const product = clubProduct(active);
  const list = sortCatalog(allCourses.filter((c) => productOfCourse(c) === active));
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="type-eyebrow text-primary">Academia · {product.name}</p>
          <h2 className="type-section mt-1.5 text-foreground">Os teus módulos</h2>
        </div>
        <Link to="/academia" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
          Ver tudo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {!isUnlocked(active) ? (
        <a href={`/pagar/${product.checkoutCode}`} className="surface-card flex items-center gap-3 p-5 text-sm text-foreground hover:border-primary/50">
          <Lock className="h-4 w-4 text-primary" /> {product.name} está trancado · Desbloquear por {product.priceEur} €
        </a>
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface-1 px-6 py-8 text-center text-sm text-muted-foreground">Conteúdos a chegar em breve.</p>
      ) : (
        list.map((c) => <CourseModules key={c.id} course={c} progress={progress} openable={canOpen(c)} query="" />)
      )}
    </section>
  );
}

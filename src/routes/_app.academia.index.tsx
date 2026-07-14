import { createFileRoute, Link } from "@tanstack/react-router";
import { CourseCard } from "@/components/mm/course-card";
import { Rail } from "@/components/mm/rail";
import { SectionHeading } from "@/components/mm/section-heading";
import { courses, liveCourses, upcomingCourses } from "@/data/courses";
import type { Course, ObjectiveId } from "@/data/types";
import { Lock } from "lucide-react";
import { expertsById } from "@/data/experts";

export const Route = createFileRoute("/_app/academia/")({
  head: () => ({
    meta: [
      { title: "Academia — MM Club" },
      {
        name: "description",
        content:
          "Cursos do MM Club organizados em jornada: continua a aprender, recomendado, criar negócio, IA, marketing, escalar e liderança.",
      },
    ],
  }),
  component: AcademiaPage,
});

function byObjective(id: ObjectiveId): Course[] {
  return liveCourses.filter((c) => c.objectiveId === id);
}

function AcademiaPage() {
  const continuing = liveCourses.filter((c) => c.progress > 0 && c.progress < 1);
  const recommended = liveCourses.filter((c) => c.progress === 0).slice(0, 6);

  const rails: Array<{ title: string; subtitle: string; courses: Course[] }> = [
    ...(continuing.length
      ? [
          {
            title: "Continua a aprender",
            subtitle: "Onde ficaste.",
            courses: continuing,
          },
        ]
      : []),
    {
      title: "Recomendado para ti",
      subtitle: "Curadoria personalizada.",
      courses: recommended,
    },
    {
      title: "Criar Negócio",
      subtitle: "Do posicionamento à primeira venda.",
      courses: byObjective("criar-negocio"),
    },
    {
      title: "Inteligência Artificial",
      subtitle: "IA aplicada ao teu dia-a-dia.",
      courses: byObjective("ia"),
    },
    {
      title: "Marketing",
      subtitle: "Copy, criativos e aquisição.",
      courses: byObjective("marketing"),
    },
    {
      title: "Escalar",
      subtitle: "Operações, agência e delivery.",
      courses: byObjective("escalar"),
    },
    {
      title: "Liderança e Performance",
      subtitle: "Equipa, foco e execução.",
      courses: byObjective("lideranca-performance"),
    },
  ];

  return (
    <div className="space-y-12">
      <SectionHeading
        eyebrow="Academia"
        title="A tua jornada."
        description="Não é uma lista de cursos. É um percurso de evolução curado para empreendedores exigentes."
      />

      {rails.map(
        (r) =>
          r.courses.length > 0 && (
            <Rail key={r.title} title={r.title} subtitle={r.subtitle}>
              {r.courses.map((c) => (
                <CourseCard key={c.id} course={c} className="w-[300px] shrink-0" />
              ))}
            </Rail>
          ),
      )}

      {/* Em breve */}
      {upcomingCourses.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between px-1">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
                <Lock className="h-3 w-3" /> Em breve
              </div>
              <h2 className="font-display text-xl text-foreground md:text-2xl">
                Próximos lançamentos
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Disponível em breve no MM Club.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingCourses.map((c) => (
              <ComingSoonCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ComingSoonCard({ course }: { course: Course }) {
  const expert = expertsById[course.expertId];
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl bg-surface-1 ring-1 ring-border">
      <div className="aspect-[16/9]" style={{ background: course.cover }}>
        <div className="h-full w-full bg-gradient-to-t from-black/70 to-transparent" />
      </div>
      <div className="flex flex-col gap-2 p-5">
        <div className="inline-flex w-max items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
          <Lock className="h-3 w-3" /> Em breve
        </div>
        <h3 className="font-display text-lg leading-tight text-foreground">
          {course.title}
          {expert && (
            <span className="text-muted-foreground"> — {expert.name}</span>
          )}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {course.description}
        </p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-primary">
          Disponível em breve no MM Club
        </p>
      </div>
    </div>
  );
}

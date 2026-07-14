import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, PlayCircle, UserSquare2, CalendarDays, Radio, Wrench } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { courses } from "@/data/courses";
import { experts } from "@/data/experts";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const cards = [
  { to: "/admin/cursos" as const, label: "Cursos", icon: BookOpen, description: "Editar capa, título, descrição e especialista." },
  { to: "/admin/aulas" as const, label: "Aulas", icon: PlayCircle, description: "Gerir aulas e vídeos (YouTube)." },
  { to: "/admin/lives" as const, label: "Lives", icon: Radio, description: "Sessões ao vivo com especialistas." },
  { to: "/admin/ferramentas" as const, label: "Ferramentas", icon: Wrench, description: "Recursos e prompts para membros." },
];

function AdminDashboard() {
  const totalLessons = courses.reduce((n, c) => n + (c.lessonsCount ?? 0), 0);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Admin"
        title="Backoffice do MM Club."
        description="Plataforma completa para gerir cursos, aulas, especialistas, eventos e recursos."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Cursos" value={courses.length} />
        <Stat label="Aulas" value={totalLessons} />
        <Stat label="Especialistas" value={experts.length} />
        <Stat label="Em breve" value={courses.filter((c) => c.status === "coming-soon").length} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-2xl border border-border bg-surface-1 p-5 transition hover:border-primary/40 hover:bg-surface-2"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
                <Icon className="h-4 w-4" />
              </div>
              <p className="font-display text-base font-semibold text-foreground">{c.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

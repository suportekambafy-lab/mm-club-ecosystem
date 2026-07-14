import { createFileRoute } from "@tanstack/react-router";
import { SectionHeading } from "@/components/mm/section-heading";
import { experts } from "@/data/experts";

export const Route = createFileRoute("/admin/especialistas")({
  component: AdminEspecialistas,
});

function AdminEspecialistas() {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Admin › Especialistas"
        title="Especialistas."
        description="A edição de especialistas é feita dentro de cada curso (em Cursos), garantindo consistência."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {experts.map((e) => (
          <div key={e.id} className="rounded-2xl border border-border bg-surface-1 p-5">
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-[color:var(--hairline)]"
                style={{ background: e.photo }}
              >
                {e.logo && <img src={e.logo} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold text-foreground">
                  {e.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">{e.role}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{e.shortBio}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

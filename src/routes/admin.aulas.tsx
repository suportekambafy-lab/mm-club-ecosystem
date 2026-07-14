import { createFileRoute } from "@tanstack/react-router";
import { SectionHeading } from "@/components/mm/section-heading";
import { courses } from "@/data/courses";

export const Route = createFileRoute("/admin/aulas")({
  component: AdminAulas,
});

function AdminAulas() {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Admin › Aulas"
        title="Aulas e vídeos."
        description="Edita os títulos, duração e links de vídeo (YouTube) de cada aula."
      />

      <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-6 text-sm text-muted-foreground">
        Em breve podes editar aqui cada aula individualmente. Por agora vês a estrutura atual.
      </div>

      <div className="space-y-6">
        {courses.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-surface-1 p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.id}</p>
            <p className="mt-1 font-display text-lg font-semibold text-foreground">{c.title}</p>

            <div className="mt-4 space-y-4">
              {(c.modules ?? []).map((m) => (
                <div key={m.id}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {m.title}
                  </p>
                  <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-background">
                    {m.lessons.map((l) => (
                      <li key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-foreground">{l.title}</span>
                        <span className="text-xs text-muted-foreground">{l.duration}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {!c.modules?.length && (
                <p className="text-sm text-muted-foreground">Sem módulos definidos.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

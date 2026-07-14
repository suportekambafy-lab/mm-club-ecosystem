import { createFileRoute } from "@tanstack/react-router";
import { SectionHeading } from "@/components/mm/section-heading";

export const Route = createFileRoute("/admin/eventos")({
  component: AdminEventos,
});

function AdminEventos() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Admin › Eventos"
        title="Agenda de eventos."
        description="Gestão da agenda de encontros, workshops e imersões do MM Club."
      />
      <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-8 text-center">
        <p className="text-sm text-muted-foreground">Editor de eventos em breve.</p>
      </div>
    </div>
  );
}

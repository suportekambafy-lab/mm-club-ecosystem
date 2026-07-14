import { createFileRoute } from "@tanstack/react-router";
import { SectionHeading } from "@/components/mm/section-heading";

export const Route = createFileRoute("/admin/lives")({
  component: AdminLives,
});

function AdminLives() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Admin › Lives"
        title="Sessões ao vivo."
        description="Programa e gere as lives com os especialistas do MM Club."
      />
      <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-8 text-center">
        <p className="text-sm text-muted-foreground">Editor de lives em breve.</p>
      </div>
    </div>
  );
}

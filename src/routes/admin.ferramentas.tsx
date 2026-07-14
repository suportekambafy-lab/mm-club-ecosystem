import { createFileRoute } from "@tanstack/react-router";
import { SectionHeading } from "@/components/mm/section-heading";

export const Route = createFileRoute("/admin/ferramentas")({
  component: AdminFerramentas,
});

function AdminFerramentas() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Admin › Ferramentas"
        title="Ferramentas e recursos."
        description="Prompts, templates e utilitários disponibilizados aos membros."
      />
      <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-8 text-center">
        <p className="text-sm text-muted-foreground">Editor de ferramentas em breve.</p>
      </div>
    </div>
  );
}

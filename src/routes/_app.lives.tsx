import { createFileRoute } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";

export const Route = createFileRoute("/_app/lives")({
  head: () => ({
    meta: [
      { title: "Lives — MM Club" },
      {
        name: "description",
        content: "Calendário de lives ao vivo e biblioteca de sessões gravadas.",
      },
    ],
  }),
  component: LivesPage,
});

function LivesPage() {
  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Lives"
        title="O clube em direto."
        description="Sessões semanais com o fundador e especialistas."
      />

      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface-1 px-6 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-[color:var(--hairline)]">
          <Radio className="h-5 w-5" />
        </div>
        <h2 className="font-display text-xl text-foreground md:text-2xl">Em breve</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          As próximas lives serão anunciadas em breve aqui.
        </p>
      </div>
    </div>
  );
}

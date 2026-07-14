import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";

export const Route = createFileRoute("/_app/eventos")({
  head: () => ({
    meta: [
      { title: "Agenda — MM Club" },
      { name: "description", content: "Agenda de eventos, masterclasses e encontros MM Club." },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Agenda"
        title="Eventos do ecossistema."
        description="Masterclasses, encontros presenciais, networking e experiências premium do MM Club."
      />

      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface-1 px-6 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-[color:var(--hairline)]">
          <CalendarDays className="h-5 w-5" />
        </div>
        <h2 className="font-display text-xl text-foreground md:text-2xl">Em breve</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Os próximos eventos do MM Club serão anunciados em breve aqui.
        </p>
      </div>
    </div>
  );
}

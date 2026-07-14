import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Lock, MapPin } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { events } from "@/data/events";
import { currentUser } from "@/data/user";
import { canAccess } from "@/lib/permissions";

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {events.map((event) => {
          const locked = !canAccess(currentUser, event.visibility);
          return (
            <article key={event.id} className="overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border">
              <div className="relative h-44" style={{ background: event.cover }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
                  <CalendarDays className="h-3 w-3" /> {event.type}
                </span>
                {locked && (
                  <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
                    <Lock className="h-3 w-3" /> Premium
                  </span>
                )}
              </div>
              <div className="space-y-4 p-5">
                <div>
                  <h1 className="font-display text-xl text-foreground">{event.title}</h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{event.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" /> {event.date}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {event.location}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={locked}
                  className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {locked ? "Requer Premium" : "Reservar lugar"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { Radio, Clock, Play, Calendar } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { nextLive, upcomingLives, pastLives } from "@/data/lives";
import { expertsById } from "@/data/experts";
import { ExpertAvatar } from "@/components/mm/expert-avatar";
import { formatDistanceToNow, format } from "date-fns";
import { pt } from "date-fns/locale";

const RECORDING_URL = "https://www.youtube.com/watch?v=-alfqFwiI6Y";

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
    <div className="space-y-12">
      <SectionHeading
        eyebrow="Lives"
        title="O clube em direto."
        description="Sessões semanais com o fundador e especialistas. Assiste ao vivo ou revê quando quiseres."
      />

      {nextLive && <NextLiveHero />}

      {upcomingLives.length > 1 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            Próximas lives
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingLives.slice(1).map((l) => {
              const expert = expertsById[l.expertId];
              return (
                <article
                  key={l.id}
                  className="flex flex-col overflow-hidden rounded-xl bg-surface-1 ring-1 ring-border"
                >
                  <div className="h-32" style={{ background: l.cover }} />
                  <div className="flex flex-col gap-3 p-5">
                    <span className="inline-flex w-max items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(l.startsAt), "d MMM · HH'h'mm", { locale: pt })}
                    </span>
                    <h3 className="font-display text-base leading-tight text-foreground">
                      {l.title}
                    </h3>
                    {expert && <ExpertAvatar expert={expert} size="sm" showName />}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-display text-xl text-foreground md:text-2xl">
          Biblioteca de lives
        </h2>
        <p className="text-sm text-muted-foreground">
          Todas as lives passadas, para reveres quando quiseres.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pastLives.map((l) => {
            const expert = expertsById[l.expertId];
            return (
              <article
                key={l.id}
                className="group flex flex-col overflow-hidden rounded-xl bg-surface-1 ring-1 ring-border transition hover:ring-[color:var(--hairline)]"
              >
                <div className="relative h-40" style={{ background: l.cover }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <a
                    href={RECORDING_URL}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Ver gravação: ${l.title}`}
                    className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-xl">
                      <Play className="h-5 w-5 fill-primary-foreground text-primary-foreground" />
                    </span>
                  </a>
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                    <Clock className="h-3 w-3" /> {l.duration}
                  </span>
                </div>
                <div className="flex flex-col gap-3 p-5">
                  <h3 className="font-display text-base leading-tight text-foreground line-clamp-2">
                    {l.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    {expert && <ExpertAvatar expert={expert} size="sm" showName />}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(l.startsAt), { locale: pt, addSuffix: true })}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function NextLiveHero() {
  if (!nextLive) return null;
  const expert = expertsById[nextLive.expertId];
  return (
    <section
      className="relative overflow-hidden rounded-2xl ring-1 ring-border"
      style={{ background: nextLive.cover }}
    >
      <div className="bg-gradient-to-tr from-black/85 via-black/50 to-transparent p-8 md:p-12">
        <div className="max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary backdrop-blur-sm">
            <Radio className="h-3 w-3" /> Próxima live
          </span>
          <h2 className="font-display text-3xl leading-tight text-white md:text-4xl">
            {nextLive.title}
          </h2>
          <p className="text-sm text-white/80">
            {format(new Date(nextLive.startsAt), "EEEE, d 'de' MMMM 'às' HH'h'mm", { locale: pt })}
            {" · "}
            {formatDistanceToNow(new Date(nextLive.startsAt), { locale: pt, addSuffix: true })}
          </p>
          {expert && (
            <div className="pt-2">
              <ExpertAvatar expert={expert} showName showRole />
            </div>
          )}
          <div className="flex flex-wrap gap-3 pt-4">
            <a
              href={buildCalendarUrl()}
              download="mm-club-live.ics"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft"
            >
              <Calendar className="h-4 w-4" /> Adicionar ao calendário
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildCalendarUrl() {
  if (!nextLive) return "#";
  const start = new Date(nextLive.startsAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MM Club//Lives//PT",
    "BEGIN:VEVENT",
    `UID:${nextLive.id}@mmclub.pt`,
    `DTSTAMP:${stamp(start)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${nextLive.title}`,
    "DESCRIPTION:Live MM Club",
    "LOCATION:Online",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, CalendarDays, Lock, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionHeading } from "@/components/mm/section-heading";
import { listLivesAuthed as listLives } from "@/lib/lives.functions";
import { LiveHeroBanner } from "@/components/mm/live-hero-banner";
import { expertsById } from "@/data/experts";
import { cn } from "@/lib/utils";
import { LiveCountdown } from "@/components/mm/live-countdown";
import { resolveLiveCoverUrl } from "@/lib/live-cover-url";
import { supabase } from "@/integrations/supabase/client";

type Live = Awaited<ReturnType<typeof listLives>>[number];

export const Route = createFileRoute("/_app/lives/")({
  loader: () => listLives(),
  head: () => ({
    meta: [
      { title: "Lives — MM Club" },
      { name: "description", content: "Sessões ao vivo e replays exclusivos do MM Club." },
    ],
  }),
  component: LivesPage,
});

function LivesPage() {
  const initial = Route.useLoaderData();
  const [lives, setLives] = useState<Live[]>(initial);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const refreshLives = () => {
      listLives()
        .then((r) => setLives(r as Live[]))
        .catch(() => {});
    };
    const channel = supabase
      .channel("lives-index-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lives" }, refreshLives)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const liveNow = lives.filter((l) => l.status === "live");
  const upcoming = lives
    .filter((l) => l.status === "scheduled" && new Date(l.starts_at).getTime() > now - 3600_000)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const recordings = lives.filter((l) => l.status === "ended" || l.status === "published");

  const featured = liveNow[0] ?? upcoming[0] ?? null;
  const upcomingRest = featured && upcoming[0]?.id === featured.id ? upcoming.slice(1) : upcoming;

  return (
    <div className="space-y-14">
      <SectionHeading
        title="O clube em direto."
        description="Um palco privado com o fundador e os especialistas MM. Ao vivo, sem ruído e sempre disponível como replay."
      />

      {featured ? <LiveHeroBanner live={featured} /> : <EmptyHero />}

      {upcomingRest.length > 0 && (
        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Agenda</p>
              <h2 className="mt-1 font-display text-2xl text-foreground">Próximas sessões</h2>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {upcomingRest.map((l) => (
              <LiveCard key={l.id} live={l} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Arquivo</p>
            <h2 className="mt-1 font-display text-2xl text-foreground">Replays</h2>
          </div>
          <p className="hidden text-xs text-muted-foreground md:block">
            Todas as sessões passadas ficam disponíveis para membros.
          </p>
        </div>
        {recordings.length === 0 ? (
          <EmptyState label="Ainda não existem replays publicados." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {recordings.map((l) => (
              <LiveCard key={l.id} live={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyHero() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface-1 via-surface-1 to-surface-2/30 p-10 md:p-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,oklch(0.55_0.12_60_/_0.15),transparent_60%)]" />
      <div className="relative flex flex-col items-start gap-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary ring-1 ring-primary/30">
          Próxima sessão em breve
        </span>
        <h2 className="max-w-2xl font-display text-3xl leading-tight text-foreground md:text-5xl">
          Sem sessões agendadas de momento.
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground md:text-base">
          A curadoria de sessões MM Club é anunciada com antecedência aqui e no dashboard.
          Consulta o arquivo de replays abaixo ou volta em breve.
        </p>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-surface-1 px-6 py-14 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Radio className="h-4 w-4" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function LiveCard({ live }: { live: Live }) {
  const date = new Date(live.starts_at);
  const dateStr = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const isReplay = live.status === "published" || live.status === "ended";
  const isUpcoming = live.status === "scheduled" && date.getTime() > Date.now();
  const expert = live.expert_id ? expertsById[live.expert_id] : undefined;
  const coverUrl = resolveLiveCoverUrl(live.cover_url);

  return (
    <Link
      to="/lives/$liveId"
      params={{ liveId: live.id }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface-1 transition",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]",
      )}
    >
      <div
        className="relative aspect-video w-full"
        style={
          coverUrl
            ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "linear-gradient(135deg, oklch(0.55 0.12 60), oklch(0.15 0.03 60))" }
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {isReplay && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white backdrop-blur">
            <PlayCircle className="h-3 w-3" /> Replay
          </span>
        )}
        {isUpcoming && (
          <div className="absolute left-3 top-3">
            <LiveCountdown startsAt={live.starts_at} />
          </div>
        )}
        {live.visibility !== "public" && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] uppercase tracking-widest text-white backdrop-blur">
            <Lock className="h-3 w-3" />
            {live.visibility === "premium" ? "Premium" : "Clube"}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-display text-lg leading-snug text-foreground group-hover:text-primary">
          {live.title}
        </h3>
        {expert && (
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 shrink-0 rounded-full ring-1 ring-border"
              style={
                expert.logo
                  ? { backgroundImage: `url(${expert.logo})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { background: expert.photo }
              }
            />
            <p className="text-xs text-muted-foreground">{expert.name}</p>
          </div>
        )}
        <div className="mt-auto flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          <span>{dateStr}</span>
        </div>
      </div>
    </Link>
  );
}

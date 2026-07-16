import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, CalendarDays, Lock, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionHeading } from "@/components/mm/section-heading";
import { listLives } from "@/lib/lives.functions";
import { cn } from "@/lib/utils";

type Live = Awaited<ReturnType<typeof listLives>>[number];

export const Route = createFileRoute("/_app/lives")({
  loader: () => listLives(),
  head: () => ({
    meta: [
      { title: "Lives — MM Club" },
      { name: "description", content: "Sessões ao vivo e gravações do MM Club." },
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
    // Poll every 30s to reflect status transitions during a broadcast.
    const t = setInterval(() => {
      listLives().then((r) => setLives(r as Live[])).catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const liveNow = lives.filter((l) => l.status === "live");
  const upcoming = lives.filter(
    (l) => l.status === "scheduled" && new Date(l.starts_at).getTime() > now - 3600_000,
  );
  const recordings = lives.filter((l) => l.status === "ended" || l.status === "published");

  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Lives"
        title="O clube em direto."
        description="Sessões ao vivo com o fundador e especialistas, mais o arquivo completo de gravações."
      />

      {liveNow.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg text-foreground">A decorrer agora</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {liveNow.map((l) => (
              <LiveCard key={l.id} live={l} isLive />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 font-display text-lg text-foreground">Próximas</h2>
        {upcoming.length === 0 ? (
          <EmptyState label="Sem lives agendadas por agora." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((l) => (
              <LiveCard key={l.id} live={l} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg text-foreground">Gravações</h2>
        {recordings.length === 0 ? (
          <EmptyState label="Ainda não existem gravações publicadas." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recordings.map((l) => (
              <LiveCard key={l.id} live={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface-1 px-6 py-14 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Radio className="h-4 w-4" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function LiveCard({ live, isLive }: { live: Live; isLive?: boolean }) {
  const date = new Date(live.starts_at);
  const dateStr = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const cover =
    live.cover_url ??
    "linear-gradient(135deg, oklch(0.55 0.12 60), oklch(0.15 0.03 60))";
  return (
    <Link
      to="/lives/$liveId"
      params={{ liveId: live.id }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-1 transition hover:border-primary/40",
      )}
    >
      <div
        className="relative aspect-video w-full"
        style={
          live.cover_url
            ? { backgroundImage: `url(${live.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: cover }
        }
      >
        {isLive && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-500/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Ao vivo
          </span>
        )}
        {live.status === "published" && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
            <PlayCircle className="h-3 w-3" /> Gravação
          </span>
        )}
        {live.visibility !== "public" && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] uppercase tracking-widest text-white">
            <Lock className="h-3 w-3" />
            {live.visibility === "premium" ? "Premium" : "Clube"}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-base leading-snug text-foreground">{live.title}</h3>
        <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{dateStr}</span>
          <span>· {live.duration_minutes}m</span>
        </div>
      </div>
    </Link>
  );
}

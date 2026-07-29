import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, Calendar, ArrowRight, Users } from "lucide-react";
import { listLivesAuthed } from "@/lib/lives.functions";
import { resolveLiveCoverUrl } from "@/lib/live-cover-url";
import { expertsById } from "@/data/experts";
import { cn } from "@/lib/utils";

type Live = Awaited<ReturnType<typeof listLivesAuthed>>[number];

function useCountdownLabel(iso: string | undefined) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!iso) return;
    const tick = () => {
      const diff = new Date(iso).getTime() - Date.now();
      if (diff <= 0) return setLabel("a começar");
      const m = Math.floor(diff / 60000);
      if (m < 60) return setLabel(`começa em ${m} min`);
      const h = Math.floor(m / 60);
      if (h < 24) return setLabel(`começa em ${h}h`);
      setLabel(`daqui a ${Math.floor(h / 24)} dias`);
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [iso]);
  return label;
}

/**
 * Contextual card at the top of Comunidade: shows the on-air live when there
 * is one, otherwise the next scheduled session. Renders nothing when idle.
 */
export function CommunitySpotlight({ enabled = true }: { enabled?: boolean }) {
  const q = useQuery({
    queryKey: ["community", "spotlight-lives"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => (await listLivesAuthed()) as Live[],
  });

  const list = q.data ?? [];
  const onAir = list.find((l) => l.status === "live");
  const upcoming = list
    .filter(
      (l) =>
        l.status === "scheduled" &&
        new Date(l.starts_at).getTime() > Date.now() - 3_600_000,
    )
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];

  const live = onAir ?? upcoming;
  const countdown = useCountdownLabel(live?.starts_at);

  if (!live) return null;

  const isLive = Boolean(onAir);
  const expert = live.expert_id ? expertsById[live.expert_id] : undefined;
  const cover = resolveLiveCoverUrl(live.cover_url);
  const when = new Date(live.starts_at);
  const dayLabel = when.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
  const timeLabel = when.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  const isToday = when.toDateString() === new Date().toDateString();

  const to = live.mode === "interactive" && isLive ? "/lives/$liveId/sala" : "/lives/$liveId";

  return (
    <Link
      to={to}
      params={{ liveId: live.id }}
      className={cn(
        "group flex items-center gap-3 overflow-hidden rounded-xl border bg-surface-1 p-2.5 transition",
        isLive
          ? "border-destructive/35 hover:border-destructive/60"
          : "border-border hover:border-primary/40",
      )}
    >
      {cover && (
        <img
          src={cover}
          alt=""
          width={64}
          height={44}
          decoding="async"
          fetchPriority="high"
          className="h-11 w-16 shrink-0 rounded-lg bg-muted object-cover"
        />
      )}

      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]",
            isLive
              ? "bg-destructive/20 text-destructive"
              : "bg-primary/12 text-primary",
          )}
        >
          {isLive ? (
            <>
              <span className="h-1 w-1 animate-pulse rounded-full bg-destructive" />
              Em direto
            </>
          ) : (
            <>
              <Calendar className="h-2.5 w-2.5" />
              {isToday ? `Hoje · ${timeLabel}` : `${dayLabel} · ${timeLabel}`}
            </>
          )}
        </span>
        <p className="truncate text-sm font-medium leading-tight text-foreground">
          {live.title}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {expert?.name ? `${expert.name} · ` : ""}
          {isLive ? "a decorrer agora" : countdown}
        </p>
      </div>

      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
          isLive
            ? "bg-primary text-primary-foreground group-hover:brightness-110"
            : "border border-border text-foreground group-hover:border-primary/50",
        )}
      >
        {isLive ? <Radio className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
        <span className="hidden xs:inline sm:inline">{isLive ? "Entrar" : "Ver"}</span>
      </span>
    </Link>
  );
}



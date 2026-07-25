import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  CalendarDays,
  Clock,
  Users,
  Radio,
  Play,
  FileText,
  Sparkles,
  Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLive } from "@/lib/lives.functions";
import { LivePlayer } from "@/components/mm/live-player";
import { LiveChat } from "@/components/mm/live-chat";
import { useLivePresence } from "@/hooks/use-live-presence";
import { expertsById } from "@/data/experts";
import { cn } from "@/lib/utils";
import { resolveLiveCoverUrl } from "@/lib/live-cover-url";

export const Route = createFileRoute("/_app/lives/$liveId")({
  loader: async ({ params }) => {
    try {
      return await getLive({ data: { id: params.liveId } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.live.title} — MM Club` },
          { name: "description", content: loaderData.live.description ?? "Sessão ao vivo do MM Club." },
        ]
      : [{ title: "Live — MM Club" }],
  }),
  component: LiveDetail,
});

type LoaderData = Awaited<ReturnType<typeof getLive>>;

function LiveDetail() {
  const initial = Route.useLoaderData();
  const [data, setData] = useState<LoaderData>(initial);
  const [userId, setUserId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(() => diff(initial.live.starts_at));
  const [elapsed, setElapsed] = useState<number>(0);
  const [materialsOpen, setMaterialsOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        setUserId(null);
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        const nextUserId = s?.user?.id ?? null;
        if (!nextUserId) return;
        setUserId((current) => (current === nextUserId ? current : nextUserId));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Countdown while scheduled
  useEffect(() => {
    if (data.live.status !== "scheduled") return;
    const t = setInterval(() => setCountdown(diff(data.live.starts_at)), 1000);
    return () => clearInterval(t);
  }, [data.live.starts_at, data.live.status]);

  // Elapsed time while live — use the server-persisted started_at so the
  // timer stays accurate across host reloads and reconnections.
  useEffect(() => {
    if (data.live.status !== "live") return;
    const startedAt = new Date(data.live.started_at ?? data.live.starts_at).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data.live.started_at, data.live.starts_at, data.live.status]);

  // Auto-refresh: react to postgres row changes AND to visibility/online
  // transitions so the viewer resumes seamlessly after the host reloads,
  // loses connection, or the user switches back from another tab.
  useEffect(() => {
    let inFlight = false;
    const refreshLive = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const fresh = await getLive({ data: { id: data.live.id } });
        setData(fresh);
      } catch {
        /* ignore transient errors */
      } finally {
        inFlight = false;
      }
    };
    const channel = supabase
      .channel(`live-detail-${data.live.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lives", filter: `id=eq.${data.live.id}` },
        refreshLive,
      )
      .subscribe();

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshLive();
    };
    const onOnline = () => refreshLive();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [data.live.id]);

  // Immersive layout: hide the app's mobile tabbar so it can never overlap
  // the chat composer or push the video off-screen when the keyboard opens.
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-live-immersive", "1");
    return () => el.removeAttribute("data-live-immersive");
  }, []);

  const { live, playbackToken, videoUid, actualDurationSeconds } = data;
  const isLive = live.status === "live";
  const isReplay = live.status === "ended" || live.status === "published";
  const expert = live.expert_id ? expertsById[live.expert_id] : undefined;

  const presenceCount = useLivePresence(isLive ? live.id : null, userId);

  const dateStr = new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(live.starts_at));

  const visibilityLabel =
    live.visibility === "public" ? "Aberta" : live.visibility === "premium" ? "Premium" : "MM Club";

  const statusChips = (
    <>
      {isLive && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-red-500/30">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Ao vivo
        </span>
      )}
      {isReplay && (
        <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
          <Play className="h-3 w-3" />
          Replay
        </span>
      )}
      {isLive && (
        <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
          <Users className="h-3 w-3" />
          {presenceCount}
        </span>
      )}
      {isLive && (
        <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur tabular-nums">
          <Clock className="h-3 w-3" />
          {formatElapsed(elapsed)}
        </span>
      )}
    </>
  );

  const playerSlot =
    (isLive || isReplay) && videoUid ? (
      <LivePlayer
        key={`gen-${live.stream_generation ?? 0}`}
        videoUid={videoUid}
        playbackToken={playbackToken}
        live={isLive}
      />
    ) : isReplay ? (
      <NoReplayPoster live={live} />
    ) : (
      <PrelivePoster live={live} countdown={countdown} />
    );

  return (
    <div
      className="
        -mx-4 flex flex-col lg:mx-0 lg:block
        h-[calc(100dvh-var(--app-topbar-h,4rem))]
        lg:h-auto lg:space-y-8
      "
      style={{ "--app-topbar-h": "4rem" } as React.CSSProperties}
    >
      {/* Back link — desktop only (mobile keeps every pixel for the stream) */}
      <Link
        to="/lives"
        className="hidden lg:inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar às Lives
      </Link>

      {/* -------- MOBILE LAYOUT (locked height, only chat flexes) -------- */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        {/* Sticky video */}
        <div className="relative shrink-0 bg-black">
          {playerSlot}
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
            {statusChips}
          </div>
        </div>

        {/* Compact session header */}
        <div className="shrink-0 border-b border-border bg-background/95 px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Radio className="h-3 w-3 text-primary" />
            <span>Sessão MM Club</span>
            <span>·</span>
            <Lock className="h-3 w-3" />
            <span>{visibilityLabel}</span>
          </div>
          <h1 className="mt-1 truncate font-display text-xl leading-tight text-foreground">
            {live.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {dateStr}
            </span>
            {isReplay && actualDurationSeconds && actualDurationSeconds > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(actualDurationSeconds)}
              </span>
            )}
          </div>

          {/* Collapsible materials */}
          <button
            type="button"
            onClick={() => setMaterialsOpen((v) => !v)}
            aria-expanded={materialsOpen}
            className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface-1/60 px-3 py-1.5 text-left transition active:scale-[0.99]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate text-xs font-medium text-foreground">
                Materiais da sessão
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                materialsOpen && "rotate-180",
              )}
            />
          </button>
          {materialsOpen && (
            <p className="mt-2 rounded-xl border border-dashed border-border bg-surface-1/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              {isReplay
                ? "Os recursos partilhados durante a sessão aparecerão aqui em breve."
                : "Slides, links e recursos serão disponibilizados aqui após a sessão."}
            </p>
          )}
        </div>

        {/* Chat fills remaining space — only this region reflows with keyboard */}
        <div
          className="min-h-0 flex-1 p-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
        >
          <LiveChat liveId={live.id} currentUserId={userId} readOnly={isReplay} />
        </div>
      </div>

      {/* -------- DESKTOP LAYOUT (unchanged split) -------- */}
      <div className="hidden lg:grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <div className="relative">
            {playerSlot}
            {(isLive || isReplay) && (
              <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap items-center gap-2">
                {statusChips}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-gradient-to-br from-surface-1 to-surface-2/40 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Radio className="h-3 w-3 text-primary" />
                Sessão MM Club
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {visibilityLabel}
              </span>
            </div>

            <h1 className="mt-3 font-display text-3xl leading-tight text-foreground md:text-4xl">
              {live.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {dateStr}
              </span>
              {isReplay && actualDurationSeconds && actualDurationSeconds > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(actualDurationSeconds)}
                </span>
              )}
            </div>

            {live.description && (
              <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground md:text-base">
                {live.description}
              </p>
            )}
          </div>

          {expert && (
            <Link
              to="/especialistas/$expertId"
              params={{ expertId: expert.id }}
              className="group flex items-center gap-5 rounded-3xl border border-border bg-surface-1 p-5 transition hover:border-primary/40 md:p-6"
            >
              <div
                className="h-16 w-16 shrink-0 rounded-2xl ring-1 ring-border md:h-20 md:w-20"
                style={
                  expert.logo
                    ? {
                        backgroundImage: `url(${expert.logo})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : { background: expert.photo }
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Conduzido por</p>
                <p className="mt-1 font-display text-lg text-foreground md:text-xl">{expert.name}</p>
                <p className="text-xs text-muted-foreground md:text-sm">{expert.role}</p>
                {expert.shortBio && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground/80 md:text-sm">
                    {expert.shortBio}
                  </p>
                )}
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 rotate-180 text-muted-foreground transition group-hover:text-primary" />
            </Link>
          )}

          <details className="group rounded-3xl border border-dashed border-border bg-surface-1/50 p-5 open:bg-surface-1/70">
            <summary className="flex cursor-pointer items-center gap-3 list-none">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm text-foreground">Materiais da sessão</p>
                <p className="text-xs text-muted-foreground">
                  Slides, links e recursos disponibilizados após a sessão.
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="mt-4 rounded-xl bg-surface-2/40 px-4 py-3 text-xs text-muted-foreground">
              {isReplay
                ? "Os recursos partilhados durante a sessão aparecerão aqui em breve."
                : "Ainda sem recursos para esta sessão."}
            </p>
          </details>
        </div>

        <aside className="xl:sticky xl:top-24 xl:h-[calc(100dvh-8rem)]">
          <LiveChat liveId={live.id} currentUserId={userId} readOnly={isReplay} />
        </aside>
      </div>
    </div>
  );
}

function PrelivePoster({
  live,
  countdown,
}: {
  live: LoaderData["live"];
  countdown: string | null;
}) {
  const cover = resolveLiveCoverUrl(live.cover_url);
  return (
    <div
      className="relative aspect-video w-full overflow-hidden bg-black shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] lg:rounded-3xl lg:border lg:border-border"
      style={
        cover
          ? {
              backgroundImage: `url(${cover})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/90" />
      <div className="relative flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary ring-1 ring-primary/30">
          <Sparkles className="h-3 w-3" />
          Em breve
        </span>
        {countdown ? (
          <>
            <h2 className="font-display text-xl text-white md:text-3xl">A sessão começa em</h2>
            <p className="font-mono text-3xl font-semibold tracking-widest text-white md:text-6xl">
              {countdown}
            </p>
          </>
        ) : (
          <h2 className="font-display text-xl text-white md:text-3xl">Começamos em breve</h2>
        )}
      </div>
    </div>
  );
}

function NoReplayPoster({ live }: { live: LoaderData["live"] }) {
  const cover = resolveLiveCoverUrl(live.cover_url);
  return (
    <div
      className="relative aspect-video w-full overflow-hidden bg-black shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] lg:rounded-3xl lg:border lg:border-border"
      style={
        cover
          ? {
              backgroundImage: `url(${cover})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/75 to-black/90" />
      <div className="relative flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 ring-1 ring-white/15">
          <Lock className="h-3 w-3" />
          Sem gravação
        </span>
        <h2 className="font-display text-xl text-white md:text-3xl">Este direto não ficou gravado</h2>
        <p className="max-w-md text-sm text-white/70">
          A sessão terminou sem uma gravação disponível. Fica atento aos próximos diretos.
        </p>
      </div>
    </div>
  );
}

function diff(iso: string): string | null {
  const t = new Date(iso).getTime() - Date.now();
  if (t <= 0) return null;
  const s = Math.floor(t / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatElapsed(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatDuration(actualSec: number): string {
  if (actualSec < 60) return `${actualSec} s`;
  const m = Math.floor(actualSec / 60);
  const s = actualSec % 60;
  if (m < 60) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h} h ${rm} min` : `${h} h`;
}

// keep util import (may be used by consumers)
void cn;

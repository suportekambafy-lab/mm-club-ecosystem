import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
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
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLive } from "@/lib/lives.functions";
import { LivePlayer } from "@/components/mm/live-player";
import { ExternalReplayPlayer } from "@/components/mm/external-replay-player";
import { LiveChat } from "@/components/mm/live-chat";
import { useLivePresence } from "@/hooks/use-live-presence";
import { useTicker } from "@/hooks/use-ticker";
import { expertsById } from "@/data/experts";
import { cn } from "@/lib/utils";
import { resolveLiveCoverUrl } from "@/lib/live-cover-url";

export const Route = createFileRoute("/_app/lives/$liveId")({
  loader: async ({ params }) => {
    let result;
    try {
      result = await getLive({ data: { id: params.liveId } });
    } catch {
      throw notFound();
    }
    // Interactive lives always render the Sala Interativa experience —
    // for host, co-host, speakers AND regular viewers. Only permissions
    // and controls differ based on role. Once the live is ended we keep
    // viewers on this route so they see the replay instead of bouncing
    // back into the (now closed) room.
    const liveRow = result.live as { mode?: string; status?: string };
    if (liveRow.mode === "interactive" && liveRow.status !== "ended" && liveRow.status !== "published") {
      throw redirect({ to: "/lives/$liveId/sala", params: { liveId: params.liveId } });
    }
    return result;
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
  const navigate = Route.useNavigate();
  const [data, setData] = useState<LoaderData>(initial);
  const [userId, setUserId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(() => diff(initial.live.starts_at));
  const [elapsed, setElapsed] = useState<number>(0);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const tickerNow = useTicker(1000);

  // If the host flips the live to interactive mode after the viewer landed on
  // the broadcast route, hop over to the Sala Interativa immediately so every
  // participant sees the same experience.
  useEffect(() => {
    const row = data.live as { mode?: string; status?: string };
    if (row.mode === "interactive" && row.status !== "ended" && row.status !== "published") {
      navigate({ to: "/lives/$liveId/sala", params: { liveId: data.live.id }, replace: true });
    }
  }, [data.live, navigate]);


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

  // Countdown while scheduled — usa o relógio central da app
  useEffect(() => {
    if (data.live.status !== "scheduled") return;
    setCountdown(diff(data.live.starts_at));
  }, [data.live.starts_at, data.live.status, tickerNow]);

  // Elapsed time while live — use the server-persisted started_at so the
  // timer stays accurate across host reloads and reconnections.
  useEffect(() => {
    if (data.live.status !== "live") return;
    const startedAt = new Date(data.live.started_at ?? data.live.starts_at).getTime();
    setElapsed(Math.max(0, Math.floor((tickerNow - startedAt) / 1000)));
  }, [data.live.started_at, data.live.starts_at, data.live.status, tickerNow]);

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

  // While the recording is still encoding, poll until it becomes playable so
  // the replay appears without the user refreshing.
  useEffect(() => {
    if (data.replayStatus !== "processing") return;
    const t = setInterval(() => {
      getLive({ data: { id: data.live.id } })
        .then(setData)
        .catch(() => {});
    }, 20000);
    return () => clearInterval(t);
  }, [data.replayStatus, data.live.id]);

  // Immersive layout: hide the app's mobile tabbar so it can never overlap
  // the chat composer or push the video off-screen when the keyboard opens.
  // Also lock the container height to `visualViewport.height` so opening the
  // iOS keyboard never resizes the video area — only the chat reflows.
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-live-immersive", "1");
    const vv = window.visualViewport;
    const measure = () => {
      const h = vv?.height ?? window.innerHeight;
      const header = document.querySelector<HTMLElement>("header[data-app-topbar]");
      const topH = header?.getBoundingClientRect().height ?? 0;
      el.style.setProperty("--live-vh", `${Math.max(0, h - topH)}px`);
      el.style.setProperty("--app-topbar-h", `${topH}px`);
    };
    measure();
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    // Re-measure once after fonts/layout settle
    const t = window.setTimeout(measure, 200);
    return () => {
      el.removeAttribute("data-live-immersive");
      el.style.removeProperty("--live-vh");
      el.style.removeProperty("--app-topbar-h");
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.clearTimeout(t);
    };
  }, []);



  const { live, playbackToken, videoUid, actualDurationSeconds, replaySegments, replayStatus } = data;
  const trimStart = (data as { trimStart?: number | null }).trimStart ?? null;
  const trimEnd = (data as { trimEnd?: number | null }).trimEnd ?? null;
  const isLive = live.status === "live";
  const isReplay = live.status === "ended" || live.status === "published";
  const expert = live.expert_id ? expertsById[live.expert_id] : undefined;

  // Duração fiel ao que o membro consegue ver: desconta o corte inicial e final.
  const displayDurationSeconds = (() => {
    const total = actualDurationSeconds ?? 0;
    if (!total || total <= 0) return null;
    let d = total;
    if (trimStart && trimStart > 0) d -= trimStart;
    if (trimEnd && trimEnd > 0) {
      const segs = replaySegments ?? [];
      const lastDur = segs.length > 0 ? (segs[segs.length - 1]?.duration ?? null) : total;
      if (lastDur && lastDur > trimEnd) d -= lastDur - trimEnd;
    }
    return d > 0 ? Math.round(d) : null;
  })();


  const presenceCount = useLivePresence(isLive ? live.id : null, userId);

  const dateStr = new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(live.starts_at));

  const visibilityLabel =
    live.visibility === "public" ? "Aberta" : live.visibility === "premium" ? "Premium" : "MM Club";

  const overlayStats = (isLive || isReplay) && (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5 sm:p-3">
      {/* Left — live/replay badge */}
      <div className="flex items-center">
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
      </div>

      {/* Right — unified glass pill with presence + elapsed */}
      {isLive && (
        <div className="inline-flex items-center gap-3 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-md ring-1 ring-white/10">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3 opacity-80" />
            {presenceCount}
          </span>
          <span className="h-3 w-px bg-white/20" />
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="h-3 w-3 opacity-80" />
            {formatElapsed(elapsed)}
          </span>
        </div>
      )}
    </div>
  );

  const playerSlot = (mobile?: boolean) =>
    (isLive || isReplay) && videoUid ? (
      <LivePlayer
        key={`gen-${live.stream_generation ?? 0}`}
        videoUid={videoUid}
        playbackToken={playbackToken}
        segments={replaySegments}
        trimStart={trimStart}
        trimEnd={trimEnd}
        progressKey={isReplay ? `${live.id}:${live.stream_generation ?? 0}` : null}

        live={isLive}
        className={mobile ? "aspect-video w-full max-w-full rounded-none shadow-none ring-0" : undefined}
      />

    ) : isReplay ? (
      replayStatus === "unavailable" ? (
        <NoReplayPoster live={live} />
      ) : (
        <ProcessingReplayPoster live={live} />
      )
    ) : (
      <PrelivePoster live={live} countdown={countdown} />
    );


  return (
    <div
      className="
        flex flex-col lg:block
        lg:h-auto lg:space-y-8
      "
      style={
        {
          height: "var(--live-vh, calc(100dvh - var(--app-topbar-h, 4rem)))",
        } as React.CSSProperties
      }
    >
      {/* Back link — desktop only (mobile keeps every pixel for the stream) */}
      <Link
        to="/lives"
        className="hidden lg:inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar às Lives
      </Link>

      {/* -------- MOBILE LAYOUT (fully locked; only the chat list scrolls) -------- */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
        {/* Video — capped so it never overflows the viewport width or height */}
        <div className="relative shrink-0 bg-black">
          <div
            className="relative mx-auto aspect-video overflow-hidden"
            style={{ width: "min(100%, calc(42dvh * 16 / 9))" }}
          >
            {playerSlot(true)}
            {overlayStats}
          </div>
        </div>



        {/* Ultra-compact session header — single title + one meta line */}
        <div className="shrink-0 border-b border-border/60 bg-background/95 px-4 pt-2.5 pb-2">
          <div className="flex items-center gap-2">
            <h1 className="min-w-0 flex-1 truncate font-display text-[17px] leading-tight text-foreground">
              {live.title}
            </h1>
            <button
              type="button"
              onClick={() => setMaterialsOpen((v) => !v)}
              aria-expanded={materialsOpen}
              aria-label="Materiais da sessão"
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border/60 bg-surface-1/60 px-2.5 text-[10px] font-medium text-muted-foreground transition active:scale-[0.97]"
            >
              <FileText className="h-3 w-3 text-primary" />
              Materiais
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  materialsOpen && "rotate-180",
                )}
              />
            </button>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {dateStr}
            </span>
            <span className="opacity-40">•</span>
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" />
              {visibilityLabel}
            </span>
            {isReplay && displayDurationSeconds && displayDurationSeconds > 0 && (
              <>
                <span className="opacity-40">•</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="h-3 w-3" />
                  {formatDuration(displayDurationSeconds)}
                </span>
              </>
            )}
          </div>
          {materialsOpen && (
            <p className="mt-2 rounded-xl border border-dashed border-border bg-surface-1/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              {isReplay
                ? "Os recursos partilhados durante a sessão aparecerão aqui em breve."
                : "Slides, links e recursos serão disponibilizados aqui após a sessão."}
            </p>
          )}
        </div>

        {/* Chat fills remaining space — only the message list scrolls */}
        <div
          className="min-h-0 flex-1 px-2 pt-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
        >
          <LiveChat liveId={live.id} currentUserId={userId} readOnly={isReplay} />
        </div>
      </div>


      {/* -------- DESKTOP LAYOUT (unchanged split) -------- */}
      <div className="hidden lg:grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <div className="relative">
            {playerSlot(false)}
            {overlayStats}
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
              {isReplay && displayDurationSeconds && displayDurationSeconds > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(displayDurationSeconds)}
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

function ProcessingReplayPoster({ live }: { live: LoaderData["live"] }) {
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
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary ring-1 ring-primary/30">
          <Loader2 className="h-3 w-3 animate-spin" />
          A processar
        </span>
        <h2 className="font-display text-xl text-white md:text-3xl">Gravação a ser preparada</h2>
        <p className="max-w-md text-sm text-white/70">
          A sessão terminou e a gravação está a ser processada. Fica disponível aqui dentro de
          alguns minutos — avisamos-te por email quando estiver pronta.
        </p>
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

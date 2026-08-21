/**
 * Dedicated route for the *interactive* live experience (LiveKit Salas).
 *
 * Isolated by design: the broadcast/RTMP viewer at `/lives/$liveId` is
 * untouched. Once the interactive flow is fully validated we can unify
 * both experiences under a single route driven by `lives.mode`.
 */
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, Users, MessageSquare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLive } from "@/lib/lives.functions";
import { joinRoom } from "@/lib/live-room.functions";
// A sala interativa carrega o LiveKit — diferida para não pesar no arranque da app.
const InteractiveRoom = lazy(() =>
  import("@/components/live/interactive-room").then((m) => ({ default: m.InteractiveRoom })),
);
import { PreJoin } from "@/components/live/pre-join";
import { LiveChat } from "@/components/mm/live-chat";
import { MemberAvatar } from "@/components/mm/member-avatar";
import { useAdminIds } from "@/hooks/use-admin-ids";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_app/lives_/$liveId/sala")({
  loader: ({ params }) => {
    if (!UUID_RE.test(params.liveId)) throw notFound();
    return { liveId: params.liveId };
  },
  head: () => ({
    meta: [
      { title: "Sala Interativa — MM Club" },
      { name: "description", content: "Sala interativa do MM Club para lives com host, palco e participantes em tempo real." },
      { property: "og:title", content: "Sala Interativa — MM Club" },
      { property: "og:description", content: "Sala interativa do MM Club para lives com host, palco e participantes em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SalaRoute,
});

type JoinResult = Awaited<ReturnType<typeof joinRoom>>;
type LiveData = Awaited<ReturnType<typeof getLive>>["live"];

function SalaRoute() {
  const { liveId } = Route.useLoaderData();
  const navigate = useNavigate();
  const joinRoomFn = useServerFn(joinRoom);
  const getLiveFn = useServerFn(getLive);

  const [live, setLive] = useState<LiveData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<JoinResult | null>(null);
  const [target, setTarget] = useState<"backstage" | "main">("main");
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const joinLockRef = useRef(false);
  const sessionRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Green room gate — publishers confirm devices before entering. */
  const [ready, setReady] = useState(false);

  const scheduleSessionRefresh = () => {
    if (sessionRefreshTimerRef.current) clearTimeout(sessionRefreshTimerRef.current);
    sessionRefreshTimerRef.current = setTimeout(() => {
      sessionRefreshTimerRef.current = null;
      setSession(null);
    }, 150);
  };

  // Resolve current user + live (client-side so auth token is present).
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!authReady || !userId) return;
    let cancelled = false;
    getLiveFn({ data: { id: liveId } })
      .then((res) => {
        if (cancelled) return;
        // Never open the LiveKit room for an ended/published live — go straight to the replay.
        if (res.live.status === "ended" || res.live.status === "published") {
          navigate({ to: "/lives/$liveId", params: { liveId }, replace: true });
          return;
        }
        setLive(res.live);
        setLiveStatus(res.live.status);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Não foi possível carregar a live.");
      });
    supabase
      .from("lives")
      .select("created_by")
      .eq("id", liveId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setCreatedBy((data as { created_by?: string } | null)?.created_by ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, userId, liveId, getLiveFn]);

  // Compute initial target: publishers land in backstage until the room is live.
  useEffect(() => {
    if (!userId || createdBy === null || liveStatus === null) return;
    const isCreator = createdBy === userId;
    const initial: "backstage" | "main" =
      isCreator && liveStatus !== "live" && liveStatus !== "ended" ? "backstage" : "main";
    setTarget(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, createdBy, liveStatus === null]);

  // Realtime: watch lives.status so backstage flips to main once host goes live.
  useEffect(() => {
    const channel = supabase
      .channel(`sala-live-${liveId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lives", filter: `id=eq.${liveId}` },
        (payload) => {
          const next = (payload.new as { status?: string })?.status;
          if (next) setLiveStatus(next);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveId]);

  // (Re)join the room whenever target changes OR the session is cleared
  // (e.g. after being promoted to the stage — we need a new publisher token).
  useEffect(() => {
    if (!authReady || !userId || !live) return;
    if (session) return;
    if (joinLockRef.current) return;
    joinLockRef.current = true;
    setError(null);
    joinRoomFn({ data: { liveId, target } })
      .then((res) => setSession(res))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Falha a entrar na sala."))
      .finally(() => {
        joinLockRef.current = false;
      });
  }, [authReady, userId, target, liveId, joinRoomFn, live, session]);


  // If the room went live while we're still in backstage as publisher, move to main.
  useEffect(() => {
    if (liveStatus === "live" && target === "backstage") {
      setTarget("main");
      scheduleSessionRefresh();
    }
  }, [liveStatus, target]);

  // When the host ends the live, evict everyone still in the room and send
  // them to the live page — which will show the replay as soon as it's ready.
  useEffect(() => {
    if (liveStatus === "ended" || liveStatus === "published") {
      navigate({ to: "/lives/$liveId", params: { liveId }, replace: true });
    }
  }, [liveStatus, liveId, navigate]);

  // Auto-refresh the LiveKit token when the local participant is *promoted*
  // to the stage (off_stage → on_stage transition). LiveKit tokens embed
  // publish permissions, so the initial viewer token has to be replaced
  // before we can publish mic/cam. We track the previous on_stage state to
  // avoid rejoining on every unrelated UPDATE (heartbeats, presence, etc.),
  // which would otherwise cause an infinite reconnect loop.
  const prevOnStageRef = useRef<boolean | null>(null);
  const prevPermsRef = useRef<{ mic: boolean; cam: boolean; screen: boolean } | null>(null);
  useEffect(() => {
    if (!authReady || !userId) return;
    prevOnStageRef.current = null;
    prevPermsRef.current = null;
    const ch = supabase
      .channel(`sala-me:${liveId}:${userId}:${Math.random().toString(36).slice(2, 6)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_participants",
          filter: `live_id=eq.${liveId}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; on_stage: boolean; mic_allowed: boolean; cam_allowed: boolean; screen_allowed: boolean };
          if (row.user_id !== userId) return;
          const prev = prevOnStageRef.current;
          const prevPerms = prevPermsRef.current;
          prevOnStageRef.current = row.on_stage;
          const perms = { mic: row.mic_allowed, cam: row.cam_allowed, screen: row.screen_allowed || row.on_stage };
          prevPermsRef.current = perms;
          // Reissue token when promoted (off→on) OR when publish permissions
          // change while on stage — LiveKit tokens embed canPublishSources,
          // so screen-share access requires a fresh token when granted later.
          const promoted = prev === false && row.on_stage && (perms.mic || perms.cam || perms.screen);
          // Demoted (on→off, by the host or by the user itself): the current
          // token still carries publish rights, so we mint a viewer token —
          // that also drops mic/cam/screen tracks from the stage instantly.
          const demoted = prev === true && !row.on_stage;
          const permsChangedOnStage =
            row.on_stage &&
            prevPerms != null &&
            (prevPerms.mic !== perms.mic || prevPerms.cam !== perms.cam || prevPerms.screen !== perms.screen);
          if (promoted || demoted || permsChangedOnStage) {
            scheduleSessionRefresh();
          }
          if (demoted) setTarget("main");

        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      if (sessionRefreshTimerRef.current) {
        clearTimeout(sessionRefreshTimerRef.current);
        sessionRefreshTimerRef.current = null;
      }
    };
  }, [authReady, userId, liveId]);




  const handleLeave = () => {
    // Route to the lives index — /lives/$liveId auto-redirects interactive
    // lives back into /sala, which would trap the user in a loop.
    navigate({ to: "/lives" });
  };

  const handleRetryConnection = () => {
    // Mint a fresh token and mount a fresh media engine. Reusing a Room after
    // a failed signalling handshake is unreliable, especially in Safari.
    setError(null);
    setSession(null);
  };

  if (!authReady) {
    return <FullscreenLoader label="A preparar sessão…" />;
  }

  if (!userId) {
    return (
      <FullscreenMessage
        title="Sessão necessária"
        body="Inicia sessão para entrar na sala interativa."
        action={
          <Link to="/auth" className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-black">
            Entrar
          </Link>
        }
      />
    );
  }

  if (error) {
    return (
      <FullscreenMessage
        title="Não foi possível entrar"
        body={error}
        action={
          <Link
            to="/lives/$liveId"
            params={{ liveId }}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
          >
            Voltar à live
          </Link>
        }
      />
    );
  }

  if (!live || !session) {
    return <FullscreenLoader label="A ligar à sala…" />;
  }

  // Green room: publishers (host / cohost / speaker) check camera, microphone
  // and framing before any track is published to the room.
  const isPublisher = session.role === "host" || session.role === "cohost" || session.role === "speaker";
  if (isPublisher && !ready) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <PreJoin
          title={target === "backstage" ? "Backstage privado" : "Antes de entrar ao vivo"}
          subtitle={
            target === "backstage"
              ? "Ninguém te vê ainda. Ajusta câmara, microfone e enquadramento e entra quando estiveres pronto."
              : "Verifica câmara, microfone e enquadramento. Só entras na sala quando confirmares."
          }
          onEnter={() => setReady(true)}
          onCancel={handleLeave}
        />
      </div>
    );
  }

  return (
    <SalaShell liveId={live.id} userId={userId} onLeave={handleLeave}>
      <Suspense fallback={<FullscreenLoader label="A ligar à sala…" />}>
        <InteractiveRoom
          liveId={live.id}
          localUserId={userId}
          token={session.token}
          url={session.url}
          target={target}
          onLeave={handleLeave}
          onRetry={handleRetryConnection}
        />
      </Suspense>

    </SalaShell>
  );
}

function SalaShell({
  liveId,
  userId,
  onLeave,
  children,
}: {
  liveId: string;
  userId: string;
  onLeave: () => void;
  children: React.ReactNode;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const adminIds = useAdminIds();
  const [people, setPeople] = useState<
    Array<{ user_id: string; role: string; on_stage: boolean; hand_raised_at: string | null; display_name: string; avatar_url: string | null }>
  >([]);
  const [elapsed, setElapsed] = useState<string>("");
  const [wentLiveAt, setWentLiveAt] = useState<string | null>(null);

  // Safari's visible viewport changes as its address/tab bars expand and
  // collapse. Keep the room exactly inside that visible area so the controls
  // dock is never pushed behind browser chrome.
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const measure = () => {
      root.style.setProperty("--interactive-room-height", `${viewport?.height ?? window.innerHeight}px`);
    };
    measure();
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => {
      root.style.removeProperty("--interactive-room-height");
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Track live status timestamp (went_live_at) directly, incl. realtime updates.
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const { data } = await supabase.from("lives").select("went_live_at").eq("id", liveId).maybeSingle();
      if (!cancelled) setWentLiveAt((data?.went_live_at as string | null) ?? null);
    }
    refresh();
    const suffix = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`sala-live:${liveId}:${suffix}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lives", filter: `id=eq.${liveId}` },
        (payload) => {
          const next = (payload.new as { went_live_at?: string | null })?.went_live_at ?? null;
          setWentLiveAt(next);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [liveId]);

  // Real-time viewer/participant list + count (all rows without left_at).
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const { data } = await supabase
        .from("live_participants")
        .select("user_id, role, on_stage, hand_raised_at, guest_name, is_guest, last_seen_at, joined_at")
        .eq("live_id", liveId)
        .is("left_at", null);
      if (cancelled) return;
      const all = (data ?? []) as Array<{
        user_id: string;
        role: string;
        on_stage: boolean;
        hand_raised_at: string | null;
        guest_name: string | null;
        is_guest: boolean | null;
        last_seen_at: string | null;
        joined_at: string | null;
      }>;
      // Convidados sem sinal de vida recente são fantasmas — não os mostramos.
      const cutoff = Date.now() - 3 * 60 * 1000;
      const rows = all.filter((r) => {
        if (!r.is_guest) return true;
        const seen = new Date(r.last_seen_at ?? r.joined_at ?? 0).getTime();
        return seen >= cutoff;
      });
      setViewerCount(rows.length);
      const ids = Array.from(new Set(rows.filter((r) => !r.is_guest).map((r) => r.user_id)));
      let profs: Record<string, { display_name: string; avatar_url: string | null }> = {};
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
        for (const row of (p ?? []) as Array<{ id: string; display_name: string; avatar_url: string | null }>) {
          profs[row.id] = { display_name: row.display_name, avatar_url: row.avatar_url };
        }
      }
      if (cancelled) return;
      setPeople(
        rows.map((r) => ({
          ...r,
          display_name:
            profs[r.user_id]?.display_name ??
            (r.guest_name ? `${r.guest_name} (convidado)` : "Membro"),
          avatar_url: profs[r.user_id]?.avatar_url ?? null,
        })),
      );
    }

    refresh();
    const suffix = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`sala-count:${liveId}:${suffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_participants", filter: `live_id=eq.${liveId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [liveId]);

  // Elapsed timer since wentLiveAt.
  useEffect(() => {
    if (!wentLiveAt) {
      setElapsed("");
      return;
    }
    const start = new Date(wentLiveAt).getTime();
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      const pad = (n: number) => n.toString().padStart(2, "0");
      setElapsed(h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [wentLiveAt]);

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex min-h-0 w-screen flex-col overflow-hidden bg-black text-white"
      style={{ height: "var(--interactive-room-height, 100dvh)" }}
    >
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-white/5 px-2 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        <button
          type="button"
          onClick={onLeave}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Sair da sala</span>
        </button>
        <div className="flex min-w-0 items-center justify-end gap-1.5 text-xs sm:gap-2">
          {wentLiveAt && (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 font-medium text-red-300 ring-1 ring-red-500/30 sm:gap-1.5 sm:px-2.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              <span className="hidden sm:inline">AO VIVO</span>
              <span className="tabular-nums text-red-200/90">· {elapsed}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setPeopleOpen(true)}
            aria-label="Ver participantes"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-white/80 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="tabular-nums">{viewerCount}</span>
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden text-[10px] uppercase tracking-[0.2em] text-white/40 sm:block">Sala · Beta</div>
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            aria-label={chatOpen ? "Fechar chat" : "Abrir chat"}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition",
              chatOpen ? "bg-white/10 text-white ring-white/15" : "bg-white/5 text-white/70 ring-white/10 hover:text-white",
            )}
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      </header>
       <div
         className={cn(
           "relative grid min-h-0 min-w-0 flex-1 overflow-hidden",
           chatOpen
             ? "grid-rows-[minmax(0,3fr)_minmax(190px,2fr)] sm:grid-cols-[minmax(0,1fr)_minmax(280px,32vw)] sm:grid-rows-1"
             : "grid-cols-1 grid-rows-1",
         )}
       >
          <main className="relative min-h-0 min-w-0 overflow-hidden">{children}</main>
         {chatOpen && (
           <aside className="relative z-40 flex min-h-0 min-w-0 flex-col overflow-hidden border-t border-white/10 bg-neutral-950 sm:border-l sm:border-t-0">
             <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
              <div className="text-sm font-medium">Chat</div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/80"
                aria-label="Fechar chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 p-2">
              <LiveChat liveId={liveId} currentUserId={userId} />
            </div>
          </aside>
        )}
         {peopleOpen && (
          <div className="absolute inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-white/10 bg-neutral-950/95 backdrop-blur-md md:w-[340px]">
            <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
              <div className="text-sm font-semibold">
                Participantes <span className="text-white/40">· {people.length}</span>
              </div>
              <button
                type="button"
                onClick={() => setPeopleOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 hover:bg-white/10"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {people.length === 0 ? (
                <div className="grid h-full place-items-center px-4 text-center text-xs text-white/50">
                  Ainda ninguém aqui.
                </div>
              ) : (
                <ul className="space-y-1">
                  {people
                    .slice()
                    .sort((a, b) => Number(b.on_stage) - Number(a.on_stage) || a.display_name.localeCompare(b.display_name))
                    .map((p) => (
                      <li
                        key={p.user_id}
                        className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2.5 py-2 ring-1 ring-white/5"
                      >
                        <MemberAvatar
                          name={p.display_name}
                          avatarUrl={p.avatar_url}
                          verified={adminIds.has(p.user_id) || p.role === "host"}
                          size={36}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-white">{p.display_name}</div>
                          <div className="flex items-center gap-1.5 text-[10.5px] text-white/50">
                            {p.role === "host" && <span className="text-[hsl(45_86%_60%)]">Host</span>}
                            {p.role === "cohost" && <span className="text-[hsl(45_86%_60%)]">Co-host</span>}
                            {p.on_stage && p.role !== "host" && p.role !== "cohost" && <span>No palco</span>}
                            {!p.on_stage && p.role !== "host" && p.role !== "cohost" && <span>Espectador</span>}
                            {p.hand_raised_at && <span className="text-amber-300">· mão levantada</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FullscreenLoader({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black text-white/80">
      <div className="flex items-center gap-3 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

function FullscreenMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black px-6 text-center text-white">
      <div className="max-w-sm">
        <div className="text-lg font-semibold">{title}</div>
        <p className="mt-2 text-sm text-white/60">{body}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

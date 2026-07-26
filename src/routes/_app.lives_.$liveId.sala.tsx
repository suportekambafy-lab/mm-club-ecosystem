/**
 * Dedicated route for the *interactive* live experience (LiveKit Salas).
 *
 * Isolated by design: the broadcast/RTMP viewer at `/lives/$liveId` is
 * untouched. Once the interactive flow is fully validated we can unify
 * both experiences under a single route driven by `lives.mode`.
 */
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, Users, MessageSquare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLive } from "@/lib/lives.functions";
import { joinRoom } from "@/lib/live-room.functions";
import { InteractiveRoom } from "@/components/live/interactive-room";
import { LiveChat } from "@/components/mm/live-chat";
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

  // (Re)join the room whenever target changes.
  useEffect(() => {
    if (!authReady || !userId || !live) return;
    if (joinLockRef.current) return;
    joinLockRef.current = true;
    setError(null);
    joinRoomFn({ data: { liveId, target } })
      .then((res) => setSession(res))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Falha a entrar na sala."))
      .finally(() => {
        joinLockRef.current = false;
      });
  }, [authReady, userId, target, liveId, joinRoomFn, live]);

  // If the room went live while we're still in backstage as publisher, move to main.
  useEffect(() => {
    if (liveStatus === "live" && target === "backstage") {
      setSession(null);
      setTarget("main");
    }
  }, [liveStatus, target]);

  const handleLeave = () => {
    navigate({ to: "/lives/$liveId", params: { liveId } });
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

  return (
    <SalaShell liveId={live.id} userId={userId} onLeave={handleLeave}>
      <InteractiveRoom
        liveId={live.id}
        localUserId={userId}
        token={session.token}
        url={session.url}
        target={target}
        onLeave={handleLeave}
      />
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
  const [chatOpen, setChatOpen] = useState(true);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [elapsed, setElapsed] = useState<string>("");
  const [wentLiveAt, setWentLiveAt] = useState<string | null>(null);

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

  // Real-time viewer/participant count (all rows without left_at).
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const { count } = await supabase
        .from("live_participants")
        .select("id", { count: "exact", head: true })
        .eq("live_id", liveId)
        .is("left_at", null);
      if (!cancelled) setViewerCount(count ?? 0);
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onLeave}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Sair da sala</span>
        </button>
        <div className="flex min-w-0 items-center gap-2 text-xs">
          {wentLiveAt && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 font-medium text-red-300 ring-1 ring-red-500/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              AO VIVO
              <span className="tabular-nums text-red-200/90">· {elapsed}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-white/80 ring-1 ring-white/10">
            <Users className="h-3.5 w-3.5" />
            <span className="tabular-nums">{viewerCount}</span>
          </span>
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
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <div className="relative flex-1 min-w-0">{children}</div>
        {chatOpen && (
          <aside className="hidden w-[340px] shrink-0 border-l border-white/5 bg-neutral-950/60 p-2 md:block">
            <LiveChat liveId={liveId} currentUserId={userId} />
          </aside>
        )}
        {chatOpen && (
          <div className="absolute inset-0 z-40 flex flex-col bg-black/70 backdrop-blur-sm md:hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
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
            <div className="flex-1 min-h-0 p-2">
              <LiveChat liveId={liveId} currentUserId={userId} />
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

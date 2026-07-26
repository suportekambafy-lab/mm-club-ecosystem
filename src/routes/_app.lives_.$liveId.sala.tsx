/**
 * Dedicated route for the *interactive* live experience (LiveKit Salas).
 *
 * Isolated by design: the broadcast/RTMP viewer at `/lives/$liveId` is
 * untouched. Once the interactive flow is fully validated we can unify
 * both experiences under a single route driven by `lives.mode`.
 */
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLive } from "@/lib/lives.functions";
import { joinRoom } from "@/lib/live-room.functions";
import { InteractiveRoom } from "@/components/live/interactive-room";
import { useServerFn } from "@tanstack/react-start";

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
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <button
          type="button"
          onClick={handleLeave}
          className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Sair da sala
        </button>
        <div className="text-xs uppercase tracking-[0.2em] text-white/40">Sala interativa · Beta</div>
        <div className="w-24" />
      </header>
      <div className="relative flex-1 overflow-hidden">
        <InteractiveRoom
          liveId={live.id}
          localUserId={userId}
          token={session.token}
          url={session.url}
          target={target}
          onLeave={handleLeave}
        />
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

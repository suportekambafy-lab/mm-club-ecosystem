/**
 * Public guest entry for interactive live rooms.
 *
 * Anyone with the shared link (`/convidado/<liveId>?c=<code>`) types a name,
 * checks camera/mic in the green room and joins the session — no MM Club
 * account required.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Radio, CalendarClock } from "lucide-react";
import { joinLiveAsGuest, getGuestLiveInfo } from "@/lib/live-guest.functions";
import { LiveCountdown } from "@/components/mm/live-countdown";
import { resolveLiveCoverUrl } from "@/lib/live-cover-url";
import { PreJoin } from "@/components/live/pre-join";
import { GuestRoom } from "@/components/live/guest-room";
import type { MediaPrefs } from "@/lib/media-prefs";

type Search = { c?: string };

export const Route = createFileRoute("/convidado/$liveId")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    c: typeof search.c === "string" ? search.c : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar como convidado — MM Club" },
      { name: "description", content: "Entra na sessão ao vivo do MM Club como convidado, sem precisares de conta." },
      { property: "og:title", content: "Entrar como convidado — MM Club" },
      { property: "og:description", content: "Entra na sessão ao vivo do MM Club como convidado, sem precisares de conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuestEntry,
});

function GuestEntry() {
  const { liveId } = Route.useParams();
  const { c } = Route.useSearch();
  const navigate = useNavigate();
  const join = useServerFn(joinLiveAsGuest);
  const fetchInfo = useServerFn(getGuestLiveInfo);
  const info = useQuery({
    queryKey: ["guest-live-info", liveId, c],
    enabled: Boolean(c),
    queryFn: () => fetchInfo({ data: { liveId, code: c as string } }),
    refetchInterval: 15_000,
    staleTime: 0,
  });

  const [name, setName] = useState("");
  const [step, setStep] = useState<"name" | "prejoin" | "room">("name");
  const [session, setSession] = useState<{
    token: string;
    url: string;
    title: string;
    guestId: string;
    onStage: boolean;
  } | null>(null);
  const [prefs, setPrefs] = useState<MediaPrefs | null>(null);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!c) {
    return (
      <Shell>
        <p className="text-sm text-white/70">Link de convidado inválido. Pede um novo link ao anfitrião.</p>
      </Shell>
    );
  }

  const handleEnter = async (mediaPrefs: MediaPrefs) => {
    setEntering(true);
    setError(null);
    try {
      // Reuse a stable guest identity per live so refreshing/rejoining does not
      // create a duplicate participant tile in the room.
      const storageKey = `mm-guest-id:${liveId}`;
      let storedId: string | undefined;
      try {
        storedId = window.localStorage.getItem(storageKey) ?? undefined;
      } catch {
        storedId = undefined;
      }
      const res = await join({ data: { liveId, code: c, displayName: name.trim(), guestId: storedId } });
      try {
        window.localStorage.setItem(storageKey, res.guestId);
      } catch {
        /* storage blocked — identity stays per-session */
      }
      setSession({ token: res.token, url: res.url, title: res.title, guestId: res.guestId, onStage: res.onStage });
      setPrefs(mediaPrefs);
      setStep("room");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar na sessão.");
      setStep("name");
    } finally {
      setEntering(false);
    }
  };

  if (step === "room" && session && prefs) {
    return (
      <div className="h-[100dvh] w-full bg-black">
        <GuestRoom
          token={session.token}
          url={session.url}
          prefs={prefs}
          liveId={liveId}
          code={c}
          guestId={session.guestId}
          displayName={name.trim()}
          onStage={session.onStage}
          onLeave={() => {
            setStep("name");
            setSession(null);
          }}
        />
      </div>
    );
  }


  if (step === "prejoin") {
    return (
      <div className="h-[100dvh] w-full bg-black">
        <PreJoin
          title="Pronto para entrar?"
          subtitle="Vais entrar como convidado na sessão ao vivo."
          entering={entering}
          onEnter={handleEnter}
          onCancel={() => setStep("name")}
        />
      </div>
    );
  }

  const live = info.data;
  const coverUrl = resolveLiveCoverUrl(live?.coverUrl ?? undefined);
  const dateLabel = live?.startsAt
    ? new Intl.DateTimeFormat("pt-PT", { dateStyle: "full", timeStyle: "short" }).format(new Date(live.startsAt))
    : null;

  if (info.isLoading) {
    return (
      <Shell>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/50" />
      </Shell>
    );
  }

  if (info.isError) {
    return (
      <Shell>
        <p className="text-sm text-white/70">
          {info.error instanceof Error ? info.error.message : "Link de convidado inválido."}
        </p>
      </Shell>
    );
  }

  if (live?.ended) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-white">{live.title}</h1>
        <p className="mt-2 text-sm text-white/60">Esta sessão já terminou.</p>
      </Shell>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-neutral-950">
      <div className="mx-auto w-full max-w-xl px-5 py-8">
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-900"
          style={
            coverUrl
              ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        >
          <div className="bg-gradient-to-t from-black/90 via-black/60 to-black/30 p-6 pt-24 text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-300">
              <Radio className="h-3 w-3" />
              {live?.open ? "Sala aberta" : "Sessão agendada"}
            </span>
            <h1 className="mt-3 text-2xl font-semibold text-white">{live?.title}</h1>
            {live?.description && <p className="mt-1.5 text-sm text-white/60">{live.description}</p>}
            {dateLabel && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/50">
                <CalendarClock className="h-3.5 w-3.5" />
                {dateLabel}
              </p>
            )}
            {live?.startsAt && !live.open && (
              <div className="mt-4">
                <LiveCountdown startsAt={live.startsAt} variant="hero" />
              </div>
            )}
          </div>
        </div>

        {!live?.open ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-sm text-white/70">
              A sala abre 10 minutos antes do início. Deixa esta página aberta — assim que o anfitrião abrir,
              poderás escrever o teu nome e entrar.
            </p>
          </div>
        ) : (
          <form
            className="mt-6 space-y-3 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim().length < 2) {
                setError("Escreve o teu nome (mínimo 2 letras).");
                return;
              }
              setError(null);
              setStep("prejoin");
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-[11px] uppercase tracking-wide text-white/40">O teu nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="Ex.: Maria Silva"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
              />
            </label>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={entering}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
            >
              {entering && <Loader2 className="h-4 w-4 animate-spin" />}
              Continuar
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="mt-4 w-full text-center text-xs text-white/40 hover:text-white/70"
        >
          Voltar ao site
        </button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] w-full place-items-center bg-neutral-950 px-6 text-center">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

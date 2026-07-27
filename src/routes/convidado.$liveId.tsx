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
import { Loader2, Radio } from "lucide-react";
import { joinLiveAsGuest } from "@/lib/live-guest.functions";
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

  const [name, setName] = useState("");
  const [step, setStep] = useState<"name" | "prejoin" | "room">("name");
  const [session, setSession] = useState<{ token: string; url: string; title: string } | null>(null);
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
      const res = await join({ data: { liveId, code: c, displayName: name.trim() } });
      setSession({ token: res.token, url: res.url, title: res.title });
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

  return (
    <Shell>
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-500/10">
        <Radio className="h-6 w-6 text-amber-400" />
      </div>
      <h1 className="mt-4 text-xl font-semibold text-white">Entrar como convidado</h1>
      <p className="mt-2 text-sm text-white/60">
        Escreve o teu nome para entrares na sessão ao vivo. Não precisas de conta MM Club.
      </p>

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
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className="mt-4 text-xs text-white/40 hover:text-white/70"
      >
        Voltar ao site
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] w-full place-items-center bg-neutral-950 px-6 text-center">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

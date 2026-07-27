/**
 * MM Club — LiveKit Egress custom template.
 *
 * LiveKit's egress browser loads this page with `?url=&token=&layout=` and
 * records whatever it renders. This is what makes the recording look exactly
 * like the live room (dark stage, golden accents, name plates) instead of the
 * default plain grid layout.
 *
 * Contract with the egress runner:
 *  - log `START_RECORDING` once the room is connected and painted
 *  - log `END_RECORDING` when the room ends / everyone leaves
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/egress/composite")({
  component: EgressComposite,
  ssr: false,
  head: () => ({
    meta: [
      { title: "MM Club — Gravação" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Tile = {
  id: string;
  name: string;
  isHost: boolean;
  isSpeaking: boolean;
  isScreen: boolean;
  /** MediaStream to bind to the <video> element. */
  stream: MediaStream | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function EgressComposite() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [ready, setReady] = useState(false);
  const audioHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let room: any = null;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const url = params.get("url");
      const token = params.get("token");
      if (!url || !token) return;

      const { Room, RoomEvent, Track } = await import("livekit-client");
      room = new Room({ adaptiveStream: false, dynacast: false });

      const rebuild = () => {
        if (cancelled || !room) return;
        const participants = [
          ...(room.remoteParticipants ? Array.from(room.remoteParticipants.values()) : []),
        ] as any[];

        const next: Tile[] = [];
        for (const p of participants) {
          const meta = (() => {
            try {
              return p.metadata ? JSON.parse(p.metadata) : {};
            } catch {
              return {};
            }
          })();
          const pubs = Array.from(p.trackPublications?.values?.() ?? []) as any[];
          const screen = pubs.find(
            (t) => t.source === Track.Source.ScreenShare && t.track && !t.isMuted,
          );
          const cam = pubs.find(
            (t) => t.source === Track.Source.Camera && t.track && !t.isMuted,
          );
          const name = p.name || meta?.name || "Convidado";
          const isHost = meta?.role === "host" || meta?.role === "publisher";

          if (screen?.track) {
            next.push({
              id: `${p.identity}-screen`,
              name: `${name} — ecrã`,
              isHost,
              isSpeaking: false,
              isScreen: true,
              stream: new MediaStream([screen.track.mediaStreamTrack]),
            });
          }
          next.push({
            id: p.identity,
            name,
            isHost,
            isSpeaking: Boolean(p.isSpeaking),
            isScreen: false,
            stream: cam?.track ? new MediaStream([cam.track.mediaStreamTrack]) : null,
          });
        }

        // Screen share first, then hosts, then speakers, then the rest.
        next.sort((a, b) => {
          const score = (t: Tile) =>
            (t.isScreen ? 8 : 0) + (t.isHost ? 4 : 0) + (t.isSpeaking ? 2 : 0);
          return score(b) - score(a);
        });
        setTiles(next);
      };

      const attachAudio = (track: any) => {
        if (track.kind !== "audio" || !audioHost.current) return;
        const el = track.attach() as HTMLAudioElement;
        el.autoplay = true;
        (el as any).playsInline = true;
        audioHost.current.appendChild(el);
      };

      room
        .on(RoomEvent.TrackSubscribed, (track: any) => {
          attachAudio(track);
          rebuild();
        })
        .on(RoomEvent.TrackUnsubscribed, (track: any) => {
          try {
            track.detach().forEach((el: HTMLElement) => el.remove());
          } catch {
            /* noop */
          }
          rebuild();
        })
        .on(RoomEvent.ParticipantConnected, rebuild)
        .on(RoomEvent.ParticipantDisconnected, rebuild)
        .on(RoomEvent.TrackMuted, rebuild)
        .on(RoomEvent.TrackUnmuted, rebuild)
        .on(RoomEvent.ActiveSpeakersChanged, rebuild)
        .on(RoomEvent.Disconnected, () => {
          console.log("END_RECORDING");
        });

      await room.connect(url, token, { autoSubscribe: true });
      if (cancelled) return;
      rebuild();
      // Give the first frames a moment to paint before the recorder starts.
      window.setTimeout(() => {
        setReady(true);
        console.log("START_RECORDING");
      }, 800);
    })().catch((err) => {
      console.error("[egress-template]", err);
    });

    return () => {
      cancelled = true;
      try {
        room?.disconnect();
      } catch {
        /* noop */
      }
    };
  }, []);

  const primary = tiles[0] ?? null;
  const rest = tiles.slice(1, 5);

  return (
    <div
      className="fixed inset-0 overflow-hidden font-sans text-white"
      style={{
        background:
          "radial-gradient(1200px 700px at 50% -10%, #1a1508 0%, #0b0b0c 55%, #060607 100%)",
      }}
    >
      {/* Golden frame */}
      <div
        className="pointer-events-none absolute inset-6 rounded-[28px]"
        style={{
          border: "1px solid rgba(212,175,55,0.35)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.03) inset, 0 30px 90px rgba(0,0,0,0.6)",
        }}
      />

      {/* Header */}
      <div className="absolute inset-x-12 top-12 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl text-sm font-black text-black"
            style={{ background: "linear-gradient(135deg,#f5d67b,#c9a227)" }}
          >
            MM
          </div>
          <div className="leading-tight">
            <div className="text-[17px] font-semibold tracking-tight">MM Club</div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
              Sessão ao vivo
            </div>
          </div>
        </div>
        <div
          className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ background: "rgba(212,175,55,0.12)", color: "#e8c65c" }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: "#e8c65c" }} />
          Live
        </div>
      </div>

      {/* Stage */}
      <div className="absolute inset-x-12 bottom-14 top-28 z-10 flex gap-4">
        <div className="relative flex-1">
          {primary ? (
            <TileView tile={primary} large />
          ) : (
            <div className="grid h-full w-full place-items-center rounded-3xl border border-white/5 bg-black/40 text-white/30">
              À espera de vídeo…
            </div>
          )}
        </div>

        {rest.length > 0 && (
          <div className="flex w-[300px] flex-col gap-4">
            {rest.map((t) => (
              <div key={t.id} className="h-[168px]">
                <TileView tile={t} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer strip */}
      <div className="absolute inset-x-12 bottom-6 z-20 flex items-center justify-between text-[11px] text-white/30">
        <span>mmclub.pt</span>
        <span>{ready ? "" : ""}</span>
      </div>

      <div ref={audioHost} className="hidden" />
    </div>
  );
}

function TileView({ tile, large }: { tile: Tile; large?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = tile.stream;
    el.muted = true;
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, [tile.stream]);

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-3xl bg-neutral-950"
      style={{
        border: tile.isSpeaking
          ? "2px solid rgba(232,198,92,0.9)"
          : "1px solid rgba(255,255,255,0.07)",
        boxShadow: tile.isSpeaking
          ? "0 0 40px rgba(232,198,92,0.18)"
          : "0 20px 60px rgba(0,0,0,0.45)",
      }}
    >
      {tile.stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className="h-full w-full"
          style={{ objectFit: tile.isScreen ? "contain" : "cover" }}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-neutral-900 to-black">
          <div
            className="grid place-items-center rounded-full font-semibold text-black"
            style={{
              width: large ? 140 : 74,
              height: large ? 140 : 74,
              fontSize: large ? 44 : 24,
              background: "linear-gradient(135deg,#f5d67b,#c9a227)",
            }}
          >
            {initials(tile.name)}
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center gap-2 rounded-lg bg-black/45 px-2.5 py-1.5 text-[13px] font-medium">
          <span className="max-w-[220px] truncate">{tile.name}</span>
          {tile.isHost && (
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
              style={{ background: "rgba(232,198,92,0.18)", color: "#e8c65c" }}
            >
              HOST
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

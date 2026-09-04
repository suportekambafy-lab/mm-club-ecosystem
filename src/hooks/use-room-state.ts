/**
 * useRoomState — the single source of truth for a live room's UI.
 *
 * Composes:
 *   - Postgres authoritative state (lives + live_participants + profiles),
 *     kept fresh by Realtime subscriptions;
 *   - LiveKit engine adapter (media tracks, active speaker, quality),
 *     wrapped so the UI never sees a LiveKit type directly.
 *
 * Survives refresh / reconnect: every field is derived from the server on
 * mount, and LiveKit auto-reconnects preserve permissions/layout because
 * they are re-hydrated from Postgres.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readMediaPrefs, writeMediaPrefs } from "@/lib/media-prefs";
import { toast } from "sonner";
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type RemoteTrack,
  type RemoteTrackPublication,
  type Participant,
  type LocalParticipant,
  type ConnectionQuality as LKConnectionQuality,
  type ConnectionState,
} from "livekit-client";
import { HQ_ROOM_OPTIONS, HQ_SCREEN_SHARE } from "@/lib/livekit-quality";
import { syncStudioProcessors } from "@/lib/studio-processors";
import { subscribeStudio } from "@/lib/studio-filters";
import { supabase } from "@/integrations/supabase/client";
import { cachedAvatarUrl, resolveAvatarUrl } from "@/lib/avatar-cache";
import {
  resolveLayout,
  type MediaTrack,
  type RoomActions,
  type RoomParticipant,
  type RoomState,
  type StageLayout,
} from "@/lib/room-state";

// ---------- helpers ----------
function mapQuality(q: LKConnectionQuality | undefined): RoomParticipant["connectionQuality"] {
  switch (q) {
    case "excellent":
      return "excellent";
    case "good":
      return "good";
    case "poor":
      return "poor";
    case "lost":
      return "lost";
    default:
      return undefined;
  }
}

/** True when the saved deviceId still exists on this machine. */
async function knownDevice(kind: MediaDeviceKind, id?: string) {
  if (!id) return false;
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    return list.some((d) => d.kind === kind && d.deviceId === id);
  } catch {
    return false;
  }
}

function cameraTrackIsLive(participant: LocalParticipant): boolean {
  const publication = participant.getTrackPublication(Track.Source.Camera);
  const mediaTrack = publication?.track?.mediaStreamTrack;
  return Boolean(
    participant.isCameraEnabled &&
      publication &&
      !publication.isMuted &&
      mediaTrack &&
      mediaTrack.readyState === "live" &&
      mediaTrack.enabled,
  );
}

/**
 * Enable the camera with progressive fallbacks.
 *
 * Real-world failures on desktops: a saved deviceId from another machine
 * (OverconstrainedError), a webcam that cannot do 1080p, or a device already
 * held by another app. We retry with looser constraints before giving up and
 * always return a human-readable reason on failure.
 */
async function enableCameraResilient(room: Room, deviceId?: string): Promise<string | null> {
  const lp = room.localParticipant;
  const usable = (await knownDevice("videoinput", deviceId)) ? deviceId : undefined;
  const attempts: (Parameters<LocalParticipant["setCameraEnabled"]>[1] | undefined)[] = [
    usable ? { deviceId: usable } : undefined,
    { resolution: VideoPresets.h720.resolution },
    { resolution: VideoPresets.h360.resolution },
    undefined,
  ];
  let lastErr: unknown = null;

  // An unplugged external camera can leave an enabled publication whose native
  // track has ended. Reusing it succeeds but leaves a black image, so discard it.
  const stalePublication = lp.getTrackPublication(Track.Source.Camera);
  const staleTrack = stalePublication?.track;
  if (staleTrack && staleTrack.mediaStreamTrack.readyState === "ended") {
    await lp.unpublishTrack(staleTrack, true).catch(() => {});
  }

  for (const opts of attempts) {
    try {
      await lp.setCameraEnabled(true, opts);
      if (cameraTrackIsLive(lp)) return null;
    } catch (err) {
      lastErr = err;
      console.warn("[useRoomState] camera attempt failed", opts, err);
    }
  }
  const msg = lastErr instanceof Error ? `${lastErr.name}: ${lastErr.message}` : String(lastErr ?? "desconhecido");
  if (/NotAllowedError|Permission/i.test(msg)) {
    return "Permissão de câmara bloqueada neste browser. Autoriza a câmara no ícone da barra de endereço e tenta de novo.";
  }
  if (/NotReadableError|TrackStartError|could not start/i.test(msg)) {
    return "A câmara está a ser usada por outra aplicação (Zoom, Meet, OBS…). Fecha-a e tenta de novo.";
  }
  if (/NotFoundError|DevicesNotFound|OverconstrainedError/i.test(msg)) {
    return "Não encontrámos nenhuma câmara disponível neste dispositivo.";
  }
  return `Não foi possível ligar a câmara (${msg}).`;
}

function mapConnectionState(s: ConnectionState): RoomState["connection"]["state"] {
  switch (s) {
    case "connected":
      return "connected";
    case "reconnecting":
      return "reconnecting";
    case "connecting":
      return "connecting";
    default:
      return "disconnected";
  }
}

function trackSource(src: Track.Source): MediaTrack["source"] {
  switch (src) {
    case Track.Source.Camera:
      return "camera";
    case Track.Source.Microphone:
      return "microphone";
    case Track.Source.ScreenShare:
      return "screen";
    case Track.Source.ScreenShareAudio:
      return "screen_audio";
    default:
      return "unknown";
  }
}

interface LiveRow {
  id: string;
  status: RoomState["status"];
  mode: "broadcast" | "interactive";
  stage_layout: StageLayout;
  spotlight_user_id: string | null;
  started_at: string | null;
  went_live_at: string | null;
  backstage_started_at: string | null;
  enabled_modules: string[] | Record<string, unknown> | null;
}

interface ParticipantRow {
  id: string;
  user_id: string;
  role: RoomParticipant["role"];
  room: "backstage" | "main";
  on_stage: boolean;
  mic_allowed: boolean;
  cam_allowed: boolean;
  screen_allowed: boolean;
  hand_raised_at: string | null;
  invited_to_stage_at: string | null;
  banned: boolean;
  guest_name?: string | null;
  is_guest?: boolean | null;
  left_at?: string | null;
}

export interface UseRoomStateArgs {
  liveId: string;
  target: "backstage" | "main";
  localUserId: string;
  /** Provided by joinRoom() server fn — the LiveKit token + wss url. */
  token: string;
  url: string;
  /** Called after the room actions dispatch to hit server RPCs. */
  serverActions: Omit<RoomActions, "toggleMic" | "toggleCam" | "startScreenShare" | "stopScreenShare" | "startAudio" | "leave" | "attachTrack" | "detachTrack">;
}

export function useRoomState({
  liveId,
  target,
  localUserId,
  token,
  url,
  serverActions,
}: UseRoomStateArgs): { state: RoomState; actions: RoomActions } {
  // ---------- server-authoritative state (Postgres + Realtime) ----------
  const [live, setLive] = useState<LiveRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string; avatar_url: string | null }>>({});

  // ---------- engine state (LiveKit) ----------
  const roomRef = useRef<Room | null>(null);
  const roomRunRef = useRef(0);
  const pendingDisconnectRef = useRef<Promise<void>>(Promise.resolve());
  const [connState, setConnState] = useState<RoomState["connection"]["state"]>("connecting");
  const [engineTracks, setEngineTracks] = useState<Record<string, MediaTrack[]>>({}); // identity -> tracks
  // identity -> LiveKit display name (fallback for guests without a profile)
  const [engineNames, setEngineNames] = useState<Record<string, string>>({});
  const [micOn, setMicOn] = useState<Record<string, boolean>>({});
  const [camOn, setCamOn] = useState<Record<string, boolean>>({});
  const [screenOn, setScreenOn] = useState<Record<string, boolean>>({});
  const [quality, setQuality] = useState<Record<string, RoomParticipant["connectionQuality"]>>({});
  const [activeVideoIn, setActiveVideoIn] = useState<string | undefined>(undefined);
  const [activeAudioIn, setActiveAudioIn] = useState<string | undefined>(undefined);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const cameraWantedRef = useRef(readMediaPrefs().camEnabled);
  const cameraRecoveryRef = useRef<Promise<void> | null>(null);

  /** Bump to force a full LiveKit reconnect (recreate the Room). */
  const [reconnectNonce, setReconnectNonce] = useState(0);
  /** Re-hydrate Postgres state on demand (reconnect, tab focus, polling). */
  const hydrateRef = useRef<() => void>(() => {});

  // ---------- initial fetch + realtime for live + participants ----------
  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [liveRes, partsRes] = await Promise.all([
        supabase.from("lives").select("id,status,mode,stage_layout,spotlight_user_id,started_at,went_live_at,backstage_started_at,enabled_modules").eq("id", liveId).maybeSingle(),
        supabase.from("live_participants").select("id,user_id,role,room,on_stage,mic_allowed,cam_allowed,screen_allowed,hand_raised_at,invited_to_stage_at,banned,guest_name,is_guest,left_at").eq("live_id", liveId).is("left_at", null),
      ]);
      if (!mounted) return;
      if (liveRes.data) setLive(liveRes.data as LiveRow);
      const rows = (partsRes.data ?? []) as ParticipantRow[];
      setParticipants(rows);

      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
        if (!mounted) return;
        // Resolve avatares através do cache partilhado (instantâneo em revisitas).
        const resolved = await Promise.all(
          (profs ?? []).map(async (p) => {
            const raw = p.avatar_url as string | null;
            const url = await resolveAvatarUrl(raw);
            return { ...p, avatar_url: url ?? cachedAvatarUrl(raw) };
          }),
        );
        if (!mounted) return;
        const map: Record<string, { display_name: string; avatar_url: string | null }> = {};
        for (const p of resolved) map[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        setProfiles(map);
      }
    }
    hydrateRef.current = () => void hydrate();
    hydrate();

    const suffix = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`room-state:${liveId}:${suffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lives", filter: `id=eq.${liveId}` },
        (payload) => {
          if (payload.new) setLive(payload.new as LiveRow);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_participants", filter: `live_id=eq.${liveId}` },
        (payload) => {
          setParticipants((prev) => {
            if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== (payload.old as ParticipantRow).id);
            const row = payload.new as ParticipantRow;
            // Quem saiu deixa de contar (e sai do palco/audiência) de imediato.
            if (row.left_at) return prev.filter((r) => r.id !== row.id);
            const idx = prev.findIndex((r) => r.id === row.id);
            if (idx === -1) return [...prev, row];
            const copy = prev.slice();
            copy[idx] = row;
            return copy;
          });
        },
      )
      .subscribe();

    // Rede/aba instáveis fazem o Realtime perder eventos. Em vez de obrigar a
    // fazer refresh, voltamos a ler o estado autoritativo periodicamente e
    // sempre que a aba volta ao primeiro plano ou a rede regressa.
    const poll = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void hydrate();
    }, 45_000);
    const onFocus = () => void hydrate();
    const onVisible = () => {
      if (document.visibilityState === "visible") void hydrate();
    };
    window.addEventListener("online", onFocus);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      clearInterval(poll);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
    };
  }, [liveId]);


  // ---------- LiveKit engine ----------
  useEffect(() => {
    if (!token || !url) return;
    const runId = ++roomRunRef.current;
    let disposed = false;
    const room = new Room(HQ_ROOM_OPTIONS);
    const isCurrentRun = () => !disposed && roomRunRef.current === runId;

    const rebuildParticipantTracks = (p: Participant) => {
      const list: MediaTrack[] = [];
      p.trackPublications.forEach((pub) => {
        const t = pub.track;
        if (!t) return;
        list.push({
          id: pub.trackSid,
          kind: t.kind === Track.Kind.Video ? "video" : "audio",
          source: trackSource(t.source),
          muted: pub.isMuted,
          engineRef: t,
          streamId: t.mediaStreamTrack?.id,
        });
      });
      setEngineTracks((prev) => ({ ...prev, [p.identity]: list }));
      if (p.name) setEngineNames((prev) => (prev[p.identity] === p.name ? prev : { ...prev, [p.identity]: p.name! }));
      setMicOn((prev) => ({ ...prev, [p.identity]: !p.isMicrophoneEnabled ? false : true }));
      setCamOn((prev) => ({
        ...prev,
        [p.identity]: p.isLocal ? cameraTrackIsLive(room.localParticipant) : p.isCameraEnabled,
      }));
      setScreenOn((prev) => ({ ...prev, [p.identity]: p.isScreenShareEnabled }));
    };

    const handlers: Array<[RoomEvent, (...args: unknown[]) => void]> = [];
    type AnyOn = { on: (e: RoomEvent, f: (...a: unknown[]) => void) => void; off: (e: RoomEvent, f: (...a: unknown[]) => void) => void };
    const on = <T extends unknown[]>(evt: RoomEvent, fn: (...args: T) => void) => {
      (room as unknown as AnyOn).on(evt, fn as (...a: unknown[]) => void);
      handlers.push([evt, fn as (...a: unknown[]) => void]);
    };

    on(RoomEvent.LocalTrackPublished, () => {
      rebuildParticipantTracks(room.localParticipant);
      void syncStudioProcessors(room);
    });
    on(RoomEvent.ConnectionStateChanged, (s: ConnectionState) => setConnState(mapConnectionState(s)));
    on(RoomEvent.ParticipantConnected, (p: Participant) => rebuildParticipantTracks(p));
    on(RoomEvent.ParticipantDisconnected, (p: Participant) => {
      setEngineTracks((prev) => {
        const copy = { ...prev };
        delete copy[p.identity];
        return copy;
      });
    });
    on(RoomEvent.TrackSubscribed, (_t: RemoteTrack, _pub: RemoteTrackPublication, p: Participant) => rebuildParticipantTracks(p));
    on(RoomEvent.TrackUnsubscribed, (_t: RemoteTrack, _pub: RemoteTrackPublication, p: Participant) => rebuildParticipantTracks(p));
    on(RoomEvent.TrackPublished, (_pub: RemoteTrackPublication, p: Participant) => rebuildParticipantTracks(p));
    on(RoomEvent.TrackUnpublished, (_pub: RemoteTrackPublication, p: Participant) => rebuildParticipantTracks(p));
    on(RoomEvent.LocalTrackPublished, () => rebuildParticipantTracks(room.localParticipant));
    on(RoomEvent.LocalTrackUnpublished, () => rebuildParticipantTracks(room.localParticipant));
    on(RoomEvent.TrackMuted, (_pub, p: Participant) => rebuildParticipantTracks(p));
    on(RoomEvent.TrackUnmuted, (_pub, p: Participant) => rebuildParticipantTracks(p));
    on(RoomEvent.ConnectionQualityChanged, (q: LKConnectionQuality, p: Participant) =>
      setQuality((prev) => ({ ...prev, [p.identity]: mapQuality(q) })),
    );
    on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      setActiveSpeakerId(speakers[0]?.identity ?? null);
    });
    on(RoomEvent.AudioPlaybackStatusChanged, () => {
      setAudioBlocked(!room.canPlaybackAudio);
    });

    /**
     * Após uma reconexão o servidor pode ter deixado subscrições em suspenso —
     * é a causa clássica de "não ouço/não vejo, tenho de fazer refresh".
     * Forçamos a subscrição de tudo e voltamos a ler o estado do Postgres.
     */
    const resubscribeAll = () => {
      room.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          try {
            (pub as RemoteTrackPublication).setSubscribed(true);
          } catch {
            /* já subscrito */
          }
        });
        rebuildParticipantTracks(p);
      });
      rebuildParticipantTracks(room.localParticipant);
      setAudioBlocked(!room.canPlaybackAudio);
      void room.startAudio().catch(() => {});
    };

    const recoverLocalCamera = async () => {
      if (!isCurrentRun() || !cameraWantedRef.current || cameraRecoveryRef.current) return;
      if (cameraTrackIsLive(room.localParticipant)) return;
      const recovery = (async () => {
        const preferred = activeVideoIn ?? readMediaPrefs().cameraId;
        const err = await enableCameraResilient(room, preferred);
        if (!isCurrentRun()) return;
        rebuildParticipantTracks(room.localParticipant);
        if (!err) void syncStudioProcessors(room);
      })().finally(() => {
        cameraRecoveryRef.current = null;
      });
      cameraRecoveryRef.current = recovery;
      await recovery;
    };

    on(RoomEvent.Reconnected, () => {
      resubscribeAll();
      hydrateRef.current();
      void syncStudioProcessors(room);
      void recoverLocalCamera();
    });
    on(RoomEvent.SignalConnected, () => resubscribeAll());
    on(RoomEvent.MediaDevicesChanged, () => void recoverLocalCamera());
    on(RoomEvent.TrackSubscriptionFailed, (_sid: string, p: Participant) => {
      // Uma subscrição falhada deixa o participante mudo/preto. Tentamos de novo.
      window.setTimeout(() => {
        try {
          (p as Participant).trackPublications.forEach((pub) => {
            (pub as RemoteTrackPublication).setSubscribed?.(true);
          });
        } catch {
          /* noop */
        }
        rebuildParticipantTracks(p);
      }, 1500);
    });
    on(RoomEvent.Disconnected, (reason?: unknown) => {
      setConnState("disconnected");
      // Se não fomos nós a sair, voltamos a ligar automaticamente (o utilizador
      // nunca deve precisar de recarregar a página).
      const clientInitiated = Number(reason) === 1 /* CLIENT_INITIATED */;
      if (!clientInitiated && isCurrentRun()) {
        window.setTimeout(() => {
          if (isCurrentRun()) setReconnectNonce((n) => n + 1);
        }, 1200);
      }
    });




    (async () => {
      try {
        // A token refresh must never leave two Room instances connected with
        // the same identity. LiveKit closes one of them with websocket 1006.
        await pendingDisconnectRef.current;
        if (!isCurrentRun()) return;
        roomRef.current = room;
        setConnState("connecting");
        await room.connect(url, token, { autoSubscribe: true });
        if (!isCurrentRun()) {
          await room.disconnect();
          return;
        }
        setConnState("connected");
        setAudioBlocked(!room.canPlaybackAudio);
        // Snapshot existing remotes
        room.remoteParticipants.forEach((p) => rebuildParticipantTracks(p));
        rebuildParticipantTracks(room.localParticipant);


        // Auto-publish mic + camera if the local participant is a publisher.
        // LiveKit does not carry local tracks across Room instances, so when
        // the host transitions backstage → main we need to explicitly (re)enable
        // capture — otherwise viewers see a black tile and hear silence.
        try {
          const lp = room.localParticipant;
          const prefs = readMediaPrefs();
          const canPublish = lp.permissions?.canPublish ?? false;
          const allowedSources = (lp.permissions?.canPublishSources ?? []) as unknown as number[];
          // Empty list means "all sources allowed" per LiveKit server semantics.
          const allowsAll = allowedSources.length === 0;
          const allowsMic = allowsAll || allowedSources.some((s) => Number(s) === Number(Track.Source.Microphone));
          const allowsCam = allowsAll || allowedSources.some((s) => Number(s) === Number(Track.Source.Camera));
          if (canPublish) {
            if (!isCurrentRun()) return;
            // Honour the device + on/off choices made in the pre-join screen,
            // but only when those devices still exist on this machine.
            if (await knownDevice("videoinput", prefs.cameraId)) {
              if (!isCurrentRun()) return;
              await room.switchActiveDevice("videoinput", prefs.cameraId!).catch(() => {});
              setActiveVideoIn(prefs.cameraId!);
            }
            if (await knownDevice("audioinput", prefs.micId)) {
              if (!isCurrentRun()) return;
              await room.switchActiveDevice("audioinput", prefs.micId!).catch(() => {});
              setActiveAudioIn(prefs.micId!);
            }
            if (allowsMic && prefs.micEnabled && !lp.isMicrophoneEnabled) {
              if (!isCurrentRun()) return;
              await lp.setMicrophoneEnabled(true).catch((e) => {
                console.warn("[useRoomState] mic auto-enable failed", e);
              });
            }
            if (allowsCam && prefs.camEnabled && !lp.isCameraEnabled) {
              if (!isCurrentRun()) return;
              const err = await enableCameraResilient(room, prefs.cameraId);
              if (err) toast.error(err);
            }
            cameraWantedRef.current = prefs.camEnabled;
            rebuildParticipantTracks(lp);
            void syncStudioProcessors(room);
          }

        } catch (err) {
          console.warn("[useRoomState] auto-publish skipped", err);
        }
      } catch (err) {
        if (!isCurrentRun()) return;
        console.error("[useRoomState] connect failed", err);
        setConnState("disconnected");
        await room.disconnect().catch(() => {});
      }
    })();

    // Ligar/desligar filtros de estúdio em direto quando o utilizador mexe no painel.
    const unsubStudio = subscribeStudio(() => {
      void syncStudioProcessors(room);
    });

    // USB capture cards and external webcams can silently end while the room
    // remains connected. Reacquire capture so a page reload is never required.
    const cameraWatch = window.setInterval(() => void recoverLocalCamera(), 4_000);
    const recoverWhenVisible = () => {
      if (document.visibilityState === "visible") void recoverLocalCamera();
    };
    document.addEventListener("visibilitychange", recoverWhenVisible);

    return () => {
      disposed = true;
      unsubStudio();
      window.clearInterval(cameraWatch);
      document.removeEventListener("visibilitychange", recoverWhenVisible);
      handlers.forEach(([evt, fn]) => {
        (room as unknown as AnyOn).off(evt, fn);
      });
      pendingDisconnectRef.current = room.disconnect().catch(() => {});
      if (roomRef.current === room) roomRef.current = null;
      setEngineTracks({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, url, reconnectNonce]);


  // ---------- projection to abstract RoomState ----------
  const mapped: RoomParticipant[] = useMemo(() => {
    return participants.map((r) => {
      const prof = profiles[r.user_id];
      return {
        userId: r.user_id,
        identity: r.user_id,
        displayName: prof?.display_name ?? r.guest_name ?? engineNames[r.user_id] ?? "Convidado",
        avatarUrl: prof?.avatar_url ?? null,
        role: r.role,
        room: r.room,
        onStage: r.on_stage,
        micAllowed: r.mic_allowed,
        camAllowed: r.cam_allowed,
        screenAllowed: r.screen_allowed,
        micOn: micOn[r.user_id],
        camOn: camOn[r.user_id],
        isScreenSharing: screenOn[r.user_id],
        isSpeaking: activeSpeakerId === r.user_id,
        connectionQuality: quality[r.user_id],
        tracks: engineTracks[r.user_id] ?? [],
        handRaisedAt: r.hand_raised_at,
        invitedToStageAt: r.invited_to_stage_at,
        banned: r.banned,
        isLocal: r.user_id === localUserId,
      } satisfies RoomParticipant;
    });
  }, [participants, profiles, engineNames, engineTracks, micOn, camOn, screenOn, activeSpeakerId, quality, localUserId]);

  const onStage = useMemo(() => mapped.filter((p) => p.onStage && p.room === "main"), [mapped]);
  const audience = useMemo(() => mapped.filter((p) => p.role === "viewer" || (!p.onStage && p.room === "main")), [mapped]);
  const backstage = useMemo(() => mapped.filter((p) => p.room === "backstage"), [mapped]);

  const localRole = useMemo(
    () => mapped.find((p) => p.userId === localUserId)?.role ?? "viewer",
    [mapped, localUserId],
  );

  const layout: StageLayout = (live?.stage_layout as StageLayout) ?? "auto";
  const effectiveLayout = resolveLayout(layout, onStage.length, live?.spotlight_user_id ?? null);

  const state: RoomState = {
    liveId,
    status: live?.status ?? "scheduled",
    mode: live?.mode ?? "interactive",
    target,
    layout,
    effectiveLayout,
    spotlightUserId: live?.spotlight_user_id ?? null,
    activeSpeakerId,
    startedAt: live?.started_at ?? null,
    wentLiveAt: live?.went_live_at ?? null,
    backstageStartedAt: live?.backstage_started_at ?? null,
    localUserId,
    localRole,
    participants: mapped,
    onStage,
    audience,
    backstage,
    connection: {
      state: connState,
      quality: quality[localUserId] ?? "good",
    },
    audioBlocked,
    enabledModules: Array.isArray(live?.enabled_modules)
      ? (live!.enabled_modules as string[])
      : live?.enabled_modules
      ? Object.keys(live.enabled_modules)
      : ["chat"],
  };


  // ---------- media actions ----------
  const toggleMic = useCallback(async () => {
    const lp: LocalParticipant | undefined = roomRef.current?.localParticipant;
    if (!lp) return;
    const next = !lp.isMicrophoneEnabled;
    // Desligar é sempre seguro; ligar pode falhar se o dispositivo mudou ou está
    // ocupado — tentamos com o mic escolhido e depois com o predefinido.
    const attempts = next
      ? [activeAudioIn ? { deviceId: activeAudioIn } : undefined, undefined]
      : [undefined];
    let lastErr: unknown = null;
    for (const opts of attempts) {
      try {
        await lp.setMicrophoneEnabled(next, opts);
        if (lp.isMicrophoneEnabled === next) return;
      } catch (err) {
        lastErr = err;
      }
    }
    console.error("[useRoomState] toggleMic failed", lastErr);
    const msg = lastErr instanceof Error ? `${lastErr.name}: ${lastErr.message}` : "";
    toast.error(
      /NotReadableError|TrackStartError/i.test(msg)
        ? "O microfone está a ser usado por outra aplicação. Fecha-a e tenta de novo."
        : "Não foi possível ligar o microfone. Verifica as permissões do browser.",
    );
  }, [activeAudioIn]);
  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    const lp = room?.localParticipant;
    if (!room || !lp) return;
    if (cameraTrackIsLive(lp)) {
      cameraWantedRef.current = false;
      // Desligar com setCameraEnabled(false) deixa a publicação viva mas com a
      // pista nativa terminada — ao voltar a ligar o vídeo ficava preto. Aqui
      // despublicamos por completo para que a nova ligação crie uma pista nova.
      const pub = lp.getTrackPublication(Track.Source.Camera);
      const track = pub?.track;
      if (track) {
        await lp.unpublishTrack(track, true).catch((e) => console.warn("[useRoomState] camera unpublish failed", e));
      }
      await lp.setCameraEnabled(false).catch((e) => console.warn("[useRoomState] camera off failed", e));
      const prefs = readMediaPrefs();
      writeMediaPrefs({ ...prefs, camEnabled: false });
      return;
    }
    cameraWantedRef.current = true;
    let err = await enableCameraResilient(room, activeVideoIn ?? undefined);
    if (err) {
      // A câmara costuma demorar a ser libertada pelo sistema depois de a
      // desligarmos — uma segunda tentativa evita o refresh da página.
      await new Promise((r) => setTimeout(r, 700));
      err = await enableCameraResilient(room, undefined);
    }
    if (err) {
      cameraWantedRef.current = false;
      toast.error(err);
    } else {
      const prefs = readMediaPrefs();
      writeMediaPrefs({ ...prefs, camEnabled: true, cameraId: activeVideoIn ?? prefs.cameraId });
    }
  }, [activeVideoIn]);

  const startScreenShare = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    try {
      await lp.setScreenShareEnabled(true, HQ_SCREEN_SHARE);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // NotAllowedError => user cancelled the OS picker; anything else is a real failure.
      if (!/NotAllowedError|Permission denied/i.test(msg)) {
        console.error("[useRoomState] startScreenShare failed", err);
        alert(`Não foi possível partilhar o ecrã: ${msg}`);
      }
    }
  }, []);
  const stopScreenShare = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    await lp.setScreenShareEnabled(false).catch((e) => console.warn("[useRoomState] stopScreenShare", e));
  }, []);
  const leave = useCallback(async () => {
    await roomRef.current?.disconnect();
  }, []);
  const startAudio = useCallback(async () => {
    try {
      await roomRef.current?.startAudio();
      setAudioBlocked(!(roomRef.current?.canPlaybackAudio ?? true));
    } catch (e) {
      console.warn("[useRoomState] startAudio failed", e);
    }
  }, []);

  const listDevices = useCallback(async (kind: "videoinput" | "audioinput") => {
    try {
      // Ensure labels are available (requires an active permission grant).
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === kind && d.deviceId)
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || (kind === "videoinput" ? `Câmara ${i + 1}` : `Microfone ${i + 1}`),
        }));
    } catch (e) {
      console.warn("[useRoomState] listDevices failed", e);
      return [];
    }
  }, []);

  const setDevice = useCallback(async (kind: "videoinput" | "audioinput", deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      if (kind === "videoinput" && !cameraTrackIsLive(room.localParticipant)) {
        cameraWantedRef.current = true;
        const error = await enableCameraResilient(room, deviceId);
        if (error) throw new Error(error);
      } else {
        await room.switchActiveDevice(kind, deviceId, true);
      }
      const prefs = readMediaPrefs();
      if (kind === "videoinput") {
        setActiveVideoIn(deviceId);
        writeMediaPrefs({ ...prefs, cameraId: deviceId, camEnabled: true });
      } else {
        setActiveAudioIn(deviceId);
        writeMediaPrefs({ ...prefs, micId: deviceId });
      }
    } catch (err) {
      console.error("[useRoomState] setDevice failed", err);
      toast.error(
        kind === "videoinput"
          ? "Essa câmara não está disponível (pode estar em uso noutra aplicação)."
          : "Esse microfone não está disponível.",
      );
      throw err;
    }
  }, []);

  const getActiveDevice = useCallback(
    (kind: "videoinput" | "audioinput") => (kind === "videoinput" ? activeVideoIn : activeAudioIn),
    [activeVideoIn, activeAudioIn],
  );

  const attachTrack = useCallback((trackId: string, el: HTMLMediaElement) => {
    const room = roomRef.current;
    if (!room) return;
    const findTrack = () => {
      for (const p of [room.localParticipant, ...room.remoteParticipants.values()]) {
        const pubs = Array.from(p.trackPublications.values() as Iterable<{ trackSid: string; track?: { attach: (el: HTMLMediaElement) => void; detach: (el: HTMLMediaElement) => void } }>);
        const pub = pubs.find((pp) => pp.trackSid === trackId);
        if (pub?.track) return pub.track;
      }
      return null;
    };
    const t = findTrack();
    t?.attach(el);
  }, []);
  const detachTrack = useCallback((trackId: string, el: HTMLMediaElement) => {
    const room = roomRef.current;
    if (!room) return;
    for (const p of [room.localParticipant, ...room.remoteParticipants.values()]) {
      const pubs = Array.from(p.trackPublications.values() as Iterable<{ trackSid: string; track?: { attach: (el: HTMLMediaElement) => void; detach: (el: HTMLMediaElement) => void } }>);
      const pub = pubs.find((pp) => pp.trackSid === trackId);
      pub?.track?.detach(el);
    }
  }, []);

  // Memoize the actions object so children that depend on it (MediaTile
  // useEffects that attach/detach tracks) don't re-run on every state tick
  // — that was causing the video tile flicker on speaker/mute events.
  const actions: RoomActions = useMemo(
    () => ({
      toggleMic,
      toggleCam,
      startScreenShare,
      stopScreenShare,
      startAudio,
      leave,
      attachTrack,
      detachTrack,
      listDevices,
      setDevice,
      getActiveDevice,
      ...serverActions,
    }),
    [toggleMic, toggleCam, startScreenShare, stopScreenShare, startAudio, leave, attachTrack, detachTrack, listDevices, setDevice, getActiveDevice, serverActions],
  );

  return { state, actions };
}


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
import { readMediaPrefs } from "@/lib/media-prefs";
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
  for (const opts of attempts) {
    try {
      await lp.setCameraEnabled(true, opts);
      if (lp.isCameraEnabled) return null;
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


  // ---------- initial fetch + realtime for live + participants ----------
  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [liveRes, partsRes] = await Promise.all([
        supabase.from("lives").select("id,status,mode,stage_layout,spotlight_user_id,started_at,went_live_at,backstage_started_at,enabled_modules").eq("id", liveId).maybeSingle(),
        supabase.from("live_participants").select("id,user_id,role,room,on_stage,mic_allowed,cam_allowed,screen_allowed,hand_raised_at,invited_to_stage_at,banned,guest_name,is_guest").eq("live_id", liveId),
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
            const idx = prev.findIndex((r) => r.id === row.id);
            if (idx === -1) return [...prev, row];
            const copy = prev.slice();
            copy[idx] = row;
            return copy;
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [liveId]);

  // ---------- LiveKit engine ----------
  useEffect(() => {
    if (!token || !url) return;
    const room = new Room(HQ_ROOM_OPTIONS);
    roomRef.current = room;

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
        });
      });
      setEngineTracks((prev) => ({ ...prev, [p.identity]: list }));
      if (p.name) setEngineNames((prev) => (prev[p.identity] === p.name ? prev : { ...prev, [p.identity]: p.name! }));
      setMicOn((prev) => ({ ...prev, [p.identity]: !p.isMicrophoneEnabled ? false : true }));
      setCamOn((prev) => ({ ...prev, [p.identity]: p.isCameraEnabled }));
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


    (async () => {
      try {
        setConnState("connecting");
        await room.connect(url, token, { autoSubscribe: true });
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
            // Honour the device + on/off choices made in the pre-join screen.
            if (prefs.cameraId) {
              await room.switchActiveDevice("videoinput", prefs.cameraId).catch(() => {});
              setActiveVideoIn(prefs.cameraId);
            }
            if (prefs.micId) {
              await room.switchActiveDevice("audioinput", prefs.micId).catch(() => {});
              setActiveAudioIn(prefs.micId);
            }
            if (allowsMic && prefs.micEnabled && !lp.isMicrophoneEnabled) {
              await lp.setMicrophoneEnabled(true).catch((e) => {
                console.warn("[useRoomState] mic auto-enable failed", e);
              });
            }
            if (allowsCam && prefs.camEnabled && !lp.isCameraEnabled) {
              await lp.setCameraEnabled(true).catch((e) => {
                console.warn("[useRoomState] cam auto-enable failed", e);
              });
            }
            rebuildParticipantTracks(lp);
            void syncStudioProcessors(room);
          }

        } catch (err) {
          console.warn("[useRoomState] auto-publish skipped", err);
        }
      } catch (err) {
        console.error("[useRoomState] connect failed", err);
        setConnState("disconnected");
      }
    })();

    // Ligar/desligar filtros de estúdio em direto quando o utilizador mexe no painel.
    const unsubStudio = subscribeStudio(() => {
      void syncStudioProcessors(room);
    });

    return () => {
      unsubStudio();
      handlers.forEach(([evt, fn]) => {
        (room as unknown as AnyOn).off(evt, fn);
      });
      room.disconnect().catch(() => {});
      roomRef.current = null;
      setEngineTracks({});
    };
  }, [token, url]);

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
    await lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled);
  }, []);
  const toggleCam = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    await lp.setCameraEnabled(!lp.isCameraEnabled);
  }, []);
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
    await room.switchActiveDevice(kind, deviceId, true);
    if (kind === "videoinput") setActiveVideoIn(deviceId);
    else setActiveAudioIn(deviceId);
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


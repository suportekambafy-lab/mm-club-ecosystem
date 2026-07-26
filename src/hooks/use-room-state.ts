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
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
  type Participant,
  type LocalParticipant,
  type ConnectionQuality as LKConnectionQuality,
  type ConnectionState,
} from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
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
}

export interface UseRoomStateArgs {
  liveId: string;
  target: "backstage" | "main";
  localUserId: string;
  /** Provided by joinRoom() server fn — the LiveKit token + wss url. */
  token: string;
  url: string;
  /** Called after the room actions dispatch to hit server RPCs. */
  serverActions: Omit<RoomActions, "toggleMic" | "toggleCam" | "startScreenShare" | "stopScreenShare" | "leave" | "attachTrack" | "detachTrack">;
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
  const [micOn, setMicOn] = useState<Record<string, boolean>>({});
  const [camOn, setCamOn] = useState<Record<string, boolean>>({});
  const [screenOn, setScreenOn] = useState<Record<string, boolean>>({});
  const [quality, setQuality] = useState<Record<string, RoomParticipant["connectionQuality"]>>({});
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

  // ---------- initial fetch + realtime for live + participants ----------
  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [liveRes, partsRes] = await Promise.all([
        supabase.from("lives").select("id,status,mode,stage_layout,spotlight_user_id,started_at,went_live_at,backstage_started_at,enabled_modules").eq("id", liveId).maybeSingle(),
        supabase.from("live_participants").select("id,user_id,role,room,on_stage,mic_allowed,cam_allowed,screen_allowed,hand_raised_at,invited_to_stage_at,banned").eq("live_id", liveId),
      ]);
      if (!mounted) return;
      if (liveRes.data) setLive(liveRes.data as LiveRow);
      const rows = (partsRes.data ?? []) as ParticipantRow[];
      setParticipants(rows);

      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
        if (!mounted) return;
        const map: Record<string, { display_name: string; avatar_url: string | null }> = {};
        for (const p of profs ?? []) map[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
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
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: { simulcast: true },
    });
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

    (async () => {
      try {
        setConnState("connecting");
        await room.connect(url, token, { autoSubscribe: true });
        setConnState("connected");
        // Snapshot existing remotes
        room.remoteParticipants.forEach((p) => rebuildParticipantTracks(p));
        rebuildParticipantTracks(room.localParticipant);
      } catch (err) {
        console.error("[useRoomState] connect failed", err);
        setConnState("disconnected");
      }
    })();

    return () => {
      handlers.forEach(([evt, fn]) => {
        // @ts-expect-error - typed passthrough
        room.off(evt, fn);
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
        displayName: prof?.display_name ?? "Membro",
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
  }, [participants, profiles, engineTracks, micOn, camOn, screenOn, activeSpeakerId, quality, localUserId]);

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
    await lp.setScreenShareEnabled(true, { audio: true });
  }, []);
  const stopScreenShare = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    await lp.setScreenShareEnabled(false);
  }, []);
  const leave = useCallback(async () => {
    await roomRef.current?.disconnect();
  }, []);

  const attachTrack = useCallback((trackId: string, el: HTMLMediaElement) => {
    const room = roomRef.current;
    if (!room) return;
    const findTrack = () => {
      for (const p of [room.localParticipant, ...room.remoteParticipants.values()]) {
        const pub = Array.from(p.trackPublications.values()).find((pp) => pp.trackSid === trackId);
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
      const pub = Array.from(p.trackPublications.values()).find((pp) => pp.trackSid === trackId);
      pub?.track?.detach(el);
    }
  }, []);

  const actions: RoomActions = {
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    leave,
    attachTrack,
    detachTrack,
    ...serverActions,
  };

  return { state, actions };
}

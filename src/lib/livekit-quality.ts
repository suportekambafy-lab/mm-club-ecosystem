import {
  AudioPresets,
  ScreenSharePresets,
  VideoPresets,
  type RoomOptions,
  type ScreenShareCaptureOptions,
  type TrackPublishDefaults,
} from "livekit-client";

/**
 * Qualidade "elite" partilhada por todas as salas MM Club.
 * - Vídeo: captura 1080p @30fps, simulcast com camadas 540p/270p
 * - Áudio: 48kHz, bitrate alto (music quality), DTX + RED para resiliência
 */
const publishDefaults: TrackPublishDefaults = {
  simulcast: true,
  videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
  videoEncoding: VideoPresets.h1080.encoding,
  videoCodec: "vp9",
  backupCodec: { codec: "vp8", encoding: VideoPresets.h720.encoding },
  screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
  audioPreset: AudioPresets.musicHighQuality,
  dtx: true,
  red: true,
  stopMicTrackOnMute: false,
};

export const HQ_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  publishDefaults,
  videoCaptureDefaults: {
    resolution: VideoPresets.h1080.resolution,
  },
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
  },
};

export const HQ_SCREEN_SHARE: ScreenShareCaptureOptions = {
  audio: true,
  selfBrowserSurface: "include",
  // Preserve the display's native pixels (especially text on Retina/4K screens).
  resolution: ScreenSharePresets.original.resolution,
  contentHint: "detail",
};

/** Separate from camera defaults: VP9/SVC forces LiveKit's screen contentHint
 * to `motion`, which sacrifices text clarity. Publish one full-resolution VP8
 * screen stream and let congestion reduce frame rate rather than resolution. */
export const HQ_SCREEN_PUBLISH: TrackPublishDefaults = {
  videoCodec: "vp8",
  backupCodec: false,
  simulcast: false,
  screenShareEncoding: ScreenSharePresets.original.encoding,
  degradationPreference: "maintain-resolution",
};

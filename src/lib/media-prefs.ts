/**
 * Local media preferences chosen in the pre-join ("green room") screen.
 * Stored in localStorage so the room engine can honour them at connect time.
 */
export interface MediaPrefs {
  cameraId?: string;
  micId?: string;
  camEnabled: boolean;
  micEnabled: boolean;
}

const KEY = "mm.live.media-prefs";

export const defaultMediaPrefs: MediaPrefs = { camEnabled: true, micEnabled: true };

export function readMediaPrefs(): MediaPrefs {
  if (typeof window === "undefined") return defaultMediaPrefs;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultMediaPrefs;
    const parsed = JSON.parse(raw) as Partial<MediaPrefs>;
    return {
      cameraId: typeof parsed.cameraId === "string" ? parsed.cameraId : undefined,
      micId: typeof parsed.micId === "string" ? parsed.micId : undefined,
      camEnabled: parsed.camEnabled !== false,
      micEnabled: parsed.micEnabled !== false,
    };
  } catch {
    return defaultMediaPrefs;
  }
}

export function writeMediaPrefs(prefs: MediaPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable */
  }
}

// Resolve the real duration of a lesson video, client-side.
//
// Strategy per source:
//  - direct file (.mp4/.webm/.mov)  → hidden <video> metadata
//  - HLS (.m3u8)                    → hls.js manifest/metadata
//  - Bunny.net embed/play           → resolve pull zone via OEmbed thumbnail,
//                                     then read the HLS playlist
//  - Panda Video                    → derive b-<zone> host, read HLS playlist
//  - Vimeo                          → public oEmbed (returns duration)
//  - YouTube                        → not available without an API key (null)

import { parseVideoUrl } from "@/lib/video-source";
import { bunnyThumbFromUrl, pandaThumbFromUrl } from "@/lib/course-duration";

/** Seconds → "12:34" (m:ss) or "1:05:20" (h:mm:ss). */
export function formatDurationFromSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function durationFromMediaElement(src: string, isHls: boolean): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.crossOrigin = "anonymous";
    let done = false;
    let hls: { destroy: () => void } | null = null;

    const finish = (value: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        hls?.destroy();
      } catch {
        /* ignore */
      }
      video.removeAttribute("src");
      resolve(value && Number.isFinite(value) && value > 0 ? value : null);
    };

    const timer = setTimeout(() => finish(null), 15000);
    video.addEventListener("loadedmetadata", () => finish(video.duration));
    video.addEventListener("error", () => finish(null));

    const canNative = video.canPlayType("application/vnd.apple.mpegurl");
    if (isHls && !canNative) {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (done) return;
          if (!Hls.isSupported()) return finish(null);
          const instance = new Hls({ enableWorker: false });
          hls = instance;
          instance.on(Hls.Events.MANIFEST_PARSED, () => {
            const d = instance.media?.duration ?? video.duration;
            if (d && Number.isFinite(d)) finish(d);
          });
          instance.on(Hls.Events.LEVEL_LOADED, (_e, data) => {
            const d = data?.details?.totalduration;
            if (d && Number.isFinite(d)) finish(d);
          });
          instance.on(Hls.Events.ERROR, (_e, data) => {
            if (data?.fatal) finish(null);
          });
          instance.loadSource(src);
          instance.attachMedia(video);
        })
        .catch(() => finish(null));
      return;
    }

    video.src = src;
  });
}

async function bunnyPlaylist(url: string): Promise<string | null> {
  const thumb = bunnyThumbFromUrl(url);
  if (thumb) return thumb.replace(/thumbnail\.jpg$/, "playlist.m3u8");
  try {
    const res = await fetch(
      `https://video.bunnycdn.com/OEmbed?url=${encodeURIComponent(url)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: string };
    const t = data.thumbnail_url;
    if (!t) return null;
    return t.replace(/\/thumbnail\.jpg.*$/, "/playlist.m3u8");
  } catch {
    return null;
  }
}

async function vimeoDuration(url: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { duration?: number };
    return data.duration && Number.isFinite(data.duration) ? data.duration : null;
  } catch {
    return null;
  }
}

/** Best-effort real duration in seconds, or null when it can't be determined. */
export async function resolveVideoDurationSeconds(
  rawUrl: string | null | undefined,
): Promise<number | null> {
  const url = (rawUrl ?? "").trim();
  if (!url) return null;
  const src = parseVideoUrl(url);

  if (src.kind === "file" && src.fileUrl) {
    return durationFromMediaElement(src.fileUrl, /\.m3u8(\?|$)/i.test(src.fileUrl));
  }
  if (src.kind === "bunny") {
    const playlist = await bunnyPlaylist(url);
    return playlist ? durationFromMediaElement(playlist, true) : null;
  }
  if (src.kind === "panda") {
    const thumb = pandaThumbFromUrl(url) ?? pandaThumbFromUrl(src.embedUrl ?? "");
    if (thumb) {
      return durationFromMediaElement(thumb.replace(/thumbnail\.jpg$/, "playlist.m3u8"), true);
    }
    return null;
  }
  if (src.kind === "vimeo") return vimeoDuration(url);
  return null;
}

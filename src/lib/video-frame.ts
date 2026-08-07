/**
 * Capture a representative poster frame from an HLS stream (used for Panda
 * Video, which only exposes a first-frame `thumbnail.jpg` — often a black or
 * dark frame). We seek to a percentage of the duration and draw that frame to
 * a canvas, mirroring the "meaningful frame" behaviour of Bunny thumbnails.
 */

const memory = new Map<string, string | null>();

export async function captureHlsFrame(
  playlistUrl: string,
  atFraction = 0.18,
): Promise<string | null> {
  if (typeof document === "undefined" || !playlistUrl) return null;
  if (memory.has(playlistUrl)) return memory.get(playlistUrl) ?? null;

  const result = await new Promise<string | null>((resolve) => {
    let settled = false;
    let hls: { destroy: () => void } | null = null;
    const video = document.createElement("video");
    video.muted = true;
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.preload = "auto";
    video.style.position = "fixed";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    video.style.width = "1px";
    video.style.height = "1px";
    document.body.appendChild(video);

    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        hls?.destroy();
      } catch {
        /* ignore */
      }
      video.remove();
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), 12000);

    const draw = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return finish(null);
        const scale = Math.min(1, 640 / w);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        finish(null);
      }
    };

    video.addEventListener("seeked", draw, { once: true });
    video.addEventListener("error", () => finish(null));
    video.addEventListener(
      "loadeddata",
      () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const target = duration > 2 ? duration * atFraction : 1;
        try {
          video.currentTime = target;
        } catch {
          draw();
        }
      },
      { once: true },
    );

    const attach = async () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = playlistUrl;
        return;
      }
      try {
        const mod = await import("hls.js");
        const Hls = mod.default;
        if (!Hls.isSupported()) return finish(null);
        const instance = new Hls({ enableWorker: false });
        hls = instance;
        instance.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) finish(null);
        });
        instance.loadSource(playlistUrl);
        instance.attachMedia(video);
      } catch {
        finish(null);
      }
    };
    void attach();
  });

  memory.set(playlistUrl, result);
  return result;
}

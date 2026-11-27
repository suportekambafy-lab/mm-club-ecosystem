/** Attach direct files or HLS streams without requiring native HLS support. */
export function attachVideoSource(video: HTMLVideoElement, url: string): () => void {
  let cancelled = false;
  let destroy: (() => void) | undefined;
  const cleanup = () => {
    cancelled = true;
    destroy?.();
    video.removeAttribute("src");
    video.load();
  };

  if (!/\.m3u8(?:\?|$)/i.test(url) || video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
    return cleanup;
  }

  void import("hls.js").then(({ default: Hls }) => {
    if (cancelled) return;
    if (!Hls.isSupported()) {
      video.src = url;
      return;
    }
    const hls = new Hls();
    destroy = () => hls.destroy();
    hls.loadSource(url);
    hls.attachMedia(video);
  }).catch(() => {
    if (!cancelled) video.src = url;
  });
  return cleanup;
}
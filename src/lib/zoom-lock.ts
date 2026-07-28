/**
 * Locks the page at scale 1 on mobile browsers.
 *
 * iOS Safari ignores `user-scalable=no` in the viewport meta tag, so pinch
 * gestures and double-tap still zoom the layout. This blocks the gesture
 * events, suppresses double-tap zoom, and restores scale 1 whenever the
 * visual viewport reports a zoomed state.
 *
 * Call from a `useEffect` (browser only). Returns a cleanup function.
 */
export function installZoomLock(): () => void {
  if (typeof window === "undefined") return () => {};

  const prevent = (event: Event) => {
    event.preventDefault();
  };

  // iOS Safari pinch-zoom
  document.addEventListener("gesturestart", prevent, { passive: false });
  document.addEventListener("gesturechange", prevent, { passive: false });
  document.addEventListener("gestureend", prevent, { passive: false });

  // Multi-touch pinch on other engines
  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length > 1) event.preventDefault();
  };
  document.addEventListener("touchmove", onTouchMove, { passive: false });

  // Double-tap zoom
  let lastTouchEnd = 0;
  const onTouchEnd = (event: TouchEvent) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 320) event.preventDefault();
    lastTouchEnd = now;
  };
  document.addEventListener("touchend", onTouchEnd, { passive: false });

  // If the browser still zoomed (e.g. restored session state), snap back by
  // re-applying the viewport meta tag.
  const resetScale = () => {
    const vv = window.visualViewport;
    if (!vv || vv.scale <= 1.01) return;
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const content = meta.getAttribute("content") ?? "";
    meta.setAttribute("content", `${content}, initial-scale=1`);
    meta.setAttribute("content", content);
  };

  window.visualViewport?.addEventListener("resize", resetScale);
  resetScale();

  return () => {
    document.removeEventListener("gesturestart", prevent);
    document.removeEventListener("gesturechange", prevent);
    document.removeEventListener("gestureend", prevent);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
    window.visualViewport?.removeEventListener("resize", resetScale);
  };
}

// Temporary diagnostic instrumentation for tab-focus/auth-refresh remount investigation.
// Enable in the browser with: localStorage.setItem("mm.debug","1"); location.reload();
// Inspect the trace: copy(window.__mmDebug) or window.__mmDebug

type Entry = { t: number; tag: string; data?: unknown };

const BUFFER_MAX = 500;

function enabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("mm.debug") === "1";
  } catch {
    return false;
  }
}

function buffer(): Entry[] {
  const w = window as unknown as { __mmDebug?: Entry[] };
  if (!w.__mmDebug) w.__mmDebug = [];
  return w.__mmDebug;
}

export function mmDebug(tag: string, data?: unknown) {
  if (!enabled()) return;
  const entry: Entry = { t: Date.now(), tag, data };
  const buf = buffer();
  buf.push(entry);
  if (buf.length > BUFFER_MAX) buf.splice(0, buf.length - BUFFER_MAX);
  // eslint-disable-next-line no-console
  console.log(`[MM-DEBUG ${new Date(entry.t).toISOString().slice(11, 23)}] ${tag}`, data ?? "");
}

let installed = false;
export function installRefreshDebug() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  if (!enabled()) return;

  document.addEventListener("visibilitychange", () => {
    mmDebug("visibility", document.visibilityState);
  });
  window.addEventListener("focus", () => mmDebug("window:focus"));
  window.addEventListener("blur", () => mmDebug("window:blur"));
  window.addEventListener("pageshow", (e) => mmDebug("pageshow", { persisted: (e as PageTransitionEvent).persisted }));
  window.addEventListener("pagehide", (e) => mmDebug("pagehide", { persisted: (e as PageTransitionEvent).persisted }));
  window.addEventListener("online", () => mmDebug("online"));
  window.addEventListener("offline", () => mmDebug("offline"));

  mmDebug("debug:installed");
}

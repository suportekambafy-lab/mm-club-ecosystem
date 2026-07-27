import { useCallback, useEffect, useState } from "react";

const DELIVERED_KEY = "mm.notifications.delivered.v1";
const ENABLED_KEY = "mm.notifications.push.enabled";

export type PushPayload = {
  id: string;
  title: string;
  body: string;
  href: string;
};

function loadDelivered(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DELIVERED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveDelivered(ids: string[]) {
  if (typeof window === "undefined") return;
  // keep the list bounded
  window.localStorage.setItem(DELIVERED_KEY, JSON.stringify(ids.slice(-200)));
}

export function isPushSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

async function readyServiceWorker(timeoutMs = 4000): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    const registration = existing ?? (await navigator.serviceWorker.register("/sw.js"));
    registration.update?.();

    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<ServiceWorkerRegistration | undefined>((resolve) =>
        window.setTimeout(() => resolve(registration), timeoutMs),
      ),
    ]);
  } catch {
    return undefined;
  }
}

/**
 * Local (on-device) notifications for the PWA / browser.
 * Mirrors whatever lands in the bell, deduped by notification id.
 */
export function useDeviceNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    setPermission(Notification.permission);
    setEnabled(window.localStorage.getItem(ENABLED_KEY) === "1");
  }, []);

  const enable = useCallback(async () => {
    if (!isPushSupported()) return false;
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    setPermission(perm);
    const ok = perm === "granted";
    setEnabled(ok);
    window.localStorage.setItem(ENABLED_KEY, ok ? "1" : "0");
    if (ok) void readyServiceWorker();
    return ok;
  }, []);

  const disable = useCallback(() => {
    setEnabled(false);
    if (typeof window !== "undefined") window.localStorage.setItem(ENABLED_KEY, "0");
  }, []);

  const deliver = useCallback(
    async (items: PushPayload[]) => {
      if (!enabled || !isPushSupported() || Notification.permission !== "granted") return;
      const delivered = loadDelivered();
      const seen = new Set(delivered);
      const fresh = items.filter((i) => !seen.has(i.id)).slice(0, 3);
      if (fresh.length === 0) return;

      // Service worker notifications are the only ones that work in installed
      // PWAs (Android/iOS); `new Notification()` throws there.
      const reg = await readyServiceWorker();

      for (const item of fresh) {
        const options: NotificationOptions = {
          body: item.body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: item.id,
          renotify: true,
          silent: false,
          data: { href: item.href },
        };
        let deliveredOk = false;
        try {
          if (reg?.showNotification) {
            await reg.showNotification(item.title, options);
            deliveredOk = true;
          } else {
            const n = new Notification(item.title, options);
            n.onclick = () => {
              window.focus();
              window.location.href = item.href;
              n.close();
            };
            deliveredOk = true;
          }
        } catch {
          // ignore delivery failures
        }
        if (deliveredOk) seen.add(item.id);
      }
      saveDelivered(Array.from(seen));
    },
    [enabled],
  );

  /** Mark items as already delivered without showing them (baseline on enable). */
  const seedDelivered = useCallback((ids: string[]) => {
    const seen = new Set(loadDelivered());
    for (const id of ids) seen.add(id);
    saveDelivered(Array.from(seen));
  }, []);

  return {
    supported: isPushSupported(),
    permission,
    enabled,
    enable,
    disable,
    deliver,
    seedDelivered,
  };
}

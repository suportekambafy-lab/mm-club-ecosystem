import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getWebPushPublicKey,
  registerWebPushDevice,
  unregisterWebPushDevice,
} from "@/lib/push.functions";

const DELIVERED_KEY = "mm.notifications.delivered.v1";
const ENABLED_KEY = "mm.notifications.push.enabled";
const ENABLED_AT_KEY = "mm.notifications.push.enabledAt";

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
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
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
  const fetchPublicKey = useServerFn(getWebPushPublicKey);
  const registerDevice = useServerFn(registerWebPushDevice);
  const unregisterDevice = useServerFn(unregisterWebPushDevice);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const [enabled, setEnabled] = useState(false);
  const [enabledAt, setEnabledAt] = useState(0);

  useEffect(() => {
    if (!isPushSupported()) return;
    setPermission(Notification.permission);
    const storedEnabled = window.localStorage.getItem(ENABLED_KEY) === "1";
    setEnabled(storedEnabled);
    const storedEnabledAt = Number(window.localStorage.getItem(ENABLED_AT_KEY) ?? "0");
    if (storedEnabled && Number.isFinite(storedEnabledAt) && storedEnabledAt > 0) {
      setEnabledAt(storedEnabledAt);
    } else if (storedEnabled) {
      const now = Date.now();
      setEnabledAt(now);
      window.localStorage.setItem(ENABLED_AT_KEY, String(now));
    }
  }, []);

  const syncSubscription = useCallback(async () => {
    if (!isPushSupported() || Notification.permission !== "granted") return false;
    const registration = await readyServiceWorker();
    if (!registration?.pushManager) return false;

    const { publicKey } = await fetchPublicKey({ data: undefined });
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = subscription.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) return false;

    await registerDevice({
      data: {
        endpoint,
        keys: { p256dh, auth },
        userAgent: navigator.userAgent,
      },
    });
    return true;
  }, [fetchPublicKey, registerDevice]);

  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    void syncSubscription();
  }, [enabled, permission, syncSubscription]);

  const enable = useCallback(async () => {
    if (!isPushSupported()) return false;
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    setPermission(perm);
    const ok = perm === "granted" && (await syncSubscription());
    setEnabled(ok);
    window.localStorage.setItem(ENABLED_KEY, ok ? "1" : "0");
    if (ok) {
      const now = Date.now();
      setEnabledAt(now);
      window.localStorage.setItem(ENABLED_AT_KEY, String(now));
      void readyServiceWorker();
    }
    return ok;
  }, [syncSubscription]);

  const disable = useCallback(async () => {
    setEnabled(false);
    setEnabledAt(0);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ENABLED_KEY, "0");
      window.localStorage.removeItem(ENABLED_AT_KEY);
    }
    const registration = await readyServiceWorker(1500);
    const subscription = await registration?.pushManager.getSubscription();
    const endpoint = subscription?.endpoint;
    await subscription?.unsubscribe().catch(() => false);
    if (endpoint) await unregisterDevice({ data: { endpoint } }).catch(() => undefined);
  }, [unregisterDevice]);

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
    enabledAt,
    enable,
    disable,
    deliver,
    seedDelivered,
  };
}

function urlBase64ToUint8Array(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

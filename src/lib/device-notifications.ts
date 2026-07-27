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
    return ok;
  }, []);

  const disable = useCallback(() => {
    setEnabled(false);
    if (typeof window !== "undefined") window.localStorage.setItem(ENABLED_KEY, "0");
  }, []);

  const deliver = useCallback(
    (items: PushPayload[]) => {
      if (!enabled || !isPushSupported() || Notification.permission !== "granted") return;
      if (typeof document !== "undefined" && document.visibilityState === "visible") return;
      const delivered = loadDelivered();
      const seen = new Set(delivered);
      const fresh = items.filter((i) => !seen.has(i.id)).slice(0, 3);
      if (fresh.length === 0) return;
      for (const item of fresh) {
        try {
          const n = new Notification(item.title, {
            body: item.body,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: item.id,
          });
          n.onclick = () => {
            window.focus();
            window.location.href = item.href;
            n.close();
          };
        } catch {
          // ignore delivery failures (unsupported constructor on some platforms)
        }
        seen.add(item.id);
      }
      saveDelivered(Array.from(seen));
    },
    [enabled],
  );

  return {
    supported: isPushSupported(),
    permission,
    enabled,
    enable,
    disable,
    deliver,
  };
}

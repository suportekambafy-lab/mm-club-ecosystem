// Push-only worker. The MM Club stays installable and keeps web push, but the
// application shell is never cached here: every page and bundle comes from the
// current deployment.
const LEGACY_CACHE_PREFIX = "mm-club-";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const legacyCaches = cacheNames.filter((name) => name.startsWith(LEGACY_CACHE_PREFIX));
      await Promise.allSettled(legacyCaches.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "MM Club";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "Tens uma nova notificação.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.id || "mm-club-notification",
      data: { href: payload.href || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const href = event.notification.data?.href || "/";
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(href);
          return;
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
const VERSION = "mm-club-fresh-runtime-2026-08-11-smart-1";
const ASSET_CACHE = `${VERSION}-assets`;
const MEDIA_CACHE = `${VERSION}-media`;


self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== VERSION && key !== ASSET_CACHE && key !== MEDIA_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "MM Club";
  const options = {
    body: payload.body || "Tens uma nova notificação.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.id || "mm-club-notification",
    data: { href: payload.href || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

const IMAGE_EXT = /\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?)$/i;

// Ficheiros com hash no nome nunca mudam de conteúdo — servem-se do disco.
function isImmutableAsset(pathname) {
  return pathname.startsWith("/assets/") || pathname.startsWith("/_build/assets/");
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit || network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    // Never let old service-worker state sit between checkout actions and the
    // server. Payment/auth mutations must always go straight to the network.
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isSensitive =
    url.pathname.startsWith("/vip") ||
    url.pathname.startsWith("/checkout") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/_server");

  if (isSensitive) {
    event.respondWith(
      fetch(new Request(request, { cache: "no-store" })).catch(() => fetch(request)),
    );
    return;
  }

  // Bundles com hash: cache-first, entram instantaneamente em visitas seguintes.
  if (isImmutableAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE).catch(() => fetch(request)));
    return;
  }

  // Imagens, ícones e tipos de letra: mostram já a versão em cache e atualizam
  // em segundo plano.
  if (IMAGE_EXT.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE).catch(() => fetch(request)));
    return;
  }

  // Navegação (HTML): sempre rede primeiro, sem cache do navegador. O Safari
  // guarda documentos de forma agressiva, por isso forçamos no-store e só
  // usamos cache como rede de emergência offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(new Request(request, { cache: "no-store" }))
        .then((response) => {
          if (response && response.ok) {
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || fetch(request)),
    );
    return;
  }

  const shouldRevalidate =
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.startsWith("/academia") ||
    url.pathname.startsWith("/admin");

  if (!shouldRevalidate) return;

  event.respondWith(
    fetch(new Request(request, { cache: "reload" })).catch(() => fetch(request)),
  );
});

self.addEventListener("notificationclick", (event) => {
  const href = (event.notification.data && event.notification.data.href) || "/";
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

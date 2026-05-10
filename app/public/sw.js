/* buffy-search service worker */
const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const SHELL_URLS = ["/", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_URLS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Same-origin only
  if (url.origin !== self.location.origin) return;

  // /api: always network, never cache
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests: network-first with offline fallback
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          // Best-effort cache the navigation response for next time
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const cached = await cache.match(req);
          if (cached) return cached;
          const offline = await cache.match("/offline.html");
          return (
            offline ||
            new Response("Offline", { status: 503, statusText: "offline" })
          );
        }
      })()
    );
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      })()
    );
  }
});

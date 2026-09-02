// Siko Mendo HRMIS service worker
//
// Scope of "offline support" here, deliberately: this does NOT let you
// browse employee, leave, or cooperative data while offline — that data is
// sensitive and permission-gated, and caching it would risk showing stale
// or wrong-permission information. What this DOES do:
//
//   1. Makes the app installable to a home screen (a real PWA).
//   2. Caches static assets (JS/CSS/icons) so repeat loads are fast even on
//      a slow or flaky connection.
//   3. Shows a friendly "you're offline" page instead of the browser's
//      default error screen when a navigation fails with no connectivity —
//      genuinely useful for the intermittent connections common in
//      Bale Robe, without pretending to offer real offline data access.

const CACHE_NAME = "siko-mendo-static-v1";
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET — never intercept mutations (form actions, API calls).
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Next.js build assets are content-hashed and safe to cache aggressively.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Page navigations: always try the network first (this is where live HR
  // data lives). Only fall back to the offline page if the network request
  // fails entirely — never serve a cached/stale version of a data page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Everything else (API routes, server actions, RSC data fetches): pass
  // straight through to the network, uncached, always.
});

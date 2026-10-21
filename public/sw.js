// Cache version. Bump this whenever the caching rules change so the activate
// handler deletes the previous cache. v2 dropped the authenticated routes:
// v1 cached /leads, /dashboard and friends, which left real client names,
// email addresses and phone numbers sitting in a shared Cache Storage bucket.
const CACHE_NAME = "agentflow-v2";

const APP_SHELL = [
  "/",
  "/login",
  "/signup",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/**
 * Routes that render the signed-in user's own data.
 *
 * These are never cached. Cache Storage is one shared bucket keyed by URL,
 * with no per-user partitioning: a cached /leads would be served to whoever
 * next opens that page on the device — including the same user after signing
 * out, and including a second account on a shared browser profile.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/leads",
  "/pipeline",
  "/follow-ups",
  "/settings",
];

function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

// Install — cache core app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache for navigation
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  // Skip non-GET, API, and cross-origin requests (Turnstile, analytics, etc.)
  // — prevents stale cached cross-origin responses from breaking 3rd-party widgets
  if (
    request.method !== "GET" ||
    request.url.includes("/api/") ||
    requestUrl.origin !== self.location.origin
  ) {
    return;
  }

  const isProtected = isProtectedPath(requestUrl.pathname);

  // Navigation requests: network first, fallback to cached shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Authenticated pages are never written to the cache.
          if (!isProtected) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: fall back to the cached public shell.
          return caches.match("/");
        })
    );
    return;
  }

  // Authenticated non-navigation requests (fetch/XHR to a protected route)
  // are not intercepted at all — they must never be cached.
  if (isProtected) return;

  // Static assets: cache first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Only cache same-origin successful responses
        if (
          response.ok &&
          request.url.startsWith(self.location.origin)
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

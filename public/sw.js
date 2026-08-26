const SHELL_CACHE = "app-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add("/"))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first passthrough — only used to satisfy installability and to
// hand back the shell page when fully offline. Never touches the model
// cache (see lib/separation/modelSource.ts), which manages its own store.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(
      () => caches.match(event.request).then((cached) => cached || caches.match("/"))
    )
  );
});

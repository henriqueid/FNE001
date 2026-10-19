/* Somente o aviso estático é armazenado. APIs, arquivos e páginas autenticadas seguem pela rede. */
const OFFLINE_CACHE = "strato-offline-v1";
const OFFLINE_URL = "/offline.html";
self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.add(OFFLINE_URL);
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(key => key.startsWith("strato-offline-") && key !== OFFLINE_CACHE).map(key => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    request.mode !== "navigate" ||
    url.origin !== self.location.origin ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/")
  )
    return;
  event.respondWith(
    (async () => {
      try {
        return await fetch(request, { cache: "no-store" });
      } catch {
        const cache = await caches.open(OFFLINE_CACHE);
        return (
          (await cache.match(OFFLINE_URL)) ||
          new Response("STRATO sem conexão. Reconecte para acessar seus dados.", {
            status: 503,
            headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
          })
        );
      }
    })(),
  );
});

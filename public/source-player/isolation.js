// Limit isolation to this player and its decoder workers.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/source-player/")) return;
  event.respondWith((async () => {
    const response = await fetch(event.request);
    const headers = new Headers(response.headers);
    headers.set("Document-Isolation-Policy", "isolate-and-credentialless");
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Embedder-Policy", "credentialless");
    return new Response(response.body, { status: response.status, headers });
  })());
});

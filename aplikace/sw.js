/* Service worker: aplikace se otevře rychle i při slabém signálu v dílně.
   Vždy zkusí nejnovější verzi ze sítě, bez sítě použije poslední uloženou. Data (databáze) se neukládají. */
const VERZE = "__VERZE__";
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VERZE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERZE);
    try {
      const r = await fetch(e.request);
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    } catch (err) {
      const c = await cache.match(e.request, { ignoreSearch: true });
      if (c) return c;
      throw err;
    }
  })());
});

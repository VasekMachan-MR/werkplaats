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

/* Notifikace na telefon (Vašek 31.10.2026): zákazník podepsal / odsouhlasil doklad v E-servisce */
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { text: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titulek || "Werkplaats", {
    body: d.text || "", icon: "ikony/ikona-192.png", badge: "ikony/ikona-192.png", tag: d.tag || undefined, data: { url: d.url || "/" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const cil = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const okna = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const o of okna) if (new URL(o.url).origin === self.location.origin) { await o.focus(); try { await o.navigate(cil); } catch { o.postMessage({ otevrit: cil }); } return; }
    await self.clients.openWindow(cil);
  })());
});

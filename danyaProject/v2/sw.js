/* Сервис-воркер платформы: постоянный кэш картинок (эмблемы, лица, флаги).
   Картинки отдаются из кэша мгновенно; локальные — тихо обновляются в фоне,
   флаги (flagcdn) считаются вечными и после первого раза работают офлайн. */
const CACHE = "scout-img-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

function isImageUrl(url) {
  if (url.hostname === "flagcdn.com") return true;
  return /\/(imagedb\/(logos|faces)|v2\/(logos|faces))\//.test(url.pathname);
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (!isImageUrl(url)) return;
  const isFlag = url.hostname === "flagcdn.com";

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request);
    const fetchAndPut = async () => {
      const r = await fetch(e.request);
      if (r && (r.ok || r.type === "opaque")) cache.put(e.request, r.clone());
      return r;
    };
    if (hit) {
      // локальные файлы обновляем в фоне (вдруг вы заменили картинку),
      // флаги не перепроверяем вовсе
      if (!isFlag) e.waitUntil(fetchAndPut().catch(() => {}));
      return hit;
    }
    return fetchAndPut();
  })());
});

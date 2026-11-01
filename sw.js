// v10: アプリ本体はネット優先（更新がすぐ反映される）、オフライン時はキャッシュを使う
const CACHE_NAME = "health-note-shell-v10d";
const CDN_CACHE = "health-note-ai-cdn-v9";
const SHELL = ["./", "./index.html", "./app.js", "./search.js", "./food-db.js", "./kyushoku.js", "./ai.js", "./fortune.js", "./fortune-data.js", "./manifest.webmanifest", "./icon-192.svg", "./icon-512.svg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("health-note-") && k !== CACHE_NAME && k !== CDN_CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === self.location.origin) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(r, copy)); } return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(c => c || (r.mode === "navigate" ? caches.match("./index.html") : Response.error()))));
    return;
  }
  // AIの実行環境（CDN）はキャッシュ優先。モデル本体はTransformers.jsが自分でキャッシュする
  if (u.hostname === "cdn.jsdelivr.net") {
    e.respondWith(caches.open(CDN_CACHE).then(async c => { const hit = await c.match(r); if (hit) return hit; const res = await fetch(r); if (res.ok && res.type !== "opaque") c.put(r, res.clone()); return res; }));
  }
});

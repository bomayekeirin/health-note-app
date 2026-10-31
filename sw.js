const CACHE_NAME="health-note-shell-v9";
const CDN_CACHE="health-note-ai-cdn-v9";
const SHELL=["./","./index.html","./food-db.js","./food_database_v9.json","./ai.js","./manifest.webmanifest","./icon-192.svg","./icon-512.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith("health-note-shell-")||k.startsWith("health-note-ai-cdn-"))&&k!==CACHE_NAME&&k!==CDN_CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);if(u.origin===self.location.origin){e.respondWith(caches.match(r).then(c=>c||fetch(r).then(res=>{if(res.ok)caches.open(CACHE_NAME).then(cache=>cache.put(r,res.clone()));return res}).catch(()=>caches.match("./index.html"))));return}if(u.hostname==="cdn.jsdelivr.net"){e.respondWith(caches.open(CDN_CACHE).then(async c=>{const hit=await c.match(r);if(hit)return hit;const res=await fetch(r);if(res.ok&&res.type!=="opaque")await c.put(r,res.clone());return res}))}});

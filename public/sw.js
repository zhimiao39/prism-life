const CACHE='quiet-evening-v1.7.0';
const ASSETS=['./','./index.html','./style.css','./app.js','./core.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'}))))));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')e.waitUntil(self.skipWaiting())});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('quiet-evening-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.pathname.endsWith('/version.json')){e.respondWith(fetch(e.request,{cache:'no-store'}));return}
 e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)))}return r}).catch(async()=>{const cache=await caches.open(CACHE);return await cache.match(e.request,{ignoreSearch:e.request.mode==='navigate'})||(e.request.mode==='navigate'?await cache.match('./index.html'):null)||Response.error()}));
});

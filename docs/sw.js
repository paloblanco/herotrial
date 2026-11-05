// BLOCKO3D: keeps this game's files on the device so it plays offline (build 7367d2f4)
const CACHE = 'b3d-' + self.registration.scope + '-7367d2f4';
const FILES = ["./","index.html","hero-trial.js","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  const mine = 'b3d-' + self.registration.scope + '-';
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(mine) && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true }))
    .then((hit) => hit || fetch(e.request)));
});

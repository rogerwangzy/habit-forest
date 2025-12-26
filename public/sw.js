// Very small cache-first service worker for Vite static build
const CACHE = 'forest-habbit-v1';
const CORE = [
  '/',
  '/index.html'
];
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((res) => {
      const fetchPromise = fetch(e.request).then((networkRes) => {
        const copy = networkRes.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return networkRes;
      }).catch(() => res);
      return res || fetchPromise;
    })
  );
});

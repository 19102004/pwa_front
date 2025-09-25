const CACHE_NAME = 'app-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/src/App.jsx',
  '/src/App.css',
  '/main.jsx',
  '/src/components/Login.jsx',
  '/src/components/Login.css',
  '/src/components/Dashboard.jsx',
  '/src/components/Dashboard.css',
  '/src/assets/cb190r.png',
  '/src/assets/cbr.png',
  '/src/assets/invicta.png',
  '/src/assets/fireblade.png',
  '/src/assets/twister.png',
];

self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return caches.match(event.request, { ignoreSearch: true }).then((res) => {
            return res || caches.match('/src/assets/cbr.png');
          });
        });
    })
  );
});

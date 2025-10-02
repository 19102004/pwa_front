const CACHE_NAME = 'pwa';
const RUNTIME_CACHE = 'cache-v5';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/assets/index-D69C9t-t.css',
  '/assets/index-NVqVFRAW.js',
  '/cb190r.png',
  '/cbr.png',
  '/fireblade.png',
  '/invicta.png',
  '/twister.png'
];

const CACHE_PATTERNS = [
  /\/assets\/.*\.(js|css)$/,
  /\.(png|jpg|jpeg|gif|webp|svg|ico)$/,
  /\/manifest\.json$/
];

function shouldAutoCache(url) {
  return CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

self.addEventListener('install', (event) => {
  console.log('[SW] 🔧 Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 📦 Abriendo cache:', CACHE_NAME);
        
        const cachePromises = PRECACHE_URLS.map(url => {
          return fetch(url)
            .then(response => {
              if (response.ok) {
                console.log('[SW] ✅ Cacheado:', url);
                return cache.put(url, response);
              } else {
                console.warn('[SW] ⚠ No se pudo cachear (status ' + response.status + '):', url);
                return null; 
              }
            })
            .catch(err => {
              console.warn('[SW] ⚠ Error cacheando (continuando):', url, err.message);
              return null; 
            });
        });
        
        return Promise.all(cachePromises);
      })
      .then(() => {
        console.log('[SW] ⚡ Activando inmediatamente...');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] 💥 Error en instalación:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] 🚀 Activando Service Worker...');
  
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        const deletePromises = cacheNames
          .filter(cacheName => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map(cacheName => {
            console.log('[SW] 🗑 Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          });
        return Promise.all(deletePromises);
      }),
      self.clients.claim().then(() => {
        console.log('[SW] 👍 Tomando control de las páginas');
      })
    ]).then(() => {
      console.log('[SW] ✨ Service Worker activado y listo');
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) {
    return;
  }

  if (request.method !== 'GET') {
    return;
  }

  console.log('[SW] 🌐 Fetch:', url.pathname);

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] 📂 Desde cache:', url.pathname);
          
          if (navigator.onLine !== false) {
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                  caches.open(RUNTIME_CACHE).then((cache) => {
                    console.log('[SW] 🔄 Actualizando cache:', url.pathname);
                    cache.put(request, networkResponse);
                  }).catch((err) => {
                    console.warn('[SW] ⚠ Error actualizando cache:', err);
                  });
                }
              })
              .catch((error) => {
                console.log('[SW] 📡 Sin conexión para actualizar cache:', url.pathname);
              });
          }
          
          return cachedResponse;
        }

        if (navigator.onLine === false) {
          console.log('[SW] 📡 Sin conexión, buscando fallback para:', url.pathname);
          
          if (url.pathname === '/' || request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html').then((fallback) => {
              if (fallback) {
                console.log('[SW] 🏠 Sirviendo fallback: /index.html para', url.pathname);
                return fallback;
              }
              return new Response('Sin conexión - Recurso no disponible', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
              });
            });
          }
          
          return new Response('Recurso no disponible sin conexión', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        }

        console.log('[SW] 🌍 Desde red:', url.pathname);
        return fetch(request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200) {
              console.warn('[SW] ⚠ Respuesta no válida:', url.pathname, networkResponse?.status);
              return networkResponse;
            }

            if (shouldAutoCache(url)) {
              const responseToCache = networkResponse.clone();
              
              caches.open(RUNTIME_CACHE)
                .then((cache) => {
                  console.log('[SW] 💾 Guardando en cache:', url.pathname);
                  cache.put(request, responseToCache);
                })
                .catch((err) => {
                  console.error('[SW] ❌ Error guardando en cache:', err);
                });
            }

            return networkResponse;
          })
          .catch((error) => {
            console.error('[SW] 💥 Error de red:', url.pathname, error.message);
            
            if (url.pathname === '/' || request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/index.html').then((fallback) => {
                if (fallback) {
                  console.log('[SW] 🏠 Sirviendo fallback: /index.html para', url.pathname);
                  return fallback;
                }
                return new Response('Sin conexión - Página no disponible', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/html' }
                });
              });
            }
            
            return new Response('Recurso no disponible', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

self.addEventListener('message', (event) => {
  console.log('[SW] 📨 Mensaje recibido:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(RUNTIME_CACHE).then(cache => {
      urls.forEach(url => {
        fetch(url).then(response => {
          if (response.ok) {
            cache.put(url, response);
            console.log('[SW] 📥 Cacheado bajo demanda:', url);
          }
        });
      });
    });
  }
});

self.addEventListener('online', () => {
  console.log('[SW] 🌐 Conexión restaurada');
});

self.addEventListener('offline', () => {
  console.log('[SW] 📡 Sin conexión');
});

console.log('[SW] 🎬 Service Worker cargado');
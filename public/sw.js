
const CACHE_NAME = 'pwa';
const RUNTIME_CACHE = 'cache-v5';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/assets/index.css',
  '/assets/index.js',
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

const IDB_NAME = 'pwa-cart-db';
const IDB_VERSION = 1;
const IDB_STORE = 'cartQueue';

function openCartDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbAddCartRecord(record) {
  const db = await openCartDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).add({ ...record, createdAt: Date.now() });
  });
}

async function idbGetAllCartRecords() {
  const db = await openCartDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbClearCartStore() {
  const db = await openCartDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

self.addEventListener('install', (event) => {
  console.log('[SW] 🔧 Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 📦 Abriendo cache:', CACHE_NAME);
        return Promise.all(PRECACHE_URLS.map(url => 
          fetch(url).then(response => {
            if (response.ok) {
              console.log('[SW] ✅ Cacheado:', url);
              return cache.put(url, response);
            }
          }).catch(err => console.warn('[SW] ⚠ Error cacheando:', url, err))
        ));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] 🚀 Activando Service Worker...');
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map(name => caches.delete(name))
        );
      }),
      self.clients.claim()
    ])
  );
});


self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) return;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {

        fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, networkResponse.clone()));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      if (!navigator.onLine) {
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
        return new Response('Recurso no disponible sin conexión', { status: 503 });
      }

      return fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.ok && shouldAutoCache(url)) {
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'ADD_TO_CART') {
    idbAddCartRecord(event.data.item)
      .then(() => {
        console.log('[SW] 📥 Formulario guardado en IndexedDB', event.data.item);
        processCartQueue();
      })
      .catch(err => console.error('[SW] ❌ Error guardando formulario', err));
  }

  if (event.data.type === 'PROCESS_QUEUE') {
    processCartQueue();
  }
});

self.addEventListener('online', () => {
  console.log('[SW] 🌐 Conexión restaurada');
  processCartQueue();
});

self.addEventListener('offline', () => {
  console.log('[SW] 📡 Sin conexión');
});

async function processCartQueue() {
  try {
    const items = await idbGetAllCartRecords();
    if (!items.length) return;

    console.log('[SW] 🔄 Enviando cola', items);

    const endpoint = 'http://localhost:4000/cotizacion'; 

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items)
    });

    if (!res.ok) throw new Error('Respuesta no OK');

    await idbClearCartStore();
    console.log('[SW] ✅ Cola sincronizada y limpiada');

    const allClients = await self.clients.matchAll({ includeUncontrolled: true });
    allClients.forEach(client => client.postMessage({ type: 'QUOTATIONS_SYNCED' }));

  } catch (err) {
    console.warn('[SW] ⚠ No se pudo sincronizar la cola', err);
  }
}

console.log('[SW] 🎬 Service Worker cargado');

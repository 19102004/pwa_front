const CACHE_NAME = 'pwa';
const RUNTIME_CACHE = 'cache-v5';
const IDB_NAME = 'pwa-cart-db';
const IDB_VERSION = 1;
const IDB_STORE = 'cartQueue';

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

// ======== IndexedDB Helpers ========

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
    tx.objectStore(IDB_STORE).add({ ...record, createdAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
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

async function idbDeleteRecord(id) {
  const db = await openCartDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ======== Instalar / Activar ========

self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        PRECACHE_URLS.map(url =>
          fetch(url)
            .then(res => res.ok && cache.put(url, res))
            .catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (![CACHE_NAME, RUNTIME_CACHE].includes(k)) {
          return caches.delete(k);
        }
      }))
    ).then(() => self.clients.claim())
  );
});

// ======== Estrategia de cache ========

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin || request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Actualiza en segundo plano
        fetch(request).then(res => {
          if (res.ok) {
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }

      // Sin conexión → intenta servir index.html
      return fetch(request).catch(() =>
        caches.match('/index.html')
      );
    })
  );
});

// ======== Mensajes desde cliente ========

self.addEventListener('message', event => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'ADD_TO_CART':
      idbAddCartRecord(event.data.item)
        .then(() => console.log('[SW] Guardado offline:', event.data.item))
        .catch(err => console.error('[SW] Error guardando offline', err));
      break;

    case 'PROCESS_QUEUE':
      processCartQueue();
      break;
  }
});

// ======== Procesar cola offline ========

async function processCartQueue() {
  try {
    const items = await idbGetAllCartRecords();
    if (!items.length) return;

    console.log('[SW] Intentando reenviar', items.length, 'cotizaciones...');

    const endpoint = 'http://localhost:4000/cotizacion';

    for (const item of items) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });

        if (res.ok) {
          await idbDeleteRecord(item.id);
          console.log('[SW] ✅ Enviada cotización offline:', item);

          // Notifica al cliente React
          const allClients = await self.clients.matchAll({ includeUncontrolled: true });
          allClients.forEach(client =>
            client.postMessage({ type: 'QUOTATION_SYNCED', item })
          );
        }
      } catch (err) {
        console.warn('[SW] ⚠ Error enviando', item, err);
      }
    }
  } catch (err) {
    console.error('[SW] ❌ Error procesando la cola', err);
  }
}

console.log('[SW] 🎬 Cargado');

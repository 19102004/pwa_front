const CACHE_NAME = 'pwa-v8'; // ⭐ Nueva versión
const RUNTIME_CACHE = 'cache-v8';
const IDB_NAME = 'pwa-cart-db';
const IDB_VERSION = 1;
const IDB_STORE = 'cartQueue';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
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
    const store = tx.objectStore(IDB_STORE);
    const request = store.add({ ...record, createdAt: Date.now() });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
    const deleteRequest = tx.objectStore(IDB_STORE).delete(id);
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onerror = () => reject(deleteRequest.error);
  });
}

// ======== Instalar / Activar ========

self.addEventListener('install', event => {
  console.log('[SW] 🔧 Instalando versión', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        PRECACHE_URLS.map(url =>
          fetch(url)
            .then(res => {
              if (res.ok) {
                return cache.put(url, res);
              }
              console.warn(`[SW] ⚠️ No se pudo cachear ${url}`);
            })
            .catch(err => console.warn(`[SW] ⚠️ Error cacheando ${url}:`, err))
        )
      )
    ).then(() => {
      console.log('[SW] ✅ Precache completado');
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] 🔄 Activando nueva versión');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (![CACHE_NAME, RUNTIME_CACHE].includes(k)) {
          console.log('[SW] 🗑️ Eliminando cache antigua:', k);
          return caches.delete(k);
        }
      }))
    ).then(() => {
      console.log('[SW] ✅ Service Worker activado');
      return self.clients.claim();
    })
  );
});

// ======== Estrategia de cache ========
// ⭐ CRÍTICO: NO interceptar requests a la API
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ⭐ NO INTERCEPTAR requests a la API externa
  if (url.origin.includes('pwa-back-h0cr.onrender.com')) {
    console.log('[SW] 🌐 Dejando pasar request a API:', request.method, url.pathname);
    return; // Dejar pasar sin interceptar
  }

  // Solo cachear GET del mismo origen
  if (url.origin !== location.origin || request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Actualiza en segundo plano si hay conexión
        fetch(request).then(res => {
          if (res && res.ok) {
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }

      // No hay cache, intenta fetch
      return fetch(request).then(response => {
        // Si es un recurso que debe cachearse, guárdalo
        if (response.ok && shouldAutoCache(url)) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Sin conexión, intenta servir index.html para SPA
        return caches.match('/index.html');
      });
    })
  );
});

// ======== Mensajes desde cliente ========

self.addEventListener('message', event => {
  if (!event.data) return;

  console.log('[SW] 📨 Mensaje recibido:', event.data.type);

  switch (event.data.type) {
    case 'ADD_TO_CART':
      handleAddToCart(event);
      break;

    case 'PROCESS_QUEUE':
      processCartQueue();
      break;

    case 'CHECK_QUEUE':
      checkQueueStatus(event);
      break;
  }
});

// ⭐ Variable para evitar procesamiento simultáneo
let isProcessingQueue = false;

// Manejar guardado offline
async function handleAddToCart(event) {
  try {
    // ⭐ Verificar si ya existe este registro (evitar duplicados)
    const existingItems = await idbGetAllCartRecords();
    const isDuplicate = existingItems.some(item => 
      item.nombre === event.data.item.nombre &&
      item.telefono === event.data.item.telefono &&
      item.moto === event.data.item.moto &&
      (Date.now() - item.createdAt) < 5000 // Menos de 5 segundos
    );

    if (isDuplicate) {
      console.warn('[SW] ⚠️ Cotización duplicada detectada, ignorando...');
      if (event.source) {
        event.source.postMessage({
          type: 'CART_SAVED',
          success: false,
          error: 'Cotización duplicada'
        });
      }
      return;
    }

    const id = await idbAddCartRecord(event.data.item);
    console.log('[SW] 💾 Guardado offline con ID:', id);
    
    // Confirmar al cliente
    if (event.source) {
      event.source.postMessage({
        type: 'CART_SAVED',
        success: true,
        item: { ...event.data.item, id }
      });
    }

    // ⭐ NO procesar inmediatamente si estamos online
    // Dejar que el Dashboard lo envíe directamente
    console.log('[SW] ℹ️ Cotización guardada, esperando reconexión para enviar');
    
  } catch (error) {
    console.error('[SW] ❌ Error guardando offline:', error);
    if (event.source) {
      event.source.postMessage({
        type: 'CART_SAVED',
        success: false,
        error: error.message
      });
    }
  }
}

// Verificar estado de la cola
async function checkQueueStatus(event) {
  try {
    const items = await idbGetAllCartRecords();
    if (event.source) {
      event.source.postMessage({
        type: 'QUEUE_STATUS',
        count: items.length,
        items
      });
    }
  } catch (error) {
    console.error('[SW] ❌ Error verificando cola:', error);
  }
}

// ======== Procesar cola offline ========

async function processCartQueue() {
  try {
    const items = await idbGetAllCartRecords();
    
    if (!items.length) {
      console.log('[SW] ✅ Cola vacía, nada que enviar');
      return;
    }

    console.log(`[SW] 📤 Procesando ${items.length} cotizaciones pendientes...`);

    const endpoint = 'https://pwa-back-h0cr.onrender.com/cotizacion';
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      try {
        console.log('[SW] 🚀 Enviando cotización:', item.nombre);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            nombre: item.nombre,
            telefono: item.telefono,
            moto: item.moto
          })
        });

        const responseText = await response.text();
        console.log('[SW] 📥 Respuesta del servidor:', response.status, responseText);

        if (response.ok) {
          await idbDeleteRecord(item.id);
          successCount++;
          console.log('[SW] ✅ Cotización enviada y eliminada de cola:', item.nombre);

          // Notificar al cliente
          const allClients = await self.clients.matchAll({ includeUncontrolled: true });
          allClients.forEach(client =>
            client.postMessage({ 
              type: 'QUOTATION_SYNCED', 
              item,
              success: true
            })
          );
        } else {
          failCount++;
          console.error('[SW] ❌ Error HTTP:', response.status, responseText);
        }
      } catch (err) {
        failCount++;
        console.error('[SW] ❌ Error de red enviando cotización:', err);
      }
    }

    console.log(`[SW] 📊 Resultado: ${successCount} éxito, ${failCount} fallos`);

    // Notificar resumen al cliente
    const allClients = await self.clients.matchAll({ includeUncontrolled: true });
    allClients.forEach(client =>
      client.postMessage({ 
        type: 'SYNC_COMPLETE',
        successCount,
        failCount,
        total: items.length
      })
    );

  } catch (err) {
    console.error('[SW] ❌ Error crítico procesando cola:', err);
  }
}

// Auto-sincronizar cuando se recupera conexión
self.addEventListener('online', () => {
  console.log('[SW] 🌐 Conexión restaurada, procesando cola...');
  setTimeout(() => processCartQueue(), 2000); // Delay de 2s para estabilidad
});

// ======== Notificaciones Push ========

self.addEventListener('push', event => {
  console.log('[SW] 📬 Notificación push recibida');

  let notificationData = {
    title: 'Notificación',
    body: 'Tienes una nueva actualización',
    icon: '/cb190r.png',
    badge: '/cb190r.png',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      notificationData = event.data.json();
      console.log('[SW] 📋 Datos de notificación:', notificationData);
    } catch (err) {
      console.error('[SW] ❌ Error parseando notificación:', err);
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || '/cb190r.png',
    badge: notificationData.badge || '/cb190r.png',
    data: notificationData.data,
    tag: notificationData.tag || 'default-notification',
    requireInteraction: notificationData.requireInteraction || false,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Abrir', icon: '/cb190r.png' },
      { action: 'close', title: 'Cerrar', icon: '/cb190r.png' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('[SW] 🖱️ Click en notificación:', event.action);
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (let client of windowClients) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

console.log('[SW] 🎬 Service Worker cargado - Versión', CACHE_NAME);
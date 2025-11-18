const CACHE_NAME = 'pwa-v9'; // ⭐ Nueva versión
const RUNTIME_CACHE = 'cache-v9';
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

// ⭐ Variables de control
let isProcessingQueue = false;
let processingTimeout = null;

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
    
    // ⭐ Crear registro con timestamp único
    const uniqueRecord = {
      ...record,
      createdAt: Date.now(),
      uniqueId: `${record.nombre}-${record.telefono}-${Date.now()}`
    };
    
    const request = store.add(uniqueRecord);
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
            })
            .catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
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
    ).then(() => self.clients.claim())
  );
});

// ======== Estrategia de cache ========

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ⭐ NO INTERCEPTAR requests a la API
  if (url.origin.includes('pwa-back-h0cr.onrender.com')) {
    return;
  }

  // Solo cachear GET del mismo origen
  if (url.origin !== location.origin || request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        fetch(request).then(res => {
          if (res && res.ok) {
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(request).then(response => {
        if (response.ok && shouldAutoCache(url)) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        return caches.match('/index.html');
      });
    })
  );
});

// ======== Mensajes desde cliente ========

self.addEventListener('message', event => {
  if (!event.data) return;

  console.log('[SW] 📨 Mensaje:', event.data.type);

  switch (event.data.type) {
    case 'ADD_TO_CART':
      handleAddToCart(event);
      break;

    case 'PROCESS_QUEUE':
      scheduleQueueProcessing();
      break;

    case 'CHECK_QUEUE':
      checkQueueStatus(event);
      break;
  }
});

// ⭐ Guardar offline (SIN enviar inmediatamente)
async function handleAddToCart(event) {
  try {
    const id = await idbAddCartRecord(event.data.item);
    console.log('[SW] 💾 Guardado offline con ID:', id);
    
    if (event.source) {
      event.source.postMessage({
        type: 'CART_SAVED',
        success: true,
        item: { ...event.data.item, id }
      });
    }

    // ⭐ NO procesar inmediatamente, esperar evento 'online'
    
  } catch (error) {
    console.error('[SW] ❌ Error guardando:', error);
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

// ⭐ Programar procesamiento de cola (evita llamadas múltiples)
function scheduleQueueProcessing() {
  // Cancelar cualquier procesamiento pendiente
  if (processingTimeout) {
    clearTimeout(processingTimeout);
  }

  // Programar nuevo procesamiento
  processingTimeout = setTimeout(() => {
    if (!isProcessingQueue) {
      processCartQueue();
    }
  }, 2000); // 2 segundos de delay
}

// ======== Procesar cola offline ========

async function processCartQueue() {
  if (isProcessingQueue) {
    console.log('[SW] ⏸️ Procesamiento ya en curso');
    return;
  }

  try {
    isProcessingQueue = true;
    
    const items = await idbGetAllCartRecords();
    
    if (!items.length) {
      console.log('[SW] ✅ Cola vacía');
      isProcessingQueue = false;
      return;
    }

    console.log(`[SW] 📤 Procesando ${items.length} cotización(es)...`);

    const endpoint = 'https://pwa-back-h0cr.onrender.com/cotizacion';
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      try {
        console.log(`[SW] 🚀 Enviando: ${item.nombre}`);

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

        if (response.ok) {
          await idbDeleteRecord(item.id);
          successCount++;
          console.log(`[SW] ✅ Enviada: ${item.nombre}`);
        } else {
          failCount++;
          console.error(`[SW] ❌ Error HTTP ${response.status}`);
        }
      } catch (err) {
        failCount++;
        console.error('[SW] ❌ Error de red:', err.message);
      }

      // Pequeña pausa entre envíos
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`[SW] 📊 Resultado: ${successCount} éxito, ${failCount} fallos`);

    // ⭐ Enviar UNA SOLA notificación al cliente
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
    console.error('[SW] ❌ Error crítico:', err);
  } finally {
    isProcessingQueue = false;
  }
}

// ⭐ Auto-sincronizar cuando se recupera conexión
self.addEventListener('online', () => {
  console.log('[SW] 🌐 Conexión restaurada');
  scheduleQueueProcessing();
});

// ======== Notificaciones Push ========

self.addEventListener('push', event => {
  console.log('[SW] 📬 Push recibido');

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
    } catch (err) {
      console.error('[SW] ❌ Error parseando push:', err);
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
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('[SW] 🖱️ Click en notificación');
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

console.log('[SW] 🎬 Cargado - Versión', CACHE_NAME);
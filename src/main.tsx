import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// ============================================
// 📦 CONFIGURACIÓN DE INDEXEDDB
// ============================================
const db: IDBOpenDBRequest = window.indexedDB.open('database');
db.onupgradeneeded = (event: IDBVersionChangeEvent) => {
  const result: IDBDatabase = (event.target as IDBOpenDBRequest).result;
  result.createObjectStore('table', { autoIncrement: true });
};

// ============================================
// 🔧 SERVICE WORKER
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[SW] ✅ Service Worker registrado correctamente');
        console.log('[SW] Scope:', registration.scope);
      })
      .catch(err => {
        console.error('[SW] ❌ Error al registrar Service Worker:', err);
      });
  });

  // ============================================
  // 📨 ESCUCHAR MENSAJES DEL SERVICE WORKER
  // ============================================
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('[SW] 📨 Mensaje recibido del Service Worker:', event.data);
    
    if (event.data?.type === 'QUOTATION_SYNCED') {
      console.log('[SW] ✅ Cotización sincronizada:', event.data.item);
      // Opcional: Mostrar notificación o actualizar UI
    }
    
    if (event.data?.type === 'QUOTATIONS_SYNCED') {
      console.log('[SW] ✅ Todas las cotizaciones pendientes sincronizadas');
      // Opcional: Mostrar alert o toast
    }
  });

  // ============================================
  // 🌐 PROCESAR COLA OFFLINE AL RECONECTAR
  // ============================================
  window.addEventListener('online', () => {
    console.log('[App] 🌐 Conexión recuperada, procesando cola offline...');
    
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'PROCESS_QUEUE' });
    }
  });

  // ============================================
  // 🔄 PROCESAR COLA AL CARGAR (SI HAY CONEXIÓN)
  // ============================================
  window.addEventListener('load', () => {
    if (navigator.onLine && navigator.serviceWorker.controller) {
      console.log('[App] 🔄 Intentando procesar cola offline al cargar...');
      navigator.serviceWorker.controller.postMessage({ type: 'PROCESS_QUEUE' });
    }
  });
}

// ============================================
// 🚀 RENDERIZAR APLICACIÓN
// ============================================
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
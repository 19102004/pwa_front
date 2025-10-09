import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const db: IDBOpenDBRequest = window.indexedDB.open('database');

db.onupgradeneeded = (event: IDBVersionChangeEvent) => {
  const result: IDBDatabase = (event.target as IDBOpenDBRequest).result;
  result.createObjectStore('table', { autoIncrement: true });
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[SW] Registrado correctamente:', registration);

        navigator.serviceWorker.ready.then(swReg => {
          console.log('[SW] SW listo y controlando la página', swReg);
        });
      })
      .catch(err => console.error('[SW] Registro fallido', err));
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'QUOTATIONS_SYNCED') {
      alert('✅ Cotizaciones pendientes sincronizadas correctamente');
    }
  });

  window.addEventListener('load', () => {
    if (navigator.onLine && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'PROCESS_QUEUE' });
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

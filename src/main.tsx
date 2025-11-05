import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const db: IDBOpenDBRequest = window.indexedDB.open('database');
db.onupgradeneeded = (event: IDBVersionChangeEvent) => {
  const result: IDBDatabase = (event.target as IDBOpenDBRequest).result;
  result.createObjectStore('table', { autoIncrement: true });
};


function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[SW] Registrado correctamente:', registration);
      })
      .then(() => navigator.serviceWorker.ready) 
      .then(swReg => {
        console.log('[SW] SW listo y controlando la página', swReg);

        if (swReg.pushManager) {
          console.log('ℹ Soportando Push Manager');

        
          const vapidPublicKey = 'BIynn4usIt7IACIh19L8jdZHdU7NjmLUdznl-tseixJ2TD01-foLbJl8Yti-kItVdl9XkoVjbvymisahuu9U3Tc'; 
          
          if (!vapidPublicKey.startsWith('B')) {
            console.error('X Error: Debes reemplazar VAPID_PUBLIC_KEY por tu clave real.');
          }

          swReg.pushManager.getSubscription()
            .then(subscription => {
              if (subscription === null) {
                console.log('ℹ No suscrito a push, solicitando permiso...');
                Notification.requestPermission().then(permission => {
                  if (permission === 'granted') {
                    swReg.pushManager.subscribe({
                      userVisibleOnly: true, 
                      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
                    }).then(newSubscription => {
                      console.log('☑ Nueva suscripción Push:', newSubscription);
                      fetch('http://localhost:4000/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newSubscription)
                      })
                      .then(res => res.json())
                      .then(data => console.log('☑ Suscripción enviada al backend:', data))
                      .catch(err => console.error('X Error enviando suscripción al backend:', err));
                    }).catch(subErr => console.error('X Error al suscribirse a push:', subErr));
                  } else {
                    console.warn('ℹ Permiso de notificación denegado.');
                  }
                });
              } else {
                console.log('ℹ Ya está suscrito a push.');
             
              }
            }).catch(getSubErr => console.error('X Error obteniendo suscripción:', getSubErr));
        } else {
          console.warn('ℹ Push Manager no soportado en este Service Worker.');
        }

      })
      .catch(err => console.error('[SW] Registro fallido', err));
  });

  // Escucha mensajes del Service Worker (ej. para notificar sincronización completa)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'QUOTATIONS_SYNCED') {
      alert(' Cotizaciones pendientes sincronizadas correctamente');
    }
  });

  // Intenta procesar la cola offline tan pronto como la página cargue si hay conexión
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
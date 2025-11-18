// src/utils/notificationService.ts

interface ExtendedNotificationOptions extends NotificationOptions {
  vibrate?: number[];
}

const VAPID_PUBLIC_KEY_URL = 'https://pwa-back-h0cr.onrender.com/push/vapid-public-key';
const SUBSCRIBE_URL = 'https://pwa-back-h0cr.onrender.com/push/subscribe';
const ASSOCIATE_USER_URL = 'https://pwa-back-h0cr.onrender.com/usuario/subscribe-push';
const UNSUBSCRIBE_USER_URL = 'https://pwa-back-h0cr.onrender.com/usuario/unsubscribe-push'; 

/**
 * Convertir clave VAPID a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Mostrar notificación local (sin push)
 */
export const showLocalNotification = (title: string, body: string, icon?: string) => {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones');
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      const options: ExtendedNotificationOptions = {
        body,
        icon: icon || '/cb190r.png',
        badge: '/cb190r.png',
        tag: 'quotation-notification',
        requireInteraction: false
      };

      if ('vibrate' in navigator) {
        options.vibrate = [200, 100, 200];
      }

      const notification = new Notification(title, options as NotificationOptions);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Error mostrando notificación local:', error);
    }
  }
};

/**
 * Solicitar permisos de notificación
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

/**
 * Suscribir usuario a notificaciones push con asociación a usuario
 */
export async function subscribeToPushNotifications(username: string): Promise<{
  success: boolean;
  subscriptionId?: string;
  error?: string;
}> {
  try {
    console.log('');
    console.log('🔔 ========================================');
    console.log('🔔 INICIANDO SUSCRIPCIÓN PUSH');
    console.log('🔔 Usuario:', username);
    console.log('🔔 Fecha:', new Date().toLocaleString('es-MX'));
    console.log('🔔 ========================================');
    
    // 1. Verificar soporte
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('❌ Push notifications no soportadas');
      return { success: false, error: 'Push notifications no soportadas' };
    }
    console.log('✅ Paso 1/8: Navegador soporta push notifications');

    // 2. Solicitar permiso
    const permission = await requestNotificationPermission();
    if (!permission) {
      console.log('❌ Paso 2/8: Permiso de notificaciones denegado');
      return { success: false, error: 'Permiso denegado' };
    }
    console.log('✅ Paso 2/8: Permisos concedidos');

    // 3. Registrar Service Worker
const registration = await navigator.serviceWorker.register('/service-worker.js');
    await navigator.serviceWorker.ready;
    console.log('✅ Paso 3/8: Service Worker registrado');

    // 4. Obtener clave pública VAPID
    console.log('📡 Paso 4/8: Obteniendo clave VAPID desde:', VAPID_PUBLIC_KEY_URL);
    const vapidResponse = await fetch(VAPID_PUBLIC_KEY_URL);
    const vapidData = await vapidResponse.json();
    
    if (!vapidData.success || !vapidData.publicKey) {
      throw new Error('No se pudo obtener la clave VAPID');
    }
    console.log('✅ Paso 4/8: Clave VAPID obtenida:', vapidData.publicKey.substring(0, 30) + '...');

    // 5. Convertir clave VAPID y suscribirse a push
    console.log('📝 Paso 5/8: Creando suscripción push...');
    const vapidKey = urlBase64ToUint8Array(vapidData.publicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey as BufferSource
    });
    console.log('✅ Paso 5/8: Suscripción push creada');
    console.log('   Endpoint:', subscription.endpoint.substring(0, 60) + '...');

    // 6. Enviar suscripción al backend
    console.log('📤 Paso 6/8: Enviando suscripción a:', SUBSCRIBE_URL);
    const subscribeResponse = await fetch(SUBSCRIBE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });

    if (!subscribeResponse.ok) {
      const errorText = await subscribeResponse.text();
      console.error('❌ Error en paso 6/8:', errorText);
      throw new Error(`Error ${subscribeResponse.status}: ${errorText}`);
    }

    const subscribeData = await subscribeResponse.json();
    
    if (!subscribeData.success) {
      throw new Error('Error al registrar suscripción en el servidor');
    }
    console.log('✅ Paso 6/8: Suscripción registrada en servidor');
    console.log('   SubscriptionId:', subscribeData.subscriptionId);

    // 7. Asociar suscripción con el usuario
    console.log('🔗 ========================================');
    console.log('🔗 Paso 7/8: ASOCIANDO CON USUARIO');
    console.log('🔗 Username:', username);
    console.log('🔗 URL:', ASSOCIATE_USER_URL);
    console.log('🔗 SubscriptionId:', subscribeData.subscriptionId);
    
    const associateBody = {
      username: username,
      subscription: subscription.toJSON(),
      subscriptionId: subscribeData.subscriptionId
    };

    console.log('📡 Haciendo fetch a:', ASSOCIATE_USER_URL);
    const associateResponse = await fetch(ASSOCIATE_USER_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(associateBody)
    });

    console.log('📡 Response status:', associateResponse.status);

    if (!associateResponse.ok) {
      const errorText = await associateResponse.text();
      console.error('❌ Error en paso 7/8:', errorText);
      throw new Error(`Error ${associateResponse.status}: ${errorText}`);
    }

    const associateData = await associateResponse.json();
    
    console.log('📥 Respuesta de asociación:', associateData);
    
    if (!associateData.success) {
      console.error('❌ Asociación falló:', associateData.message);
      throw new Error(associateData.message || 'Error al asociar suscripción con usuario');
    }

    console.log('✅ Paso 7/8: Suscripción asociada al usuario');
    console.log('🔗 ========================================');

    // 8. Guardar en localStorage
    console.log('💾 Paso 8/8: Guardando en localStorage');
    localStorage.setItem('pushSubscriptionId', subscribeData.subscriptionId);
    localStorage.setItem('pushSubscribedUser', username);

    console.log('✅ ========================================');
    console.log('✅ SUSCRIPCIÓN COMPLETADA EXITOSAMENTE');
    console.log('✅ Usuario:', username);
    console.log('✅ SubscriptionId:', subscribeData.subscriptionId);
    console.log('✅ ========================================');
    console.log('');

    return { 
      success: true, 
      subscriptionId: subscribeData.subscriptionId 
    };

  } catch (error: any) {
    console.error('❌ ========================================');
    console.error('❌ ERROR EN SUSCRIPCIÓN PUSH');
    console.error('❌ Error:', error);
    console.error('❌ Mensaje:', error.message);
    console.error('❌ ========================================');
    console.log('');
    
    return { 
      success: false, 
      error: error.message || 'Error desconocido' 
    };
  }
}

/**
 * ⭐ NUEVA FUNCIÓN: Desuscribirse de notificaciones push
 */
export async function unsubscribeFromPushNotifications(username: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    console.log('');
    console.log('🔕 ========================================');
    console.log('🔕 DESACTIVANDO NOTIFICACIONES PUSH');
    console.log('🔕 Usuario:', username);
    console.log('🔕 ========================================');

    // 1. Desuscribir del navegador
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        console.log('✅ Desuscrito del navegador');
      } else {
        console.log('⚠️ No había suscripción activa en el navegador');
      }
    }

    // 2. Eliminar del backend
    console.log('📡 Eliminando suscripción del backend...');
    const response = await fetch(`${UNSUBSCRIBE_USER_URL}/${username}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error al eliminar del backend:', errorText);
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Error al eliminar suscripción');
    }

    console.log('✅ Suscripción eliminada del backend');

    // 3. Limpiar localStorage
    localStorage.removeItem('pushSubscriptionId');
    localStorage.removeItem('pushSubscribedUser');
    console.log('✅ LocalStorage limpiado');

    console.log('✅ ========================================');
    console.log('✅ DESUSCRIPCIÓN COMPLETADA');
    console.log('✅ Usuario:', username);
    console.log('✅ ========================================');
    console.log('');

    return {
      success: true,
      message: 'Notificaciones push desactivadas correctamente'
    };

  } catch (error: any) {
    console.error('❌ ========================================');
    console.error('❌ ERROR EN DESUSCRIPCIÓN');
    console.error('❌ Error:', error);
    console.error('❌ ========================================');
    console.log('');

    return {
      success: false,
      error: error.message || 'Error desconocido'
    };
  }
}

/**
 * Verificar si el usuario está suscrito
 */
export async function isPushSubscribed(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    return subscription !== null;
  } catch (error) {
    console.error('Error verificando suscripción:', error);
    return false;
  }
}

/**
 * Sistema de polling para verificar nuevas cotizaciones
 */
let pollingInterval: NodeJS.Timeout | null = null;
let lastQuotationCount = 0;

export const startQuotationPolling = async (intervalMs: number = 30000) => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  try {
    const response = await fetch('https://pwa-back-h0cr.onrender.com/cotizacion');
    const data = await response.json();
    if (data.success) {
      lastQuotationCount = data.cotizaciones.length;
      console.log('📊 Conteo inicial de cotizaciones:', lastQuotationCount);
    }
  } catch (error) {
    console.error('Error obteniendo conteo inicial:', error);
  }

  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch('https://pwa-back-h0cr.onrender.com/cotizacion');
      const data = await response.json();
      
      if (data.success) {
        const currentCount = data.cotizaciones.length;
        
        if (currentCount > lastQuotationCount) {
          const newQuotations = currentCount - lastQuotationCount;
          const latestQuotation = data.cotizaciones[0]; 
          
          showLocalNotification(
            '🏍️ Nueva Cotización Recibida',
            `${latestQuotation.nombre} ha solicitado cotización para ${latestQuotation.moto}`,
            '/cb190r.png'
          );
          
          lastQuotationCount = currentCount;
          console.log(`✅ ${newQuotations} nueva(s) cotización(es) detectada(s)`);
        }
      }
    } catch (error) {
      console.error('Error en polling de cotizaciones:', error);
    }
  }, intervalMs);

  console.log(`🔄 Polling de cotizaciones iniciado (cada ${intervalMs / 1000}s)`);
};

export const stopQuotationPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('⏹️ Polling de cotizaciones detenido');
  }
};
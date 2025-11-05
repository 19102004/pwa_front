interface ExtendedNotificationOptions extends NotificationOptions {
  vibrate?: number[];
}


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

      // Agregar vibrate si el navegador lo soporta
      if ('vibrate' in navigator) {
        options.vibrate = [200, 100, 200];
      }

      const notification = new Notification(title, options as NotificationOptions);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto cerrar después de 5 segundos
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Error mostrando notificación local:', error);
    }
  }
};

/**
 * Solicitar permisos de notificación (solo local, sin push)
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
 * Sistema de polling para verificar nuevas cotizaciones
 */
let pollingInterval: NodeJS.Timeout | null = null;
let lastQuotationCount = 0;

export const startQuotationPolling = async (intervalMs: number = 30000) => {
  // Detener polling anterior si existe
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  // Obtener conteo inicial
  try {
    const response = await fetch('http://localhost:4000/cotizacion');
    const data = await response.json();
    if (data.success) {
      lastQuotationCount = data.cotizaciones.length;
      console.log('📊 Conteo inicial de cotizaciones:', lastQuotationCount);
    }
  } catch (error) {
    console.error('Error obteniendo conteo inicial:', error);
  }

  // Iniciar polling
  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch('http://localhost:4000/cotizacion');
      const data = await response.json();
      
      if (data.success) {
        const currentCount = data.cotizaciones.length;
        
        if (currentCount > lastQuotationCount) {
          // Hay nuevas cotizaciones
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


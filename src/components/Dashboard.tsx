import React, { useState, useEffect } from "react";
import "./Dashboard.css";
import { 
  requestNotificationPermission, 
  showLocalNotification, 
  startQuotationPolling,
  stopQuotationPolling 
} from "../utils/notificationService";

const motos = [
  { nombre: "Honda CBR", descripcion: "Una moto deportiva con excelente rendimiento.", imagen: "/cbr.png" },
  { nombre: "Honda CB190R", descripcion: "Perfecta para ciudad, ágil y moderna.", imagen: "/cb190r.png" },
  { nombre: "Honda Invicta", descripcion: "Moto confiable para uso diario.", imagen: "/invicta.png" },
  { nombre: "Honda Fireblade", descripcion: "Máxima potencia para los amantes de la velocidad.", imagen: "/fireblade.png" },
  { nombre: "Honda Twister", descripcion: "Versátil y cómoda, ideal para trayectos largos.", imagen: "/twister.png" },
];

const Dashboard: React.FC = () => {
  const [formData, setFormData] = useState({ nombre: "", telefono: "", moto: "" });
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [useLocalNotifications, setUseLocalNotifications] = useState(false);

  // 🔔 Función para convertir la clave pública VAPID a Uint8Array
  const urlBase64ToUint8Array = (base64String: string) => {
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
  };

  // 🔔 Activar notificaciones locales (alternativa que siempre funciona)
  const activateLocalNotifications = async () => {
    try {
      const granted = await requestNotificationPermission();
      
      if (granted) {
        setNotificationsEnabled(true);
        setUseLocalNotifications(true);
        
        startQuotationPolling(30000); 
        
        showLocalNotification(
          '🔔 Notificaciones Activadas',
          'Recibirás alertas cuando haya nuevas cotizaciones (app abierta)',
          '/cb190r.png'
        );
        
        console.log('✅ Notificaciones locales activadas con polling');
      } else {
        alert('⚠️ Para recibir notificaciones, debes otorgar permisos en tu navegador.');
      }
    } catch (error) {
      console.error('Error activando notificaciones locales:', error);
      alert('⚠️ Error al activar notificaciones.');
    }
  };

  const subscribeToPushNotifications = async () => {
    try {
      if (!('Notification' in window)) {
        console.warn('Este navegador no soporta notificaciones');
        alert('⚠️ Tu navegador no soporta notificaciones');
        return;
      }

      if (!('PushManager' in window)) {
        console.warn('Este navegador no soporta Push API');
        alert('⚠️ Tu navegador no soporta notificaciones push');
        return;
      }

      if (!('serviceWorker' in navigator)) {
        console.warn('Este navegador no soporta Service Workers');
        alert('⚠️ Tu navegador no soporta Service Workers');
        return;
      }

      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        console.log('Permiso de notificaciones denegado');
        return;
      }

      console.log('✅ Permiso de notificaciones concedido');

      // Obtener el service worker registration
      const registration = await navigator.serviceWorker.ready;
      console.log('📱 Service Worker listo:', registration);

      // Obtener la clave pública VAPID del servidor
      console.log('🔑 Obteniendo clave pública VAPID del servidor...');
      const response = await fetch('http://localhost:4000/push/vapid-public-key');
      const data = await response.json();
      
      console.log('📥 Respuesta del servidor:', data);
      
      if (!data.success || !data.publicKey) {
        throw new Error('No se pudo obtener la clave pública VAPID: ' + (data.message || 'Sin mensaje'));
      }

      const vapidPublicKey = data.publicKey;
      console.log('🔑 Clave pública VAPID obtenida:', vapidPublicKey.substring(0, 20) + '...');
      
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      console.log('🔄 Clave convertida a Uint8Array, longitud:', convertedVapidKey.length);

      console.log('📬 Intentando suscribirse a notificaciones push...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      console.log('✅ Suscripción creada exitosamente:', subscription);

      const subscribeResponse = await fetch('http://localhost:4000/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      const subscribeData = await subscribeResponse.json();

      if (subscribeData.success) {
        console.log('✅ Suscrito a notificaciones push');
        setNotificationsEnabled(true);
        alert('🔔 ¡Notificaciones activadas! Recibirás alertas de nuevas cotizaciones.');
      }
    } catch (error: any) {
      console.error('❌ Error al suscribirse a notificaciones push:', error);
      
      if (error.name === 'AbortError' || error.message.includes('push service error')) {
        console.warn('⚠️ Push notifications no disponibles, usando sistema alternativo');
        
        const useAlternative = confirm(
          '⚠️ Las notificaciones push no están disponibles (puede ser por problemas de red o firewall).\n\n' +
          '¿Deseas activar notificaciones locales en su lugar?\n' +
          '(Funcionan solo cuando la app está abierta)'
        );
        
        if (useAlternative) {
          activateLocalNotifications();
        }
      } else if (error.name === 'NotAllowedError') {
        alert('⚠️ Permisos denegados. Por favor, permite las notificaciones en la configuración del navegador.');
      } else {
        alert('⚠️ Error: ' + error.message + '\n\nIntenta recargar la página.');
      }
    }
  };

  // 📡 Configuración de comunicación con el Service Worker
  useEffect(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "QUOTATION_SYNCED") {
          console.log("✅ Cotización sincronizada:", event.data.item);
          alert(`✅ Cotización sincronizada: ${event.data.item.nombre}`);
        }
      });
    }

    // Cuando el usuario vuelva a estar online, reintenta enviar la cola
    window.addEventListener("online", () => {
      console.log("[Dashboard] 🌐 Reconectado, intentando reenviar cola...");
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "PROCESS_QUEUE" });
      }
    });

    // Limpiar polling al desmontar el componente
    return () => {
      stopQuotationPolling();
    };
  }, []);

  // 🧩 Manejar cambios en los campos del formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 📬 Envío del formulario (online u offline)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre || !formData.telefono || !formData.moto) {
      alert("⚠️ Por favor completa todos los campos antes de enviar.");
      return;
    }

    setLoading(true);
    const online = navigator.onLine;
    console.log(`[Dashboard] Estado conexión: ${online ? "Online" : "Offline"}`);

    if (!online) {
      //  Guardar directamente offline
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "ADD_TO_CART",
          item: formData,
        });
        alert("📡 Cotización guardada offline. Se enviará automáticamente cuando haya conexión.");
      } else {
        alert("⚠️ No se pudo guardar offline. Service Worker no disponible.");
      }

      setFormData({ nombre: "", telefono: "", moto: "" });
      setLoading(false);
      return;
    }

    //  Si hay conexión, intentar enviar al servidor
    try {
      const response = await fetch("http://localhost:4000/cotizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Error al enviar la cotización");

      const data = await response.json();
      alert(`✅ Cotización enviada correctamente. ID: ${data.cotizacion._id}`);
    } catch (err) {
      console.warn("[Dashboard] Error de red, guardando en cola offline:", err);
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "ADD_TO_CART",
          item: formData,
        });
        alert("📡 Cotización guardada offline. Se enviará automáticamente cuando haya conexión.");
      } else {
        alert("⚠️ No se pudo enviar ni guardar offline. Service Worker no disponible.");
      }
    } finally {
      setFormData({ nombre: "", telefono: "", moto: "" });
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* 🏍️ Header */}
      <header className="dashboard-header">
        <h1>🏍️ Tienda de Motos</h1>
        <p>Bienvenido al panel de administración</p>
        <div style={{ marginTop: '10px' }}>
          {notificationsEnabled ? (
            <span style={{ color: '#4caf50', fontWeight: 'bold' }}>
              ✅ Notificaciones activadas
              {useLocalNotifications && (
                <span style={{ fontSize: '0.85em', marginLeft: '8px' }}>
                  (modo local - app abierta)
                </span>
              )}
            </span>
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={subscribeToPushNotifications}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🔔 Activar Notificaciones Push
              </button>
              <button 
                onClick={activateLocalNotifications}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
                title="Notificaciones locales (funcionan solo cuando la app está abierta)"
              >
                🔕 Modo Local
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 📊 Estadísticas */}
      <section className="dashboard-stats">
        <div className="card"><h2>15</h2><p>Motos en inventario</p></div>
        <div className="card"><h2>8</h2><p>Ventas este mes</p></div>
        <div className="card"><h2>3</h2><p>Pedidos pendientes</p></div>
      </section>

      {/* ⚙️ Acciones */}
      <section className="dashboard-actions">
        <button>➕ Agregar Moto</button>
        <button>📦 Ver Pedidos</button>
        <button>👤 Gestionar Usuarios</button>
      </section>

      {/* 📋 Catálogo */}
      <section className="dashboard-catalogo">
        <h2>📋 Catálogo de Motos</h2>
        <div className="catalogo-grid">
          {motos.map((moto, index) => (
            <div key={index} className="moto-card">
              <img src={moto.imagen} alt={moto.nombre} />
              <h3>{moto.nombre}</h3>
              <p>{moto.descripcion}</p>
              <button className="btn-vermas">Ver más</button>
            </div>
          ))}
        </div>
      </section>

      {/* 📞 Formulario de cotización */}
      <section className="dashboard-contacto">
        <h2>📞 Contactar / Pedir Cotización</h2>
        <form className="contact-form" onSubmit={handleSubmit}>
          <input
            type="text"
            name="nombre"
            placeholder="Nombre completo"
            value={formData.nombre}
            onChange={handleChange}
          />
          <input
            type="tel"
            name="telefono"
            placeholder="Número de teléfono"
            value={formData.telefono}
            onChange={handleChange}
          />
          <select name="moto" value={formData.moto} onChange={handleChange}>
            <option value="">Selecciona una moto</option>
            {motos.map((moto, index) => (
              <option key={index} value={moto.nombre}>{moto.nombre}</option>
            ))}
          </select>
          <button type="submit" className="btn-enviar" disabled={loading}>
            {loading ? "⏳ Enviando..." : "📩 Enviar Solicitud"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default Dashboard;

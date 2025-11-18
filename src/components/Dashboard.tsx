import { useState, useEffect } from "react";
import "./Dashboard.css";
import { 
  requestNotificationPermission, 
  showLocalNotification, 
  startQuotationPolling,
  stopQuotationPolling,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications
} from "../utils/notificationService";

const motos = [
  { nombre: "Honda CBR", descripcion: "Una moto deportiva con excelente rendimiento.", imagen: "/cbr.png" },
  { nombre: "Honda CB190R", descripcion: "Perfecta para ciudad, ágil y moderna.", imagen: "/cb190r.png" },
  { nombre: "Honda Invicta", descripcion: "Moto confiable para uso diario.", imagen: "/invicta.png" },
  { nombre: "Honda Fireblade", descripcion: "Máxima potencia para los amantes de la velocidad.", imagen: "/fireblade.png" },
  { nombre: "Honda Twister", descripcion: "Versátil y cómoda, ideal para trayectos largos.", imagen: "/twister.png" },
];

const Dashboard = () => {
  const [formData, setFormData] = useState({ nombre: "", telefono: "", moto: "" });
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [useLocalNotifications, setUseLocalNotifications] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [pendingQuotations, setPendingQuotations] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMoto, setSelectedMoto] = useState<typeof motos[0] | null>(null); // ⭐ Estado para modal

  // Recuperar username y verificar suscripción al cargar
  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    const savedId = localStorage.getItem('pushSubscriptionId');
    
    if (savedUsername) {
      setUsername(savedUsername);
      console.log('✅ Usuario recuperado:', savedUsername);
    }
    
    if (savedId) {
      setSubscriptionId(savedId);
      setNotificationsEnabled(true);
      console.log('✅ Usuario ya tiene suscripción push:', savedId);
    }

    // Verificar cola pendiente
    checkPendingQueue();
  }, []);

  // ⭐ Verificar cotizaciones pendientes
  const checkPendingQueue = () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CHECK_QUEUE' });
    }
  };

  // Activar modo local
  const activateLocalNotifications = async () => {
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationsEnabled(true);
        setUseLocalNotifications(true);

        startQuotationPolling(30000);

        showLocalNotification(
          "🔔 Notificaciones Activadas",
          "Recibirás alertas mientras la app esté abierta.",
          "/cb190r.png"
        );

        console.log('✅ Notificaciones locales activadas');
      }
    } catch (error) {
      console.error('Error al activar notificaciones locales:', error);
      alert("Error al activar notificaciones locales.");
    }
  };

  // Activar notificaciones push
  const activatePushNotifications = async () => {
    try {
      if (!username) {
        alert('⚠️ No se pudo obtener el nombre de usuario. Inicia sesión nuevamente.');
        return;
      }

      if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) {
        alert("⚠️ Tu navegador no soporta notificaciones push.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert('⚠️ Permisos de notificación denegados');
        return;
      }

      console.log(`🔔 Activando notificaciones push para: ${username}`);

      const result = await subscribeToPushNotifications(username);

      if (result.success && result.subscriptionId) {
        setSubscriptionId(result.subscriptionId);
        setNotificationsEnabled(true);
        setUseLocalNotifications(false);

        console.log('✅ Notificaciones push activadas:', result.subscriptionId);
        alert(`🔔 Notificaciones push activadas correctamente\n¡Ya puedes recibir notificaciones del administrador!`);
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (error: any) {
      console.error("❌ Error activando push:", error);

      const fallback = confirm(
        "Las notificaciones push fallaron.\n¿Quieres activar modo local?"
      );
      if (fallback) {
        activateLocalNotifications();
      }
    }
  };

  // Desactivar notificaciones push
  const deactivatePushNotifications = async () => {
    if (!username) {
      alert('⚠️ No se pudo obtener el nombre de usuario.');
      return;
    }

    const confirmacion = confirm(
      '¿Estás seguro de que quieres desactivar las notificaciones push?\n\nDejarás de recibir notificaciones del administrador.'
    );

    if (!confirmacion) return;

    try {
      console.log('🔕 Desactivando notificaciones push...');

      const result = await unsubscribeFromPushNotifications(username);

      if (result.success) {
        setNotificationsEnabled(false);
        setUseLocalNotifications(false);
        setSubscriptionId(null);
        
        stopQuotationPolling();

        console.log('✅ Notificaciones push desactivadas');
        alert('🔕 Notificaciones push desactivadas correctamente');
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (error: any) {
      console.error('❌ Error al desactivar notificaciones:', error);
      alert(`⚠️ Error al desactivar notificaciones: ${error.message}`);
    }
  };

  // ⭐ Comunicación mejorada con el Service Worker
  useEffect(() => {
    if (!navigator.serviceWorker) return;

    const messageHandler = (event: MessageEvent) => {
      console.log('[Dashboard] Mensaje del SW:', event.data);

      switch (event.data?.type) {
        case 'SYNC_COMPLETE':
          // ⭐ UNA SOLA alerta con el resumen
          if (event.data.successCount > 0) {
            alert(`✅ Conexión restablecida\n📤 ${event.data.successCount} cotización(es) enviada(s) exitosamente`);
          }
          if (event.data.failCount > 0) {
            console.warn(`⚠️ ${event.data.failCount} cotización(es) no se pudieron enviar`);
          }
          checkPendingQueue();
          break;

        case 'QUEUE_STATUS':
          setPendingQuotations(event.data.count);
          console.log(`📋 Cotizaciones pendientes: ${event.data.count}`);
          break;

        case 'CART_SAVED':
          if (!event.data.success) {
            console.error('❌ Error guardando offline:', event.data.error);
          }
          break;
      }
    };

    navigator.serviceWorker.addEventListener("message", messageHandler);

    // ⭐ Evento online simplificado
    const onlineHandler = () => {
      console.log('🌐 Conexión restaurada');
      // El SW ya maneja esto, solo actualizamos UI
      setTimeout(() => checkPendingQueue(), 3000);
    };

    window.addEventListener("online", onlineHandler);

    return () => {
      navigator.serviceWorker.removeEventListener("message", messageHandler);
      window.removeEventListener("online", onlineHandler);
      stopQuotationPolling();
    };
  }, []);

  // ⭐ Función para abrir modal
  const handleVerMas = (moto: typeof motos[0]) => {
    console.log('📸 Abriendo modal para:', moto.nombre);
    console.log('🌐 Estado de conexión:', navigator.onLine ? 'ONLINE' : 'OFFLINE');
    setSelectedMoto(moto);
  };

  // ⭐ Función para cerrar modal
  const handleCerrarModal = () => {
    setSelectedMoto(null);
  };

  // ⭐ Cerrar modal con tecla ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedMoto) {
        handleCerrarModal();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedMoto]);

  // Formulario
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ⭐ Prevenir doble submit
    if (isSubmitting) {
      console.warn('⚠️ Ya hay un envío en proceso, ignorando...');
      return;
    }

    if (!formData.nombre || !formData.telefono || !formData.moto) {
      alert("⚠️ Completa todos los campos.");
      return;
    }

    console.group('🚀 ENVÍO DE COTIZACIÓN');
    console.log('📦 Datos:', formData);
    console.log('🌐 Online:', navigator.onLine);
    console.log('🔧 SW activo:', navigator.serviceWorker.controller ? 'SÍ' : 'NO');
    console.groupEnd();

    setLoading(true);
    setIsSubmitting(true); // ⭐ Bloquear múltiples envíos

    // ⭐ MODO OFFLINE: Guardar en IndexedDB SOLAMENTE
    if (!navigator.onLine) {
      console.log('📴 Sin conexión detectada, guardando offline...');
      
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "ADD_TO_CART",
          item: formData,
        });
        alert("📴 Sin conexión.\n✅ Cotización guardada.\nSe enviará automáticamente al reconectar.");
        checkPendingQueue();
      } else {
        alert("⚠️ Service Worker no está activo. Recarga la página.");
      }
      
      setFormData({ nombre: "", telefono: "", moto: "" });
      setLoading(false);
      setIsSubmitting(false);
      return;
    }

    // ⭐ MODO ONLINE: Enviar directamente (NO guardar offline)
    const endpoint = "https://pwa-back-h0cr.onrender.com/cotizacion";
    
    try {
      console.group('🌐 FETCH A API');
      console.log('📡 URL:', endpoint);
      console.log('📋 Method: POST');
      console.log('📦 Body:', JSON.stringify(formData, null, 2));
      console.log('⏱️ Iniciando request...', new Date().toLocaleTimeString());
      console.groupEnd();
      
      const startTime = Date.now();
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(formData),
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.group('📥 RESPUESTA DEL SERVIDOR');
      console.log('⏱️ Duración:', duration, 'ms');
      console.log('🔢 Status:', res.status, res.statusText);
      console.log('📋 Headers:', Object.fromEntries(res.headers.entries()));
      
      const responseText = await res.text();
      console.log('📄 Body (raw):', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('📄 Body (parsed):', data);
      } catch (parseError) {
        console.error('❌ Error parseando JSON:', parseError);
        console.groupEnd();
        throw new Error(`Respuesta no es JSON válido: ${responseText.substring(0, 100)}`);
      }
      
      console.groupEnd();

      if (!res.ok) {
        throw new Error(data.message || `Error HTTP ${res.status}`);
      }

      console.log('✅ COTIZACIÓN ENVIADA EXITOSAMENTE');
      alert(`✅ Cotización enviada\n👤 ${data.cotizacion.nombre}\n🏍️ ${data.cotizacion.moto}`);

      // ⭐ NO procesar cola aquí, solo si el usuario estaba offline antes
      // El evento 'online' ya maneja eso automáticamente

    } catch (error: any) {
      console.group('❌ ERROR EN ENVÍO');
      console.error('Tipo:', error.name);
      console.error('Mensaje:', error.message);
      console.error('Stack:', error.stack);
      console.groupEnd();
      
      // ⭐ Si falla, guardar offline como respaldo
      const shouldSaveOffline = confirm(
        `⚠️ Error al enviar:\n${error.message}\n\n¿Guardar offline para enviar después?`
      );
      
      if (shouldSaveOffline && navigator.serviceWorker.controller) {
        console.log('💾 Guardando como respaldo offline...');
        navigator.serviceWorker.controller.postMessage({
          type: "ADD_TO_CART",
          item: formData,
        });
        alert(`💾 Cotización guardada\nSe enviará al reconectar`);
        checkPendingQueue();
      } else if (!shouldSaveOffline) {
        // No mostrar alerta, ya se mostró el error en el confirm
      }
    } finally {
      setFormData({ nombre: "", telefono: "", moto: "" });
      setLoading(false);
      // ⭐ Pequeño delay antes de permitir otro envío
      setTimeout(() => setIsSubmitting(false), 1000);
    }
  };

  return (
    <div className="dashboard-container">
      {/* HEADER */}
      <header className="dashboard-header">
        <h1>🏍️ Tienda de Motos</h1>
        <p>Bienvenido, {username || 'Usuario'}</p>

        {/* ⭐ Indicador de cotizaciones pendientes */}
        {pendingQuotations > 0 && (
          <div style={{
            padding: "8px 16px",
            background: "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)",
            color: "white",
            borderRadius: "8px",
            fontWeight: "bold",
            fontSize: "0.9rem",
            marginTop: "10px",
            display: "inline-block"
          }}>
            📦 {pendingQuotations} cotización{pendingQuotations > 1 ? 'es' : ''} pendiente{pendingQuotations > 1 ? 's' : ''}
          </div>
        )}

        <div style={{ marginTop: "10px" }}>
          {notificationsEnabled ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#4caf50", fontWeight: "bold", fontSize: "1rem" }}>
                  ✅ Notificaciones activadas
                  {useLocalNotifications ? (
                    <span style={{ fontSize: "0.85em", marginLeft: "8px", color: "#666" }}>
                      (modo local)
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.85em", marginLeft: "8px", color: "#666" }}>
                      (push)
                    </span>
                  )}
                </span>
              </div>

              {subscriptionId && !useLocalNotifications && (
                <span style={{ fontSize: "0.75em", color: "#666", fontFamily: "monospace" }}>
                  🆔 ID: {subscriptionId.substring(0, 25)}...
                </span>
              )}

              {!useLocalNotifications && (
                <button
                  onClick={deactivatePushNotifications}
                  style={{
                    padding: "10px 18px",
                    background: "linear-gradient(135deg, #f44336 0%, #e91e63 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                    boxShadow: "0 4px 6px rgba(244, 67, 54, 0.3)",
                    transition: "all 0.3s ease"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 12px rgba(244, 67, 54, 0.4)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 6px rgba(244, 67, 54, 0.3)";
                  }}
                >
                  🔕 Desactivar Notificaciones Push
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={activatePushNotifications}
                style={{
                  padding: "10px 18px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "0.95rem",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  transition: "all 0.3s ease"
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}
              >
                🔔 Activar Notificaciones Push
              </button>

              <button
                onClick={activateLocalNotifications}
                style={{
                  padding: "10px 18px",
                  background: "linear-gradient(135deg, #4caf50, #45a049)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "0.95rem",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  transition: "all 0.3s ease"
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}
              >
                🔕 Modo Local
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ESTADÍSTICAS */}
      <section className="dashboard-stats">
        <div className="card"><h2>15</h2><p>Motos en inventario</p></div>
        <div className="card"><h2>8</h2><p>Ventas este mes</p></div>
        <div className="card"><h2>{pendingQuotations}</h2><p>Cotizaciones pendientes</p></div>
      </section>

      {/* ACCIONES */}
      <section className="dashboard-actions">
        <button>➕ Agregar Moto</button>
        <button>📦 Ver Pedidos</button>
        <button>👤 Gestionar Usuarios</button>
      </section>

      {/* CATÁLOGO */}
      <section className="dashboard-catalogo">
        <h2>📋 Catálogo de Motos</h2>
        <div className="catalogo-grid">
          {motos.map((moto, index) => (
            <div key={index} className="moto-card">
              <img src={moto.imagen} alt={moto.nombre} />
              <h3>{moto.nombre}</h3>
              <p>{moto.descripcion}</p>
              <button 
                className="btn-vermas"
                onClick={() => handleVerMas(moto)}
              >
                Ver más
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FORMULARIO DE CONTACTO */}
      <section className="dashboard-contacto">
        <h2>📞 Contactar / Pedir Cotización</h2>
        <form className="contact-form" onSubmit={handleSubmit}>
          <input
            type="text"
            name="nombre"
            placeholder="Nombre completo"
            value={formData.nombre}
            onChange={handleChange}
            required
          />
          <input
            type="tel"
            name="telefono"
            placeholder="Número de teléfono"
            value={formData.telefono}
            onChange={handleChange}
            required
          />
          <select 
            name="moto" 
            value={formData.moto} 
            onChange={handleChange}
            required
          >
            <option value="">Selecciona una moto</option>
            {motos.map((moto, index) => (
              <option key={index} value={moto.nombre}>{moto.nombre}</option>
            ))}
          </select>
          <button type="submit" className="btn-enviar" disabled={loading || isSubmitting}>
            {loading ? "⏳ Enviando..." : "📩 Enviar Solicitud"}
          </button>
        </form>
        
        {!navigator.onLine && (
          <p style={{ color: "#ff9800", fontWeight: "bold", marginTop: "10px" }}>
            📴 Sin conexión - Las cotizaciones se guardarán offline
          </p>
        )}
      </section>

      {/* ⭐ MODAL DE MOTO */}
      {selectedMoto && (
        <div 
          className="modal-overlay"
          onClick={handleCerrarModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'fadeIn 0.3s ease-in-out'
          }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '30px',
              maxWidth: '90%',
              maxHeight: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              animation: 'scaleIn 0.3s ease-in-out',
              overflow: 'auto'
            }}
          >
            {/* Botón cerrar */}
            <button
              onClick={handleCerrarModal}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.3s ease',
                fontWeight: 'bold',
                zIndex: 1
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'rotate(90deg) scale(1.1)';
                e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
              }}
            >
              ×
            </button>

            {/* Contenido del modal */}
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ 
                marginBottom: '20px', 
                color: '#333',
                fontSize: '2rem',
                fontWeight: 'bold'
              }}>
                {selectedMoto.nombre}
              </h2>

              {/* Indicador de cache */}
              <div style={{
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: navigator.onLine ? '#4caf50' : '#ff9800',
                color: 'white',
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                marginBottom: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                {navigator.onLine ? '🌐 Cargando desde internet' : '📴 Cargando desde cache'}
              </div>

              {/* Imagen grande */}
              <div style={{
                backgroundColor: '#f5f5f5',
                borderRadius: '15px',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <img 
                  src={selectedMoto.imagen} 
                  alt={selectedMoto.nombre}
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    maxHeight: '500px',
                    objectFit: 'contain',
                    borderRadius: '10px'
                  }}
                  onLoad={() => console.log('✅ Imagen cargada:', selectedMoto.nombre)}
                  onError={(e) => {
                    console.error('❌ Error cargando imagen');
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Descripción */}
              <p style={{
                fontSize: '1.1rem',
                color: '#666',
                lineHeight: '1.6',
                marginBottom: '20px'
              }}>
                {selectedMoto.descripcion}
              </p>

              {/* Información adicional */}
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '10px',
                marginTop: '20px'
              }}>
                <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
                  💡 <strong>Tip:</strong> Esta imagen funciona incluso sin conexión gracias al Service Worker cache
                </p>
              </div>

              {/* Botón de cotizar */}
              <button
                onClick={() => {
                  setFormData({ ...formData, moto: selectedMoto.nombre });
                  handleCerrarModal();
                  // Scroll al formulario
                  document.querySelector('.dashboard-contacto')?.scrollIntoView({ 
                    behavior: 'smooth' 
                  });
                }}
                style={{
                  marginTop: '20px',
                  padding: '12px 30px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '25px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                }}
              >
                📋 Cotizar esta moto
              </button>
            </div>
          </div>

          {/* Animaciones CSS */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            
            @keyframes scaleIn {
              from { 
                opacity: 0;
                transform: scale(0.9);
              }
              to { 
                opacity: 1;
                transform: scale(1);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
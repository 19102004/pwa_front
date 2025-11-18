import { useState, useEffect } from "react";
import "./Dashboard.css";
import { 
  requestNotificationPermission, 
  showLocalNotification, 
  startQuotationPolling,
  stopQuotationPolling,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications // ⭐ NUEVO
} from "../utils/notificationService";
// import PushNotificationTester from '../components/PushNotificationTester';

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
  }, []);

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

  // ⭐ NUEVA FUNCIÓN: Desactivar notificaciones push
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

  // Comunicación con el Service Worker
  useEffect(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "QUOTATION_SYNCED") {
          alert(`Cotización sincronizada: ${event.data.item.nombre}`);
        }
      });
    }

    window.addEventListener("online", () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "PROCESS_QUEUE" });
      }
    });

    return () => {
      stopQuotationPolling();
    };
  }, []);

  // Formulario
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre || !formData.telefono || !formData.moto) {
      alert("Completa todos los campos.");
      return;
    }

    setLoading(true);

    if (!navigator.onLine) {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "ADD_TO_CART",
          item: formData,
        });
        alert("Guardado offline. Se enviará al reconectar.");
      }
      setFormData({ nombre: "", telefono: "", moto: "" });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("http://localhost:4000/cotizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      alert(`Enviado correctamente. ID: ${data.cotizacion._id}`);
    } catch {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "ADD_TO_CART",
          item: formData,
        });
        alert("Guardado offline.");
      }
    } finally {
      setFormData({ nombre: "", telefono: "", moto: "" });
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* HEADER */}
      <header className="dashboard-header">
        <h1>🏍️ Tienda de Motos</h1>
        <p>Bienvenido, {username || 'Usuario'}</p>

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

              {/* ⭐ BOTÓN DE DESACTIVAR */}
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
        <div className="card"><h2>3</h2><p>Pedidos pendientes</p></div>
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
              <button className="btn-vermas">Ver más</button>
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
          <button type="submit" className="btn-enviar" disabled={loading}>
            {loading ? "⏳ Enviando..." : "📩 Enviar Solicitud"}
          </button>
        </form>
      </section>

      {/* <PushNotificationTester /> */}
    </div>
  );
};

export default Dashboard;
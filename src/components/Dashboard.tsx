import React, { useState, useEffect } from "react";
import "./Dashboard.css";

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
      // 📴 Guardar directamente offline
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

    // 🌐 Si hay conexión, intentar enviar al servidor
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

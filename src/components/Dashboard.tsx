import React from "react";
import "./Dashboard.css";

const motos = [
  {
    nombre: "Honda CBR",
    descripcion: "Una moto deportiva con excelente rendimiento.",
    imagen: "/src/assets/cbr.png",
  },
  {
    nombre: "Honda CB190R",
    descripcion: "Perfecta para ciudad, ágil y moderna.",
    imagen: "/src/assets/cb190r.png",
  },
  {
    nombre: "Honda Invicta",
    descripcion: "Moto confiable para uso diario.",
    imagen: "/src/assets/invicta.png",
  },
  {
    nombre: "Honda Fireblade",
    descripcion: "Máxima potencia para los amantes de la velocidad.",
    imagen: "/src/assets/fireblade.png",
  },
  {
    nombre: "Honda Twister",
    descripcion: "Versátil y cómoda, ideal para trayectos largos.",
    imagen: "/src/assets/twister.png",
  },
  // {
  //   nombre: "Yamaha R1",
  //   descripcion: "Deportiva de alto rendimiento con diseño moderno.",
  //   imagen: "https://imgs.search.brave.com/zJMul8iZMgLimJaXFXspGxUyCcdd2NefGkRzUrqiXNo/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly93YWxs/cGFwZXJjYXQuY29t/L3cvZnVsbC9mLzQv/MS8xNzYyODEwLTI1/NjB4MTQ0MC1kZXNr/dG9wLWhkLXlhbWFo/YS15emYtcjEtd2Fs/bHBhcGVyLmpwZw",
  // },
  // {
  //   nombre: "KTM Duke 390",
  //   descripcion: "Ligera, ágil y perfecta para la ciudad.",
  //   imagen: "https://imgs.search.brave.com/T1d13U_t-9RsZnKIUzNLga9bduKZ8eUwVEMHUdwp6nE/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pbWdk/LmFlcGxjZG4uY29t/LzEwNTZ4NTk0L24v/Y3cvZWMvMTI5NzQ3/L2R1a2UtMzkwLXJp/Z2h0LWZyb250LXRo/cmVlLXF1YXJ0ZXIt/My5wbmc_aXNpZz0w/JnE9ODAmd209Mw",
  // },
];

const Dashboard: React.FC = () => {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>🏍️ Tienda de Motos</h1>
        <p>Bienvenido al panel de administración</p>
      </header>

      <section className="dashboard-stats">
        <div className="card">
          <h2>15</h2>
          <p>Motos en inventario</p>
        </div>
        <div className="card">
          <h2>8</h2>
          <p>Ventas este mes</p>
        </div>
        <div className="card">
          <h2>3</h2>
          <p>Pedidos pendientes</p>
        </div>
      </section>

      <section className="dashboard-actions">
        <button>➕ Agregar Moto</button>
        <button>📦 Ver Pedidos</button>
        <button>👤 Gestionar Usuarios</button>
      </section>

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
    </div>
  );
};

export default Dashboard;

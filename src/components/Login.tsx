import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const navigate = useNavigate();

  // 🔐 Login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:4000/usuario/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok) {
        // ⭐ NUEVO: Guardar username y rol en localStorage
        localStorage.setItem('username', data.username);
        localStorage.setItem('isAdmin', data.admin);
        
        alert(`✅ Bienvenido ${data.username}`);
        
        // ⭐ NUEVO: Redirigir según el rol
        if (data.admin === "si") {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
      } else {
        alert(`❌ ${data.message}`);
      }
    } catch (err) {
      alert("⚠️ Error al conectar con el servidor");
    }
  };

  // 🧩 Registrar nuevo usuario
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:4000/usuario/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUser, password: newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        alert(`✅ Usuario "${data.username}" registrado correctamente`);
        setShowModal(false);
        setNewUser("");
        setNewPassword("");
      } else {
        alert(`❌ ${data.message}`);
      }
    } catch (err) {
      alert("⚠️ Error al conectar con el servidor");
    }
  };

  return (
    <div className="login-container">
      <form className="login" onSubmit={handleSubmit}>
        <h2>Iniciar Sesión</h2>
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Entrar</button>
        <button
          type="button"
          className="btn-add-user"
          onClick={() => setShowModal(true)}
        >
          ➕ Añadir Usuario
        </button>
      </form>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Registrar Nuevo Usuario</h3>
            <form onSubmit={handleRegister}>
              <input
                type="text"
                placeholder="Nuevo usuario"
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button type="submit">Registrar</button>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
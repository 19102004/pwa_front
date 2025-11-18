import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Admin.css';

interface Usuario {
  _id: string;
  username: string;
  admin: string;
  createdAt?: string;
  pushSubscription?: {
    subscriptionId?: string;
    subscribedAt?: string;
    endpoint?: string;
  };
}

interface Notificacion {
  id: number;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
  status: 'enviando' | 'entregada' | 'error';
}

const Admin: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const navigate = useNavigate();

  // 📥 Cargar usuarios desde el backend
  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://pwa-back-6fqc.onrender.com/usuario/todos');
      const data = await res.json();
      
      if (res.ok) {
        setUsuarios(data);
        console.log('✅ Usuarios cargados:', data.length);
        
        // Contar suscritos
        const suscritos = data.filter((u: Usuario) => u.pushSubscription?.subscriptionId).length;
        console.log(`📊 Usuarios suscritos: ${suscritos}/${data.length}`);
      } else {
        alert('❌ Error al cargar usuarios');
      }
    } catch (err) {
      console.error(err);
      alert('⚠️ Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
    
    // Auto-refrescar cada 30 segundos
    const interval = setInterval(cargarUsuarios, 30000);
    return () => clearInterval(interval);
  }, []);

  // 🔔 Enviar notificación PUSH personalizada al usuario
  const enviarNotificacion = async (userId: string, userName: string) => {
    // Prevenir múltiples envíos simultáneos
    if (sendingTo) {
      alert('⏳ Ya hay una notificación en proceso. Espera un momento.');
      return;
    }

    const mensaje = prompt(
      `Escribe el mensaje para ${userName}:`,
      'Recuerda hacer tu cotización'
    );
    
    if (!mensaje) return; // Usuario canceló
    
    setSendingTo(userId);
    
    try {
      console.log(`📤 Enviando notificación a: ${userName} (${userId})`);
      
      // Crear notificación local inmediatamente
      const nuevaNotificacion: Notificacion = {
        id: Date.now(),
        userId,
        userName,
        message: mensaje,
        timestamp: new Date().toLocaleString('es-MX'),
        status: 'enviando'
      };

      setNotificaciones(prev => [nuevaNotificacion, ...prev]);

      // Enviar notificación PUSH al backend
      const res = await fetch(`https://pwa-back-6fqc.onrender.com/usuario/send-notification/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🏍️ Mensaje del Administrador',
          body: mensaje,
          data: {
            url: '/dashboard',
            type: 'admin-message',
            timestamp: Date.now()
          }
        })
      });

      const data = await res.json();

      if (data.success) {
        console.log('✅ Notificación push enviada exitosamente');
        
        // Cambiar estado a "entregada"
        setTimeout(() => {
          setNotificaciones(prev =>
            prev.map(n => n.id === nuevaNotificacion.id ? { ...n, status: 'entregada' } : n)
          );
        }, 800);

        // Mostrar toast de éxito
        const toast = document.createElement('div');
        toast.className = 'success-toast';
        toast.textContent = `✅ Notificación enviada a ${userName}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
        
      } else {
        console.error('❌ Error del servidor:', data.message);
        
        // Cambiar estado a "error"
        setNotificaciones(prev =>
          prev.map(n => n.id === nuevaNotificacion.id ? { ...n, status: 'error' } : n)
        );
        
        alert(`⚠️ ${data.message}`);
      }
    } catch (err) {
      console.error('❌ Error al enviar notificación:', err);
      
      // Cambiar estado a "error"
      setNotificaciones(prev =>
        prev.map(n => n.userId === userId && n.status === 'enviando' ? { ...n, status: 'error' } : n)
      );
      
      alert('⚠️ Error al enviar notificación. Verifica la conexión.');
    } finally {
      setSendingTo(null);
    }
  };

  // 🔔 Enviar notificación a TODOS los suscritos
  const enviarATodos = async () => {
    const suscritos = usuarios.filter(u => u.pushSubscription?.subscriptionId);
    
    if (suscritos.length === 0) {
      alert('⚠️ No hay usuarios suscritos a notificaciones push');
      return;
    }

    const mensaje = prompt(
      `Enviar mensaje a ${suscritos.length} usuario(s):`,
      '¡Nuevas ofertas disponibles en motos Honda!'
    );
    
    if (!mensaje) return;

    const confirmacion = confirm(
      `¿Enviar notificación a ${suscritos.length} usuario(s)?\n\nMensaje: "${mensaje}"`
    );
    
    if (!confirmacion) return;

    let exitosos = 0;
    let errores = 0;

    for (const user of suscritos) {
      try {
        const res = await fetch(`https://pwa-back-6fqc.onrender.com/usuario/send-notification/${user._id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '🏍️ Anuncio Importante',
            body: mensaje,
            data: {
              url: '/dashboard',
              type: 'broadcast',
              timestamp: Date.now()
            }
          })
        });

        const data = await res.json();
        
        if (data.success) {
          exitosos++;
          
          // Agregar a la lista de notificaciones
          const nuevaNotif: Notificacion = {
            id: Date.now() + exitosos,
            userId: user._id,
            userName: user.username,
            message: mensaje,
            timestamp: new Date().toLocaleString('es-MX'),
            status: 'entregada'
          };
          
          setNotificaciones(prev => [nuevaNotif, ...prev]);
        } else {
          errores++;
        }

        // Pequeña pausa entre envíos
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (err) {
        console.error(`Error enviando a ${user.username}:`, err);
        errores++;
      }
    }

    alert(`📊 Envío completado:\n✅ Exitosos: ${exitosos}\n❌ Errores: ${errores}`);
  };

  // 🚪 Cerrar sesión
  const handleLogout = () => {
    if (window.confirm('¿Seguro que quieres cerrar sesión?')) {
      localStorage.removeItem('username');
      localStorage.removeItem('isAdmin');
      navigate('/');
    }
  };

  // Estadísticas
  const suscritos = usuarios.filter(u => u.pushSubscription?.subscriptionId).length;
  const noSuscritos = usuarios.length - suscritos;

  return (
    <div className="admin-container">
      {/* Header */}
      <div className="admin-header">
        <div>
          <h1>🎛️ Panel de Administración</h1>
          <p>Gestiona usuarios y envía notificaciones push personalizadas</p>
          <div style={{ marginTop: '8px', fontSize: '0.9rem', color: '#666' }}>
            📊 {suscritos} suscritos • {noSuscritos} sin suscribir • {usuarios.length} total
          </div>
        </div>
        <div className="admin-actions">
          <button 
            className="btn-broadcast" 
            onClick={enviarATodos}
            disabled={suscritos === 0}
            title={suscritos === 0 ? 'No hay usuarios suscritos' : 'Enviar a todos'}
          >
            📢 Enviar a Todos ({suscritos})
          </button>
          <button className="btn-refresh" onClick={cargarUsuarios} disabled={loading}>
            <span className={loading ? 'spinning' : ''}>🔄</span>
            Actualizar
          </button>
          <button className="btn-logout" onClick={handleLogout}>
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>

      <div className="admin-content">
        {/* Lista de Usuarios */}
        <div className="usuarios-section">
          <h2>
            👥 Usuarios Registrados ({usuarios.length})
          </h2>

          {loading ? (
            <div className="loading">Cargando usuarios...</div>
          ) : usuarios.length === 0 ? (
            <div className="empty-state">No hay usuarios registrados</div>
          ) : (
            <div className="usuarios-list">
              {usuarios.map(user => (
                <div key={user._id} className="usuario-card">
                  <div className="usuario-info">
                    <div className="usuario-avatar">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="usuario-details">
                      <h3>{user.username}</h3>
                      <span className={`badge ${user.admin === 'si' ? 'badge-admin' : 'badge-user'}`}>
                        {user.admin === 'si' ? '👑 Admin' : '👤 Usuario'}
                      </span>
                      {user.createdAt && (
                        <p className="fecha">
                          📅 {new Date(user.createdAt).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      )}
                      {user.pushSubscription?.subscriptionId ? (
                        <div className="push-status subscribed">
                          <span>🔔 Suscrito a notificaciones</span>
                          {user.pushSubscription.subscribedAt && (
                            <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                              Desde: {new Date(user.pushSubscription.subscribedAt).toLocaleDateString('es-MX')}
                            </small>
                          )}
                        </div>
                      ) : (
                        <p className="push-status not-subscribed">
                          🔕 Sin suscripción push
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    className={`btn-notificar ${!user.pushSubscription?.subscriptionId || sendingTo === user._id ? 'disabled' : ''}`}
                    onClick={() => enviarNotificacion(user._id, user.username)}
                    disabled={!user.pushSubscription?.subscriptionId || sendingTo === user._id}
                    title={
                      !user.pushSubscription?.subscriptionId 
                        ? 'Usuario no suscrito a notificaciones' 
                        : sendingTo === user._id
                        ? 'Enviando...'
                        : 'Enviar notificación push personalizada'
                    }
                  >
                    {sendingTo === user._id ? (
                      <>⏳ Enviando...</>
                    ) : (
                      <>🔔 Enviar Notificación</>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel de Notificaciones */}
        <div className="notificaciones-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>📬 Historial de Notificaciones</h2>
            {notificaciones.length > 0 && (
              <button 
                className="btn-clear-history"
                onClick={() => {
                  if (confirm('¿Limpiar historial de notificaciones?')) {
                    setNotificaciones([]);
                  }
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.85rem',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                🗑️ Limpiar
              </button>
            )}
          </div>

          {notificaciones.length === 0 ? (
            <div className="empty-state">
              No hay notificaciones enviadas aún
            </div>
          ) : (
            <div className="notificaciones-list">
              {notificaciones.map(notif => (
                <div key={notif.id} className={`notificacion-card status-${notif.status}`}>
                  <div className="notif-header">
                    <strong>👤 {notif.userName}</strong>
                    <span className={`status ${notif.status}`}>
                      {notif.status === 'enviando' && '⏳ Enviando...'}
                      {notif.status === 'entregada' && '✅ Entregada'}
                      {notif.status === 'error' && '❌ Error'}
                    </span>
                  </div>
                  <p className="notif-message">💬 "{notif.message}"</p>
                  <p className="notif-time">🕐 {notif.timestamp}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
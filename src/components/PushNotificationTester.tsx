// import { useState } from 'react';

// export default function PushNotificationTester() {
//   const [logs, setLogs] = useState<string[]>([]);
//   const [testing, setTesting] = useState(false);

//   const addLog = (message: string) => {
//     console.log(message);
//     setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
//   };

//   const testPushSubscription = async () => {
//     setTesting(true);
//     setLogs([]);
    
//     try {
//       // PASO 1: Verificar username
//       const username = localStorage.getItem('username');
//       addLog(`✅ PASO 1: Username obtenido: ${username}`);
      
//       if (!username) {
//         addLog('❌ ERROR: No hay username en localStorage');
//         addLog('   Debes iniciar sesión primero');
//         setTesting(false);
//         return;
//       }

//       // PASO 2: Verificar Service Worker
//       if (!('serviceWorker' in navigator)) {
//         addLog('❌ ERROR: Service Worker no soportado');
//         setTesting(false);
//         return;
//       }
//       addLog('✅ PASO 2: Service Worker soportado');

//       // PASO 3: Solicitar permisos
//       addLog('📡 PASO 3: Solicitando permisos de notificación...');
//       const permission = await Notification.requestPermission();
//       addLog(`✅ PASO 3: Permiso de notificaciones: ${permission}`);
      
//       if (permission !== 'granted') {
//         addLog('❌ ERROR: Permisos denegados');
//         addLog('   Debes permitir las notificaciones en tu navegador');
//         setTesting(false);
//         return;
//       }

//       // PASO 4: Obtener clave VAPID
//       addLog('📡 PASO 4: Obteniendo clave VAPID del backend...');
//       const vapidRes = await fetch('http://localhost:4000/push/vapid-public-key');
      
//       if (!vapidRes.ok) {
//         addLog(`❌ ERROR: No se pudo conectar con /push/vapid-public-key`);
//         addLog(`   Status: ${vapidRes.status}`);
//         setTesting(false);
//         return;
//       }
      
//       const vapidData = await vapidRes.json();
      
//       if (!vapidData.success || !vapidData.publicKey) {
//         addLog('❌ ERROR: No se pudo obtener la clave VAPID');
//         addLog(`   Respuesta: ${JSON.stringify(vapidData)}`);
//         setTesting(false);
//         return;
//       }
//       addLog(`✅ PASO 4: VAPID key obtenida: ${vapidData.publicKey.substring(0, 30)}...`);

//       // PASO 5: Convertir clave VAPID
//       addLog('📝 PASO 5: Convirtiendo clave VAPID a Uint8Array...');
      
//       function urlBase64ToUint8Array(base64String: string): Uint8Array {
//         const padding = '='.repeat((4 - base64String.length % 4) % 4);
//         const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
//         const rawData = window.atob(base64);
//         const outputArray = new Uint8Array(rawData.length);
//         for (let i = 0; i < rawData.length; ++i) {
//           outputArray[i] = rawData.charCodeAt(i);
//         }
//         return outputArray;
//       }
      
//       const vapidKey = urlBase64ToUint8Array(vapidData.publicKey);
//       addLog('✅ PASO 5: Clave VAPID convertida exitosamente');

//       // PASO 6: Esperar Service Worker
//       addLog('📡 PASO 6: Esperando que el Service Worker esté listo...');
//       const registration = await navigator.serviceWorker.ready;
//       addLog('✅ PASO 6: Service Worker listo');
//       addLog(`   Scope: ${registration.scope}`);

//       // PASO 7: Crear suscripción push
//       addLog('📡 PASO 7: Creando suscripción push con el navegador...');
//       const subscription = await registration.pushManager.subscribe({
//         userVisibleOnly: true,
//         applicationServerKey: vapidKey as BufferSource
//       });
//       addLog(`✅ PASO 7: Suscripción push creada`);
//       addLog(`   Endpoint: ${subscription.endpoint.substring(0, 60)}...`);

//       // PASO 8: Registrar en el backend (/push/subscribe)
//       addLog('📡 PASO 8: Registrando suscripción en /push/subscribe...');
//       const subscribeRes = await fetch('http://localhost:4000/push/subscribe', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(subscription)
//       });

//       if (!subscribeRes.ok) {
//         const errorText = await subscribeRes.text();
//         addLog(`❌ ERROR en /push/subscribe: ${subscribeRes.status}`);
//         addLog(`   Respuesta: ${errorText}`);
//         setTesting(false);
//         return;
//       }

//       const subscribeData = await subscribeRes.json();
      
//       if (!subscribeData.success) {
//         addLog(`❌ ERROR: ${subscribeData.message || 'Respuesta sin success'}`);
//         setTesting(false);
//         return;
//       }
      
//       addLog(`✅ PASO 8: Suscripción registrada en el servidor`);
//       addLog(`   SubscriptionId: ${subscribeData.subscriptionId}`);

//       // PASO 9: Asociar con el usuario (/usuario/subscribe-push)
//       addLog('');
//       addLog('🔗 ========================================');
//       addLog('🔗 PASO 9: ASOCIANDO CON EL USUARIO');
//       addLog(`🔗 Username: ${username}`);
//       addLog(`🔗 SubscriptionId: ${subscribeData.subscriptionId}`);
//       addLog('🔗 ========================================');
      
//       const associateBody = {
//         username: username,
//         subscription: subscription.toJSON(),
//         subscriptionId: subscribeData.subscriptionId
//       };

//       addLog('📡 Haciendo POST a /usuario/subscribe-push...');
//       const associateRes = await fetch('http://localhost:4000/usuario/subscribe-push', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(associateBody)
//       });

//       addLog(`📡 Status de respuesta: ${associateRes.status}`);

//       if (!associateRes.ok) {
//         const errorText = await associateRes.text();
//         addLog(`❌ ERROR en /usuario/subscribe-push: ${associateRes.status}`);
//         addLog(`   Respuesta: ${errorText}`);
//         setTesting(false);
//         return;
//       }

//       const associateData = await associateRes.json();
//       addLog(`📥 Respuesta recibida: ${JSON.stringify(associateData, null, 2)}`);
      
//       if (!associateData.success) {
//         addLog(`❌ ERROR: ${associateData.message || 'Asociación falló'}`);
//         setTesting(false);
//         return;
//       }

//       addLog('✅ PASO 9: ¡Suscripción asociada al usuario exitosamente!');
//       addLog('🔗 ========================================');
//       addLog('');

//       // PASO 10: Guardar en localStorage
//       localStorage.setItem('pushSubscriptionId', subscribeData.subscriptionId);
//       localStorage.setItem('pushSubscribedUser', username);
//       addLog('✅ PASO 10: Datos guardados en localStorage');

//       addLog('');
//       addLog('🎉 ========================================');
//       addLog('🎉 ¡SUSCRIPCIÓN COMPLETADA CON ÉXITO!');
//       addLog(`🎉 Usuario: ${username}`);
//       addLog(`🎉 SubscriptionId: ${subscribeData.subscriptionId}`);
//       addLog('🎉 ========================================');
//       addLog('');
//       addLog('📋 PRÓXIMOS PASOS:');
//       addLog('1. Verifica en MongoDB que el usuario tenga el campo pushSubscription');
//       addLog('2. Refresca el panel de Admin (F5)');
//       addLog('3. El usuario debería mostrar "🔔 Suscrito a notificaciones"');
//       addLog('4. Envía una notificación de prueba desde el Admin');
//       addLog('');

//       alert('🎉 ¡Suscripción exitosa! Verifica los logs para más detalles');

//     } catch (error: any) {
//       addLog('');
//       addLog('❌ ========================================');
//       addLog('❌ ERROR FATAL');
//       addLog(`❌ ${error.message}`);
//       addLog('❌ ========================================');
//       console.error('Error completo:', error);
//       alert(`❌ Error: ${error.message}`);
//     } finally {
//       setTesting(false);
//     }
//   };

//   return (
//     <div style={{
//       position: 'fixed',
//       bottom: '20px',
//       right: '20px',
//       background: 'white',
//       border: '2px solid #667eea',
//       borderRadius: '12px',
//       padding: '20px',
//       maxWidth: '650px',
//       maxHeight: '550px',
//       boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
//       zIndex: 9999,
//       display: 'flex',
//       flexDirection: 'column',
//       gap: '12px'
//     }}>
//       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//         <h3 style={{ margin: 0, color: '#667eea', fontSize: '1.1rem' }}>
//           🧪 Testing de Notificaciones Push
//         </h3>
//       </div>

//       <button
//         onClick={testPushSubscription}
//         disabled={testing}
//         style={{
//           padding: '14px 28px',
//           background: testing ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
//           color: 'white',
//           border: 'none',
//           borderRadius: '8px',
//           cursor: testing ? 'not-allowed' : 'pointer',
//           fontWeight: 'bold',
//           fontSize: '1rem',
//           transition: 'all 0.3s ease',
//           boxShadow: testing ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)'
//         }}
//       >
//         {testing ? '⏳ Probando suscripción...' : '🚀 Probar Suscripción Completa'}
//       </button>

//       {logs.length > 0 && (
//         <>
//           <div style={{
//             flex: 1,
//             overflowY: 'auto',
//             background: '#1e1e1e',
//             color: '#d4d4d4',
//             padding: '12px',
//             borderRadius: '8px',
//             fontFamily: '"Consolas", "Monaco", monospace',
//             fontSize: '0.8rem',
//             lineHeight: '1.6',
//             maxHeight: '350px'
//           }}>
//             {logs.map((log, index) => (
//               <div key={index} style={{
//                 marginBottom: '4px',
//                 color: log.includes('❌') ? '#f44336' : 
//                        log.includes('✅') ? '#4caf50' : 
//                        log.includes('📡') ? '#2196f3' :
//                        log.includes('🎉') ? '#ff9800' :
//                        log.includes('🔗') ? '#9c27b0' : '#d4d4d4',
//                 wordBreak: 'break-word'
//               }}>
//                 {log}
//               </div>
//             ))}
//           </div>
          
//           <button
//             onClick={() => setLogs([])}
//             style={{
//               padding: '8px 16px',
//               background: '#f44336',
//               color: 'white',
//               border: 'none',
//               borderRadius: '6px',
//               cursor: 'pointer',
//               fontSize: '0.85rem',
//               fontWeight: 'bold'
//             }}
//           >
//             🗑️ Limpiar Logs
//           </button>
//         </>
//       )}

//       <div style={{ 
//         fontSize: '0.7rem', 
//         color: '#666', 
//         textAlign: 'center',
//         borderTop: '1px solid #eee',
//         paddingTop: '10px'
//       }}>
//         💡 Este componente es solo para testing. Elimínalo después de verificar que funciona.
//       </div>
//     </div>
//   );
// }
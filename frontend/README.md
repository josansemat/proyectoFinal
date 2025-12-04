# Frontend (React + Vite)

Aplicación React que consume el backend PHP de Furbo. Incluye autenticación, dashboard para equipos y ahora notificaciones push vía Firebase Cloud Messaging.

## Requisitos

- Node.js 20+
- npm 10+
- Cuenta de Firebase con un proyecto configurado para Web
- Clave pública VAPID para FCM Web Push (en consola de Firebase → Project settings → Cloud Messaging)

## Scripts

```bash
npm install   # instala dependencias
npm run dev   # modo desarrollo
npm run build # build producción
npm run preview
```

## Configuración de entorno

1. Copia `backend/.env` y rellena `FIREBASE_SERVER_KEY` con la Server Key (Cloud Messaging) del proyecto.
2. En el frontend, crea un fichero `frontend/.env` con:

```
VITE_FIREBASE_VAPID_KEY=TU_CLAVE_PUBLICA_VAPID
```

Sin esta clave el navegador no podrá generar tokens FCM.

## Flujo de notificaciones push

1. Al iniciar sesión se solicita permiso de notificaciones.
2. Si el usuario acepta, se registra el token en `/api/index.php?action=registrar_fcm_token` junto con el dispositivo.
3. Managers y administradores pueden llamar al endpoint `notificar_equipo` para disparar un push. El backend usa la Server Key para enviar a los tokens activos del equipo.
4. El navegador muestra un toast en primer plano y, si está cerrado, el service worker despliega la notificación nativa.

## Archivos clave

- `src/lib/firebase.js`: inicialización y helpers de Firebase (messaging + analytics).
- `src/services/pushNotifications.js`: registro/desregistro de tokens y listeners en el frontend.
- `public/firebase-messaging-sw.js`: service worker que recibe mensajes en background.

## Resolución de problemas

- **`Falta VITE_FIREBASE_VAPID_KEY`**: revisa tu `.env` del frontend.
- **`Falta FIREBASE_SERVER_KEY`**: añade la server key al `.env` del backend.
- **Sin notificaciones en background**: asegúrate de servir sobre HTTPS (excepto `localhost`).

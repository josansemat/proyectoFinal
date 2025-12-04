# Backend PHP (API)

API en PHP que expone jugadores, equipos, partidos y el módulo de notificaciones push vía Firebase Cloud Messaging.

## Configuración

1. Copia `.env` desde el ejemplo y rellena credenciales de MySQL/SMTP.
2. En Firebase Console descarga un JSON de service account (IAM & Admin → Service Accounts).
   - Guárdalo como `backend/config/firebase-credentials.json` con permisos `600` (usa el ejemplo `firebase-credentials.example.json`).
   - Asegúrate de que `FIREBASE_PROJECT_ID` y `FIREBASE_CREDENTIALS_PATH` apuntan a tu proyecto en `.env`.
3. Habilita la **Cloud Messaging API (HTTP v1)** en Google Cloud Console (`firebasecloudmessaging.googleapis.com`).
4. Ejecuta el script SQL (`models/furbo(5).sql`) para crear la tabla `fcm_tokens` si aún no existe.

## Endpoints destacados

| Acción (`action=`) | Método | Descripción |
|--------------------|--------|-------------|
| `registrar_fcm_token` | POST | Guarda/actualiza el token FCM de un jugador (`{ id_jugador, token, device }`). |
| `desactivar_fcm_token` | POST | Marca un token (o todos los del jugador) como inactivos. |
| `notificar_equipo` | POST | Managers/Admin envían un push a todos los jugadores de un equipo. |
| `notificar_jugadores` | POST | Envío masivo (solo admins) a una lista de IDs. |

`NotificacionesController` valida permisos antes de llamar a `FirebaseNotifier`.

## Envío de notificaciones

El helper `services/FirebaseNotifier.php` usa la API HTTP v1:

1. Firma un JWT con la private key del service account.
2. Intercambia el JWT por un access token OAuth2 (`https://oauth2.googleapis.com/token`).
3. Envía peticiones `POST https://fcm.googleapis.com/v1/projects/<project-id>/messages:send` con `notification`, `data` y `webpush`.
4. Tokens inválidos se marcan automáticamente como inactivos en `fcm_tokens`.

## Dependencias

- Dotenv para variables de entorno.
- PDO (MySQL).
- PHPMailer para SMTP.
- cURL + OpenSSL para integrar con Firebase HTTP v1.

> La antigua `FIREBASE_SERVER_KEY` queda como referencia por si necesitas compatibilidad con la API legacy. El envío oficial se hace vía HTTP v1 con el JSON del service account.

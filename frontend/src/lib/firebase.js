import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getMessaging, getToken, isSupported as isMessagingSupported, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyB3SFLIi76cagQyBrh3aJz4cQA4BVDEaC0",
  authDomain: "furbitogenuine-63287.firebaseapp.com",
  projectId: "furbitogenuine-63287",
  storageBucket: "furbitogenuine-63287.firebasestorage.app",
  messagingSenderId: "1096154798411",
  appId: "1:1096154798411:web:7708b7285619b45e9c30ce",
  measurementId: "G-18QZWCNBL8"
};

const firebaseApp = initializeApp(firebaseConfig);

let analyticsInstance = null;
if (typeof window !== "undefined") {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        analyticsInstance = getAnalytics(firebaseApp);
      }
    })
    .catch((err) => console.warn("Firebase analytics no disponible", err));
}

let messagingPromise = Promise.resolve(null);
if (typeof window !== "undefined") {
  messagingPromise = isMessagingSupported()
    .then((supported) => (supported ? getMessaging(firebaseApp) : null))
    .catch((err) => {
      console.warn("Firebase messaging no soportado", err);
      return null;
    });
}

async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  const existing = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
  if (existing) {
    return existing;
  }
  try {
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (err) {
    console.error("No se pudo registrar el service worker de Firebase", err);
    return null;
  }
}

export async function generateFcmToken() {
  if (Notification.permission === "denied") {
    return null;
  }
  const messaging = await messagingPromise;
  if (!messaging) {
    return null;
  }
  const swRegistration = await ensureServiceWorker();
  if (!swRegistration) {
    return null;
  }
  // La clave VAPID es pública (no es un secreto). Permitimos que venga por .env,
  // pero incluimos un fallback para que funcione también en despliegues donde
  // no se inyecten variables en build.
  const vapidKey =
    import.meta.env.VITE_FIREBASE_VAPID_KEY ||
    "BME-K1Ru1-cmcITK8BjJzH_lSJufHdtHTVnEXzdagX0-YR7QZUGwolLz6D4f2ez-nPGYyQ9Bb2W3m_WDJD9iu_g";
  if (!vapidKey) {
    console.warn("Falta VITE_FIREBASE_VAPID_KEY en el entorno. No se generará token FCM.");
    return null;
  }
  try {
    return await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });
  } catch (err) {
    console.error("Error obteniendo token FCM", err);
    return null;
  }
}

export async function onForegroundNotification(callback) {
  const messaging = await messagingPromise;
  if (!messaging) {
    return () => {};
  }
  return onMessage(messaging, callback);
}

export { firebaseApp, analyticsInstance };

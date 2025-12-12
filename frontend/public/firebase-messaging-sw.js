importScripts("https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB3SFLIi76cagQyBrh3aJz4cQA4BVDEaC0",
  authDomain: "furbitogenuine-63287.firebaseapp.com",
  projectId: "furbitogenuine-63287",
  storageBucket: "furbitogenuine-63287.firebasestorage.app",
  messagingSenderId: "1096154798411",
  appId: "1:1096154798411:web:7708b7285619b45e9c30ce",
  measurementId: "G-18QZWCNBL8"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Si el mensaje incluye `notification`, FCM/WebPush suele mostrar la notificación automáticamente.
  // En ese caso, si además hacemos `showNotification` aquí, aparecen duplicadas.
  const hasNotificationPayload = !!(payload?.notification && Object.keys(payload.notification).length);
  if (hasNotificationPayload) {
    return;
  }

  const data = payload?.data || {};
  const notif = payload?.notification || {};
  const fcmLink = payload?.fcmOptions?.link;

  const notificationTitle = notif.title || data.title || "Furbo";
  const notificationOptions = {
    body: notif.body || data.body || "Tienes una nueva notificación",
    icon: notif.icon || data.icon || "/vite.svg",
    image: notif.image || data.image,
    // Guardamos info para el click. Priorizamos link absoluto si viene de FCM.
    data: {
      ...data,
      click_action: data.click_action || fcmLink || notif.click_action || "/inicio",
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const fcmMsg = event.notification?.data?.FCM_MSG;
  const targetUrl =
    event.notification?.data?.click_action ||
    fcmMsg?.data?.click_action ||
    fcmMsg?.fcmOptions?.link ||
    "/inicio";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          const target = new URL(targetUrl, url.origin);
          if (url.href === target.href) {
            return client.focus();
          }
        } catch {
          // ignore
        }
      }
      return clients.openWindow(targetUrl);
    })()
  );
});

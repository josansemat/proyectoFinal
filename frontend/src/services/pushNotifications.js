import { generateFcmToken, onForegroundNotification } from "../lib/firebase";

const TOKEN_STORAGE_KEY = "furbo_fcm_token";
const TOKEN_OWNER_KEY = "furbo_fcm_token_owner";

const headers = { "Content-Type": "application/json" };

function supportsNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function registerPushToken(user) {
  if (!supportsNotifications() || !user) {
    return null;
  }

  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return null;
    }
  }

  if (Notification.permission !== "granted") {
    return null;
  }

  const token = await generateFcmToken();
  if (!token) {
    return null;
  }

  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const storedOwner = localStorage.getItem(TOKEN_OWNER_KEY);
  const ownerMatches = storedOwner === String(user.id);

  if (storedToken === token && ownerMatches) {
    return token;
  }

  try {
    await fetch(`/api/index.php?action=registrar_fcm_token`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id_jugador: user.id,
        token,
        device: navigator.userAgent.slice(0, 500),
      }),
    });
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(TOKEN_OWNER_KEY, String(user.id));
    return token;
  } catch (err) {
    console.error("No se pudo registrar el token FCM", err);
    return null;
  }
}

export async function deregisterPushToken() {
  if (!supportsNotifications()) {
    return;
  }
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) {
    return;
  }
  try {
    await fetch(`/api/index.php?action=desactivar_fcm_token`, {
      method: "POST",
      headers,
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    console.warn("No se pudo desactivar el token en el backend", err);
  } finally {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_OWNER_KEY);
  }
}

export async function listenForegroundNotifications(handler) {
  if (!supportsNotifications()) {
    return () => {};
  }
  return onForegroundNotification(handler);
}

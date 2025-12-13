import { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./css/layout/app-layout.css";
import "./css/layout/ui-elements.css";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Sidebar from "./components/Sidebar.jsx";
import Inicio from "./pages/Inicio";
import BuscarEquipos from "./pages/BuscarEquipos";
import ManagerSolicitudes from "./pages/ManagerSolicitudes";
import EditarClub from "./pages/EditarClub";
import CreateJugador from "./pages/CreateJugador.jsx";
import Plantilla from "./pages/Plantilla.jsx";
import MiPerfil from "./pages/MiPerfil.jsx";
import AdminJugadores from "./pages/admin/AdminJugadores.jsx";
import AdminEquipos from "./pages/admin/AdminEquipos";
import PartidosDashboard from "./pages/partido/PartidosDashboard";
import Ranking from "./pages/Ranking";
import PoliticaPrivacidad from "./pages/PoliticaPrivacidad";
import ManualUso from "./pages/ManualUso";
import Bus from "./pages/Bus";
import { registerPushToken, deregisterPushToken, listenForegroundNotifications } from "./services/pushNotifications";

// Guard de rutas para admin
function RequireAdmin({ user, children }) {
  const role = user?.rol_global ?? user?.rol ?? "usuario";
  const isAdmin = role === "admin";
  if (!isAdmin) {
    return <Navigate to="/inicio" replace />;
  }
  return children;
}

// Guard de rutas para manager o admin (evita acceso por URL a páginas de gestión de club)
function RequireManagerOrAdmin({ user, currentTeam, children }) {
  const role = user?.rol_global ?? user?.rol ?? "usuario";
  const isAdmin = role === "admin";
  const teamRole = (currentTeam?.mi_rol ?? "").toLowerCase();
  const isManager = teamRole === "manager";
  if (!isAdmin && !isManager) {
    return <Navigate to="/inicio" replace />;
  }
  return children;
}

const hexToRgb = (hex) => {
  if (!hex) return '33, 37, 41';
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  let bigint = parseInt(hex, 16);
  let r = (bigint >> 16) & 255;
  let g = (bigint >> 8) & 255;
  let b = bigint & 255;
  return `${r}, ${g}, ${b}`;
};

const isBackgroundLight = (hexcolor) => {
  if (!hexcolor) return false;
  hexcolor = hexcolor.replace("#", "");
  if (hexcolor.length === 3) hexcolor = hexcolor[0]+hexcolor[0]+hexcolor[1]+hexcolor[1]+hexcolor[2]+hexcolor[2];
  var r = parseInt(hexcolor.substr(0, 2), 16);
  var g = parseInt(hexcolor.substr(2, 2), 16);
  var b = parseInt(hexcolor.substr(4, 2), 16);
  return (((r * 299) + (g * 587) + (b * 114)) / 1000) >= 128;
};

const clampByte = (value) => Math.max(0, Math.min(255, value));

const darkenHex = (hex, amount = 0.22) => {
  if (!hex) return hex;
  let normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized[0] + normalized[0] + normalized[1] + normalized[1] + normalized[2] + normalized[2];
  }
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const factor = 1 - amount;
  const rr = clampByte(Math.round(r * factor));
  const gg = clampByte(Math.round(g * factor));
  const bb = clampByte(Math.round(b * factor));
  return `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
};

function App() {
  const [user, setUser] = useState(null);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [currentView, setCurrentView] = useState("login");
  const [resetToken, setResetToken] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isBgLight, setIsBgLight] = useState(false);
  const [incomingNotification, setIncomingNotification] = useState(null);
  const notificationSubRef = useRef(null);

  // --- EFFECT: aplicar colores dinámicos ---
  useEffect(() => {
    const root = document.documentElement;
    const defaultColor = '#212529';
    const colorHex = currentTeam?.color_principal || defaultColor;
    const colorRgb = hexToRgb(colorHex);
    const isLight = isBackgroundLight(colorHex);
    const contrastHex = isLight ? '#212529' : '#ffffff';
    const contrastRgb = hexToRgb(contrastHex);
    setIsBgLight(isLight); 

    // Acción primaria: si el color del equipo es claro, oscurecemos para que el CTA destaque sobre cards blancas.
    const actionHex = isLight ? darkenHex(colorHex, 0.28) : colorHex;
    const actionIsLight = isBackgroundLight(actionHex);
    const actionContrastHex = actionIsLight ? '#212529' : '#ffffff';

    root.style.setProperty('--primary-color', colorHex);
    root.style.setProperty('--primary-rgb', colorRgb);
    root.style.setProperty('--contrast-text-color', contrastHex);
    root.style.setProperty('--contrast-text-color-rgb', contrastRgb);
    root.style.setProperty('--bg-light', isLight ? '#ffffff' : '#343a40');

    root.style.setProperty('--primary-action-color', actionHex);
    root.style.setProperty('--primary-action-contrast-text', actionContrastHex);
  }, [currentTeam]);

  useEffect(() => {
    if (!user) {
      setIncomingNotification(null);
      if (notificationSubRef.current) {
        notificationSubRef.current();
        notificationSubRef.current = null;
      }
      return;
    }

    let mounted = true;
    (async () => {
      try {
        await registerPushToken(user);
        const unsub = await listenForegroundNotifications((payload) => {
          if (!mounted) return;

          const data = payload?.data || {};
          // Trigger silencioso: refrescar roles/equipos sin mostrar toast.
          if (data?.type === "roles_updated") {
            if (user?.id) {
              fetchUserTeams(user.id, user);
            }
            return;
          }

          const notification = payload?.notification || {};
          setIncomingNotification({
            title: notification.title || "Furbo",
            body: notification.body || "Tienes una nueva notificación",
            data,
            receivedAt: Date.now(),
          });
        });
        if (notificationSubRef.current) {
          notificationSubRef.current();
        }
        notificationSubRef.current = unsub;
      } catch (err) {
        console.warn("Notificaciones push no disponibles", err);
      }
    })();

    return () => {
      mounted = false;
      if (notificationSubRef.current) {
        notificationSubRef.current();
        notificationSubRef.current = null;
      }
    };
  }, [user]);

  // Recibir triggers silenciosos desde el Service Worker (cuando el navegador está en background)
  useEffect(() => {
    if (!user?.id) return;
    if (!('serviceWorker' in navigator)) return;

    const onMessage = (event) => {
      const msg = event?.data || {};
      if (msg?.type === 'roles_updated') {
        fetchUserTeams(user.id, user);
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [user]);

  useEffect(() => {
    if (!incomingNotification) return;
    const timeout = setTimeout(() => setIncomingNotification(null), 6000);
    return () => clearTimeout(timeout);
  }, [incomingNotification]);

  // --- CARGA INICIAL DE SESIÓN ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setResetToken(token);
      setCurrentView("reset");
    }

    const loadSession = async () => {
      const storedUserStr = localStorage.getItem("usuario_furbo");
      const storedTeamStr = localStorage.getItem("equipo_actual_furbo");
      if (storedUserStr) {
        const userData = JSON.parse(storedUserStr);
        setUser(userData);
        // Optimista: mostramos el último equipo guardado, y luego lo refrescamos con fetchUserTeams/handleTeamChange.
        if (storedTeamStr) {
          try { setCurrentTeam(JSON.parse(storedTeamStr)); } catch { /* ignore */ }
        }
        try { await fetchUserTeams(userData.id, userData); } catch (e) { console.error(e); }
      }
      setLoadingInitial(false);
    };
    loadSession();
  }, []);

  const fetchUserTeams = async (userId, userContext = null) => {
    try {
      const role = userContext?.rol_global ?? userContext?.rol ?? user?.rol_global ?? user?.rol ?? "usuario";
      const isAdmin = role === "admin";
      const response = await fetch(
        isAdmin
          ? `/api/index.php?action=listar_equipos_todos&rol_global=admin`
          : `/api/index.php?action=mis_equipos&id_jugador=${userId}`,
        { cache: "no-store" }
      );
      const data = await response.json();
      const equipos = (Array.isArray(data.equipos) ? data.equipos : []).map((t) => ({
        ...t,
        // Normalizamos para que el resto de la app siempre lea `mi_rol`
        mi_rol: t.mi_rol ?? t.rol_en_equipo ?? t.rol ?? null,
      }));
      if (data.success && equipos.length > 0) {
        // Para admin: el selector muestra todos los equipos activos.
        // Para usuarios: el selector muestra sus equipos.
        setUserTeams(equipos);
        const storedTeamStr = localStorage.getItem("equipo_actual_furbo");
        let teamToSelect = equipos[0];
        if (storedTeamStr) {
          const storedTeam = JSON.parse(storedTeamStr);
          const found = equipos.find(t => t.id === storedTeam.id);
          // Importante: si el rol cambió en backend, NO debemos quedarnos con el rol viejo del localStorage.
          if (found) teamToSelect = { ...found, mi_rol: found.mi_rol ?? storedTeam.mi_rol ?? null };
        }
        if (!currentTeam || currentTeam.id !== teamToSelect.id) {
          handleTeamChange(teamToSelect);
        } else if (teamToSelect.mi_rol && teamToSelect.mi_rol !== currentTeam.mi_rol) {
          // Si te cambian de rol (jugador <-> manager), hay que reflejarlo sin recargar.
          const enrichedCurrent = { ...currentTeam, mi_rol: teamToSelect.mi_rol };
          setCurrentTeam(enrichedCurrent);
          localStorage.setItem("equipo_actual_furbo", JSON.stringify(enrichedCurrent));
        }
      } else {
        setUserTeams([]); setCurrentTeam(null); localStorage.removeItem("equipo_actual_furbo");
      }
    } catch (e) { console.error("Error fetching teams:", e); }
  };

  const handleLoginSuccess = async (userData) => {
    setUser(userData);
    localStorage.setItem("usuario_furbo", JSON.stringify(userData));
    await fetchUserTeams(userData.id, userData);
    setCurrentView("inicio");
  };

  // --- CORREGIDO: refrescar equipo al instante ---
  const handleTeamChange = async (team) => {
    if (!team) return;
    const resolveRoleFromList = (teamId) => {
      const found = userTeams.find((t) => t.id === teamId);
      return found?.mi_rol ?? null;
    };
    const cachedRole = team.mi_rol ?? resolveRoleFromList(team.id);
    const withRole = (base) => {
      const role = base.mi_rol ?? cachedRole ?? resolveRoleFromList(base.id);
      return { ...base, mi_rol: role };
    };

    // Actualización optimista: refleja el cambio en UI inmediatamente.
    const optimistic = withRole(team);
    setCurrentTeam(optimistic);
    localStorage.setItem("equipo_actual_furbo", JSON.stringify(optimistic));
    setUserTeams((prev) => prev.map((t) => (t.id === optimistic.id ? { ...t, ...optimistic } : t)));

    try {
      const resp = await fetch(`/api/index.php?action=get_equipo&id=${team.id}`, { cache: "no-store" });
      const raw = await resp.json();
      if (raw.success && raw.equipo) {
        const enriched = withRole(raw.equipo);
        setCurrentTeam(enriched);
        localStorage.setItem("equipo_actual_furbo", JSON.stringify(enriched));
        setUserTeams((prev) => prev.map((t) => (t.id === enriched.id ? { ...t, ...enriched } : t)));
      } else {
        const fallback = withRole(team);
        setCurrentTeam(fallback);
        localStorage.setItem("equipo_actual_furbo", JSON.stringify(fallback));
        setUserTeams((prev) => prev.map((t) => (t.id === fallback.id ? { ...t, ...fallback } : t)));
      }
    } catch (err) {
      console.error("Error refrescando equipo:", err);
      const fallback = withRole(team);
      setCurrentTeam(fallback);
      localStorage.setItem("equipo_actual_furbo", JSON.stringify(fallback));
      setUserTeams((prev) => prev.map((t) => (t.id === fallback.id ? { ...t, ...fallback } : t)));
    }
  };

  const handleLogout = useCallback(() => {
    deregisterPushToken();
    setUser(null); setCurrentTeam(null); setUserTeams([]);
    localStorage.removeItem("usuario_furbo"); localStorage.removeItem("equipo_actual_furbo");
    setCurrentView("login");
    document.documentElement.style.removeProperty('--primary-color');
    document.documentElement.style.removeProperty('--primary-rgb');
    document.documentElement.style.removeProperty('--contrast-text-color');
    document.documentElement.style.removeProperty('--bg-light');
  }, []);

  // --- VALIDACIÓN/REFRESCO DE SESIÓN ---
  // - Si el usuario fue baneado (activo=0) o eliminado -> cerramos sesión.
  // - Al volver a la pestaña, refrescamos equipos/roles para que el Sidebar se actualice.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const validateAndRefresh = async () => {
      try {
        const r = await fetch(`/api/index.php?action=get_jugador&id=${user.id}`, { cache: "no-store" });
        const j = await r.json();
        if (cancelled) return;

        if (!j?.success || !j?.jugador) {
          handleLogout();
          return;
        }
        if (Number(j.jugador.activo) === 0) {
          handleLogout();
          return;
        }

        // Si cambió el rol global (admin/usuario), lo actualizamos y refrescamos equipos.
        const nextRole = j.jugador.rol;
        if (nextRole && nextRole !== user.rol) {
          const updatedUser = {
            ...user,
            rol: nextRole,
            nombre: j.jugador.nombre ?? user.nombre,
            apodo: j.jugador.apodo ?? user.apodo,
            email: j.jugador.email ?? user.email,
          };
          setUser(updatedUser);
          localStorage.setItem("usuario_furbo", JSON.stringify(updatedUser));
          try { await fetchUserTeams(updatedUser.id, updatedUser); } catch (e) { console.error(e); }
          return;
        }

        // Refrescar equipos/roles por si te hicieron manager/jugador.
        try { await fetchUserTeams(user.id, user); } catch (e) { console.error(e); }
      } catch (e) {
        // Si falla la validación, no forzamos logout (puede ser caída temporal).
      }
    };

    validateAndRefresh();
    const onFocus = () => validateAndRefresh();
    const onVis = () => { if (document.visibilityState === 'visible') validateAndRefresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    const interval = setInterval(validateAndRefresh, 45000);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(interval);
    };
  }, [user, handleLogout]);

  // --- FONDO DINÁMICO ---
  const defaultBgPath = "/fondos/fondo-default.png";
  let backgroundImagePath = defaultBgPath;
  if (currentTeam?.fondo_imagen) {
    backgroundImagePath = `/fondos/${currentTeam.fondo_imagen}`;
  }

  if (loadingInitial) return <div className="d-flex justify-content-center align-items-center vh-100 bg-dark text-white">Cargando...</div>;

  if (!user) {
    return (
      <div className="App auth-mode">
        {currentView === "login" ? (
          <Login onLoginSuccess={handleLoginSuccess} switchToRegister={() => setCurrentView("register")} />
        ) : currentView === "register" ? (
          <Register switchToLogin={() => setCurrentView("login")} />
        ) : currentView === "reset" ? (
          <ResetPassword token={resetToken} switchToLogin={() => setCurrentView("login")} />
        ) : (
          <Login onLoginSuccess={handleLoginSuccess} switchToRegister={() => setCurrentView("register")} />
        )}
      </div>
    );
  }

  return (
    <Router>
      <div className="app-container d-flex">
        {incomingNotification && (
          <div style={toastStyles}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{incomingNotification.title}</div>
            <div style={{ fontSize: 14 }}>{incomingNotification.body}</div>
            <button style={toastButtonStyles} onClick={() => setIncomingNotification(null)}>Entendido</button>
          </div>
        )}
        <Sidebar user={user} currentTeam={currentTeam} userTeams={userTeams} isBgLight={isBgLight} onTeamChange={handleTeamChange} onLogout={handleLogout} />
        
        {/* Fondo aplicado SOLO al área de contenido */}
        <div className="flex-grow-1 app-main-content" style={{
          backgroundImage: `url('${backgroundImagePath}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          minHeight: '100vh',
        }}>
          <Routes>
            <Route path="/" element={<Inicio user={user} team={currentTeam} />} />
            <Route path="/inicio" element={<Inicio user={user} team={currentTeam} />} />
            <Route path="/buscar-equipos" element={<BuscarEquipos user={user} userTeams={userTeams} isBgLight={isBgLight} />} />
            <Route
              path="/mi-club/solicitudes"
              element={
                <RequireManagerOrAdmin user={user} currentTeam={currentTeam}>
                  <ManagerSolicitudes user={user} currentTeam={currentTeam} isBgLight={isBgLight} />
                </RequireManagerOrAdmin>
              }
            />
            <Route
              path="/mi-club/configurar"
              element={
                <RequireManagerOrAdmin user={user} currentTeam={currentTeam}>
                  <EditarClub user={user} currentTeam={currentTeam} onTeamUpdate={handleTeamChange} />
                </RequireManagerOrAdmin>
              }
            />
            <Route path="/crear-jugador" element={<CreateJugador />} />
            <Route path="/plantilla" element={<Plantilla user={user} currentTeam={currentTeam} />} />
            <Route path="/partidos" element={<PartidosDashboard user={user} currentTeam={currentTeam} />} />
            <Route path="/ranking" element={<Ranking user={user} currentTeam={currentTeam} />} />
            <Route path="/bus" element={<Bus />} />
            <Route path="/politica-privacidad" element={<PoliticaPrivacidad />} />
            <Route path="/manual-uso" element={<ManualUso />} />
            <Route path="/mi-perfil" element={<MiPerfil user={user} currentTeam={currentTeam} onTeamChange={handleTeamChange} onUserUpdate={(u) => setUser(u)} />} />
            <Route path="/admin/jugadores" element={<RequireAdmin user={user}><AdminJugadores user={user} currentTeam={currentTeam} /></RequireAdmin>} />
            <Route path="/admin/equipos" element={<RequireAdmin user={user}><AdminEquipos user={user} currentTeam={currentTeam} /></RequireAdmin>} />
            <Route path="*" element={<Navigate to="/inicio" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

const toastStyles = {
  position: "fixed",
  bottom: "24px",
  right: "24px",
  maxWidth: "300px",
  padding: "16px",
  background: "rgba(0,0,0,0.85)",
  color: "#fff",
  borderRadius: "14px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  zIndex: 9999,
  backdropFilter: "blur(8px)",
};

const toastButtonStyles = {
  marginTop: 12,
  padding: "6px 14px",
  background: "rgba(255,255,255,0.2)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.4)",
  borderRadius: "999px",
  cursor: "pointer",
};

export default App;

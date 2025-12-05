import { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

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
    setIsBgLight(isLight); 

    root.style.setProperty('--primary-color', colorHex);
    root.style.setProperty('--primary-rgb', colorRgb);
    root.style.setProperty('--contrast-text-color', isLight ? '#212529' : '#ffffff');
    root.style.setProperty('--bg-light', isLight ? '#ffffff' : '#343a40');
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
          const notification = payload?.notification || {};
          setIncomingNotification({
            title: notification.title || "Furbo",
            body: notification.body || "Tienes una nueva notificación",
            data: payload?.data || {},
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
        try { await fetchUserTeams(userData.id); } catch (e) { console.error(e); }
        if (storedTeamStr) {
          const storedTeam = JSON.parse(storedTeamStr);
          try {
            const resp = await fetch(`/api/index.php?action=get_equipo&id=${storedTeam.id}`);
            const raw = await resp.json();
            if (raw.success) {
              const enriched = { ...raw.equipo, mi_rol: storedTeam.mi_rol ?? raw.equipo?.mi_rol ?? null };
              setCurrentTeam(enriched);
              localStorage.setItem("equipo_actual_furbo", JSON.stringify(enriched));
            } else {
              setCurrentTeam(storedTeam);
            }
          } catch (err) {
            console.error("Error refrescando equipo:", err);
            setCurrentTeam(storedTeam);
          }
        }
      }
      setLoadingInitial(false);
    };
    loadSession();
  }, []);

  const fetchUserTeams = async (userId) => {
    try {
      const response = await fetch(`/api/index.php?action=mis_equipos&id_jugador=${userId}`);
      const data = await response.json();
      if (data.success && data.equipos.length > 0) {
        setUserTeams(data.equipos);
        const storedTeamStr = localStorage.getItem("equipo_actual_furbo");
        let teamToSelect = data.equipos[0];
        if (storedTeamStr) {
          const storedTeam = JSON.parse(storedTeamStr);
          const found = data.equipos.find(t => t.id === storedTeam.id);
          if (found) teamToSelect = { ...found, mi_rol: storedTeam.mi_rol ?? found.mi_rol ?? null };
        }
        if (!currentTeam || currentTeam.id !== teamToSelect.id) {
          handleTeamChange(teamToSelect);
        } else if (!currentTeam.mi_rol && teamToSelect.mi_rol) {
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
    await fetchUserTeams(userData.id);
    setCurrentView("inicio");
  };

  // --- CORREGIDO: refrescar equipo al instante ---
  const handleTeamChange = async (team) => {
    if (!team) return;
    // Busca el mi_rol correcto en userTeams si no está en el objeto
    const getRole = (base) => {
      if (base.mi_rol) return base.mi_rol;
      const found = userTeams.find(t => t.id === base.id);
      return found?.mi_rol ?? null;
    };
    const withRole = (base) => ({ ...base, mi_rol: getRole(base) });
    try {
      const resp = await fetch(`/api/index.php?action=get_equipo&id=${team.id}`);
      const raw = await resp.json();
      if (raw.success && raw.equipo) {
        const enriched = withRole(raw.equipo);
        setCurrentTeam(enriched);
        localStorage.setItem("equipo_actual_furbo", JSON.stringify(enriched));
      } else {
        const fallback = withRole(team);
        setCurrentTeam(fallback);
        localStorage.setItem("equipo_actual_furbo", JSON.stringify(fallback));
      }
    } catch (err) {
      console.error("Error refrescando equipo:", err);
      const fallback = withRole(team);
      setCurrentTeam(fallback);
      localStorage.setItem("equipo_actual_furbo", JSON.stringify(fallback));
    }
  };

  const handleLogout = () => {
    deregisterPushToken();
    setUser(null); setCurrentTeam(null); setUserTeams([]);
    localStorage.removeItem("usuario_furbo"); localStorage.removeItem("equipo_actual_furbo");
    setCurrentView("login");
    document.documentElement.style.removeProperty('--primary-color');
    document.documentElement.style.removeProperty('--primary-rgb');
    document.documentElement.style.removeProperty('--contrast-text-color');
    document.documentElement.style.removeProperty('--bg-light');
  };

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
            <Route path="/mi-club/solicitudes" element={<ManagerSolicitudes user={user} currentTeam={currentTeam} isBgLight={isBgLight} />} />
            <Route path="/mi-club/configurar" element={<EditarClub user={user} currentTeam={currentTeam} onTeamUpdate={handleTeamChange} />} />
            <Route path="/crear-jugador" element={<CreateJugador />} />
            <Route path="/plantilla" element={<Plantilla user={user} currentTeam={currentTeam} />} />
            <Route path="/partidos" element={<PartidosDashboard user={user} currentTeam={currentTeam} />} />
            <Route path="/ranking" element={<Ranking user={user} currentTeam={currentTeam} />} />
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

import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Sidebar from "./components/Sidebar.jsx";
import Inicio from "./pages/Inicio";
import BuscarEquipos from "./pages/BuscarEquipos";
import ManagerSolicitudes from "./pages/ManagerSolicitudes";
import EditarClub from "./pages/EditarClub";
import CreateJugador from "./pages/CreateJugador.jsx";
import Plantilla from "./pages/Plantilla.jsx";

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
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isBgLight, setIsBgLight] = useState(false);

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

  // --- CARGA INICIAL DE SESIÓN ---
  useEffect(() => {
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
              setCurrentTeam(raw.equipo);
              localStorage.setItem("equipo_actual_furbo", JSON.stringify(raw.equipo));
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
          if (found) teamToSelect = found;
        }
        if (!currentTeam || currentTeam.id !== teamToSelect.id) {
          handleTeamChange(teamToSelect);
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
    try {
      const resp = await fetch(`/api/index.php?action=get_equipo&id=${team.id}`);
      const raw = await resp.json();
      if (raw.success) {
        setCurrentTeam(raw.equipo);
        localStorage.setItem("equipo_actual_furbo", JSON.stringify(raw.equipo));
      } else {
        setCurrentTeam(team);
        localStorage.setItem("equipo_actual_furbo", JSON.stringify(team));
      }
    } catch (err) {
      console.error("Error refrescando equipo:", err);
      setCurrentTeam(team);
      localStorage.setItem("equipo_actual_furbo", JSON.stringify(team));
    }
  };

  const handleLogout = () => {
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
        ) : (
          <Register switchToLogin={() => setCurrentView("login")} />
        )}
      </div>
    );
  }

  return (
    <Router>
      <div className="app-container d-flex">
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
            <Route path="*" element={<Navigate to="/inicio" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;

// src/App.jsx
import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// --- IMPORTS DE PÁGINAS Y COMPONENTES ---
import Login from "./pages/Login";
import Register from "./pages/Register";
// Importamos el Sidebar desde su carpeta correcta
import Sidebar from "./components/Sidebar.jsx";
import Inicio from "./pages/Inicio";
import BuscarEquipos from "./pages/BuscarEquipos";
import ManagerSolicitudes from "./pages/ManagerSolicitudes";
import EditarClub from "./pages/EditarClub";

// --- FUNCIÓN 1: Convertir HEX a RGB para el CSS ---
const hexToRgb = (hex) => {
  if (!hex) return "33, 37, 41";
  hex = hex.replace("#", "");
  if (hex.length === 3)
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  let bigint = parseInt(hex, 16);
  let r = (bigint >> 16) & 255;
  let g = (bigint >> 8) & 255;
  let b = bigint & 255;
  return `${r}, ${g}, ${b}`;
};

// --- FUNCIÓN 2: ¿Es el fondo claro? ---
const isBackgroundLight = (hexcolor) => {
  if (!hexcolor) return false; // Por defecto oscuro
  hexcolor = hexcolor.replace("#", "");
  if (hexcolor.length === 3)
    hexcolor =
      hexcolor[0] +
      hexcolor[0] +
      hexcolor[1] +
      hexcolor[1] +
      hexcolor[2] +
      hexcolor[2];
  var r = parseInt(hexcolor.substr(0, 2), 16);
  var g = parseInt(hexcolor.substr(2, 2), 16);
  var b = parseInt(hexcolor.substr(4, 2), 16);
  // Fórmula YIQ. Si es >= 128, es claro.
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
};
// -----------------------------------------------------------

function App() {
  const [user, setUser] = useState(null);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [currentView, setCurrentView] = useState("login");
  const [loadingInitial, setLoadingInitial] = useState(true);

  // ESTADO IMPRESCINDIBLE PARA EL SIDEBAR DE CONTRASTE
  const [isBgLight, setIsBgLight] = useState(false);

  // --- EFFECT: CALCULAR COLORES Y CONTRASTE ---
  useEffect(() => {
    const root = document.documentElement;
    const defaultColor = "#212529";
    const colorHex = currentTeam?.color_principal || defaultColor;

    const colorRgb = hexToRgb(colorHex);

    // 1. Calculamos si es claro
    const isLight = isBackgroundLight(colorHex);
    // 2. Guardamos el resultado en el estado
    setIsBgLight(isLight);

    console.log(
      "Equipo:",
      currentTeam?.nombre,
      "| Color:",
      colorHex,
      "| ¿Fondo Claro?:",
      isLight
    );

    // Inyectamos variables CSS globales para el resto de la app
    root.style.setProperty("--primary-color", colorHex);
    root.style.setProperty("--primary-rgb", colorRgb);

    // Variable global de contraste por si se usa en otros sitios fuera del sidebar
    root.style.setProperty(
      "--contrast-text-color",
      isLight ? "#212529" : "#ffffff"
    );
  }, [currentTeam]);

  // --- CARGA INICIAL ---
  useEffect(() => {
    const loadSession = async () => {
      const storedUserStr = localStorage.getItem("usuario_furbo");
      const storedTeamStr = localStorage.getItem("equipo_actual_furbo");
      if (storedUserStr) {
        const userData = JSON.parse(storedUserStr);
        setUser(userData);
        try {
          await fetchUserTeams(userData.id);
        } catch (e) {
          console.error(e);
        }
        if (storedTeamStr) {
          setCurrentTeam(JSON.parse(storedTeamStr));
        }
      }
      setLoadingInitial(false);
    };
    loadSession();
  }, []);

  // --- FUNCIONES AUXILIARES ---
  const fetchUserTeams = async (userId) => {
    try {
      const response = await fetch(
        `/api/index.php?action=mis_equipos&id_jugador=${userId}`
      );
      const data = await response.json();
      if (data.success && data.equipos.length > 0) {
        setUserTeams(data.equipos);
        const storedTeamStr = localStorage.getItem("equipo_actual_furbo");
        let teamToSelect = data.equipos[0];
        if (storedTeamStr) {
          const storedTeam = JSON.parse(storedTeamStr);
          // Verificar que el equipo guardado sigue perteneciendo al usuario
          const found = data.equipos.find((t) => t.id === storedTeam.id);
          if (found) teamToSelect = found;
        }
        // Si no hay equipo seleccionado o el guardado no es válido, forzamos el cambio
        if (!currentTeam || currentTeam.id !== teamToSelect.id) {
          handleTeamChange(teamToSelect);
        }
      } else {
        setUserTeams([]);
        setCurrentTeam(null);
        localStorage.removeItem("equipo_actual_furbo");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- MANEJADORES ---
  const handleLoginSuccess = async (userData) => {
    setUser(userData);
    localStorage.setItem("usuario_furbo", JSON.stringify(userData));
    await fetchUserTeams(userData.id);
    setCurrentView("inicio");
  };

  const handleTeamChange = (team) => {
    if (!team) return;
    setCurrentTeam(team);
    localStorage.setItem("equipo_actual_furbo", JSON.stringify(team));
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentTeam(null);
    setUserTeams([]);
    localStorage.removeItem("usuario_furbo");
    localStorage.removeItem("equipo_actual_furbo");
    setCurrentView("login");
    document.documentElement.style.removeProperty("--primary-color");
  };

  // --- RENDERIZADO ---
  if (loadingInitial)
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-dark text-white">
        Cargando...
      </div>
    );

  if (!user) {
    return (
      <div className="App auth-mode">
        {currentView === "login" ? (
          <Login
            onLoginSuccess={handleLoginSuccess}
            switchToRegister={() => setCurrentView("register")}
          />
        ) : (
          <Register switchToLogin={() => setCurrentView("login")} />
        )}
      </div>
    );
  }

  return (
    <Router>
      <div className="d-flex" style={{ minHeight: "100vh" }}>
        <Sidebar
          user={user}
          currentTeam={currentTeam}
          userTeams={userTeams}
          isBgLight={isBgLight} // <-- PROP VITAL PARA EL CONTRASTE DEL SIDEBAR
          onTeamChange={handleTeamChange}
          onLogout={handleLogout}
        />
        <div className="flex-grow-1 p-4 app-main-content">
          <Routes>
            <Route
              path="/"
              element={
                <Inicio
                  user={user}
                  team={currentTeam}
                  onLogout={handleLogout}
                />
              }
            />
            <Route
              path="/inicio"
              element={
                <Inicio
                  user={user}
                  team={currentTeam}
                  onLogout={handleLogout}
                />
              }
            />
            {/* --- NUEVAS RUTAS --- */}
            <Route
              path="/buscar-equipos"
              element={
                <BuscarEquipos
                  user={user}
                  userTeams={userTeams}
                  isBgLight={isBgLight}
                />
              }
            />{" "}
            <Route
              path="/mi-club/solicitudes"
              element={
                <ManagerSolicitudes user={user} currentTeam={currentTeam} />
              }
            />
            <Route path="*" element={<Navigate to="/inicio" replace />} />
            {/* RUTA PARA EDITAR CLUB */}
            <Route
              path="/mi-club/configurar"
              element={
                <EditarClub
                  user={user}
                  currentTeam={currentTeam}
                  onTeamUpdate={handleTeamChange} // <-- Reutilizamos esta función para actualizar el estado global
                />
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;

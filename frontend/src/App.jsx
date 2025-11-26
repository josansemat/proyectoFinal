import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// --- Importación de Componentes de Autenticación ---
import Login from "./pages/Login";
import Register from "./pages/Register";

// --- Importación de Componentes de Navegación y Páginas ---
// import Sidebar from "./components/Sidebar.jsx";

// Nota: Asegúrate de que estos archivos existan en tu proyecto
// import Miembros from "./pages/Miembros";
// import Instrumentos from "./pages/Instrumentos";
// import Sastreria from "./pages/Sastreria";
// import Partituras from "./pages/Partituras";
// import Contabilidad from "./pages/Contabilidad";

// Subpáginas de Eventos
// import Ensayos from "./pages/Eventos/Ensayos";
// import Actuaciones from "./pages/Eventos/Actuaciones";
// import AbsentismoEnsayos from "./pages/Eventos/AbsentismoEnsayos";
// import AbsentismoActuaciones from "./pages/Eventos/AbsentismoActuaciones";

function App() {
  // 1. ESTADO DE AUTENTICACIÓN
  const [user, setUser] = useState(null); 
  const [currentView, setCurrentView] = useState('login'); 

  // Verificar sesión al cargar
  useEffect(() => {
    const storedUser = localStorage.getItem('usuario_furbo');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Manejar Login
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('usuario_furbo', JSON.stringify(userData));
  };

  // Manejar Logout (Pasaremos esta función al Sidebar si quieres el botón ahí)
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('usuario_furbo');
    setCurrentView('login');
  };

  // ---------------------------------------------------------------------------
  // CASO 1: USUARIO NO LOGUEADO (Mostrar Login o Registro)
  // ---------------------------------------------------------------------------
  if (!user) {
    return (
      <div className="App auth-mode">
        {currentView === 'login' ? (
          <Login 
            onLoginSuccess={handleLoginSuccess} 
            switchToRegister={() => setCurrentView('register')} 
          />
        ) : (
          <Register 
            switchToLogin={() => setCurrentView('login')} 
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // CASO 2: USUARIO LOGUEADO (Mostrar Estructura con Sidebar y Rutas)
  // ---------------------------------------------------------------------------
  return (
    <Router>
      <div className="d-flex" style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Pasamos el usuario y la función logout al Sidebar 
            por si quieres mostrar el nombre o el botón de salir ahí 
        */}
        {/* <Sidebar user={user} onLogout={handleLogout} /> */}

        {/* Contenido principal dinámico */}
        <div className="content flex-grow-1 p-4" style={{ flexGrow: 1, padding: '20px' }}>
            <div className="header-bar" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                <h3>Hola, {user.nombre}</h3>
                <button onClick={handleLogout} className="btn-logout">Cerrar Sesión</button>
            </div>

          <Routes>
            {/* Ruta por defecto: Panel Principal */}
            <Route path="/" element={<h2>Panel Principal de Gestión</h2>} />
            
            {/* Rutas de Gestión */}
            {/* <Route path="/miembros" element={<Miembros />} />
            <Route path="/instrumentos" element={<Instrumentos />} />
            <Route path="/sastreria" element={<Sastreria />} />
            <Route path="/partituras" element={<Partituras />} />
            <Route path="/contabilidad" element={<Contabilidad />} /> */}

            {/* Rutas de Eventos */}
            {/* <Route path="/eventos/ensayos" element={<Ensayos />} />
            <Route path="/ensayos/absentismo" element={<AbsentismoEnsayos />} />
            <Route path="/eventos/actuaciones" element={<Actuaciones />} />
            <Route path="/actuaciones/absentismo" element={<AbsentismoActuaciones />} /> */}
            
            {/* Ruta comodín: si no encuentra nada, redirige al inicio */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
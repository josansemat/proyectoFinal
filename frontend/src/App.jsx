// App.jsx
import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Sidebar from "./components/Sidebar.jsx";
import Inicio from "./pages/Inicio";

function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState("login");

  useEffect(() => {
    const storedUser = localStorage.getItem("usuario_furbo");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem("usuario_furbo", JSON.stringify(userData));
    setCurrentView("inicio");
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("usuario_furbo");
    setCurrentView("login");
  };

  // NO logueado
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

  // Logueado: sidebar + rutas
  return (
    <Router>
      <div className="d-flex" style={{ minHeight: "100vh" }}>
        {/* Sidebar a la izquierda */}
        <Sidebar user={user} onLogout={handleLogout} />

        {/* Contenido a la derecha */}
        <div className="flex-grow-1 p-4">
          {/* si quieres mantener también tu botón que funciona: */}
          {/* <button onClick={handleLogout} className="btn-logout">Cerrar Sesión</button> */}

          <Routes>
            <Route path="/" element={<Inicio user={user} onLogout={handleLogout} />} />
            <Route path="/inicio" element={<Inicio user={user} onLogout={handleLogout} />} />
            <Route path="*" element={<Navigate to="/inicio" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;

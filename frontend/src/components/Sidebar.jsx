// src/components/Sidebar.jsx
import { useState } from "react";
import "./Sidebar.css";
import SvgSprite from "./SvgSprite";

const Sidebar = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);

  // --- LÓGICA DE rolS (La clave de todo) ---
  // 1. Usamos user?.rol para evitar errores si 'user' aún no ha cargado (es null).
  // 2. Comprobamos si el rol coincide con los permitidos.
  const canEditClub = user?.rol === 'admin' || user?.rol === 'manager';

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);

  const handleNav = (path) => {
    console.log("Ir a:", path);
    closeSidebar();
  };

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;

  return (
    <>
      <SvgSprite />
      {/* Botones móviles y overlay (IGUAL) */}
      <button type="button" className="btn btn-danger position-fixed top-0 start-0 m-3 d-md-none z-3" onClick={toggleSidebar}>{isOpen ? "✕" : "☰"}</button>
      {isOpen && <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-md-none" style={{ zIndex: 2 }} onClick={closeSidebar} />}

      {/* Sidebar */}
      <aside
        className="sidebar d-flex flex-column"
        style={{ width: "260px", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 3, transform: isDesktop || isOpen ? "translateX(0)" : "translateX(-100%)" }}
      >
        {/* Cabecera */}
        <div className="d-flex align-items-center p-3 border-bottom border-sidebar gap-2">
            <div className="rounded-circle bg-danger d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: "40px", height: "40px", fontWeight: "bold", fontSize: "1.2rem" }}>FC</div>
            <div className="overflow-hidden">
              <div className="text-uppercase small text-sidebar-muted text-truncate">Panel de equipo</div>
              <div className="fw-bold text-truncate">{user?.nombre || "Mi Club"}</div>
               {/* Opcional: Mostrar el rol para que veas que funciona */}
               {user?.rol && <div className="small text-sidebar-muted text-capitalize" style={{fontSize: '0.75rem'}}>{user.rol}</div>}
            </div>
        </div>

        {/* Navegación Principal */}
        <nav className="flex-grow-1 overflow-auto p-2 custom-scrollbar d-flex flex-column">
          <ul className="nav flex-column gap-1 flex-grow-1">
            {/* Enlaces visibles para TODOS */}
            <li className="nav-item"><button type="button" className="btn w-100 nav-link px-2 d-flex align-items-center gap-3" onClick={() => handleNav("/plantilla")}><svg className="sidebar-nav-icon"><use href="#icon-pitch"></use></svg><span>Plantilla</span></button></li>
            <li className="nav-item"><button type="button" className="btn w-100 nav-link px-2 d-flex align-items-center gap-3" onClick={() => handleNav("/partidos")}><svg className="sidebar-nav-icon"><use href="#icon-goal"></use></svg><span>Partidos</span></button></li>
            <li className="nav-item"><button type="button" className="btn w-100 nav-link px-2 d-flex align-items-center gap-3" onClick={() => handleNav("/ranking")}><svg className="sidebar-nav-icon"><use href="#icon-trophy"></use></svg><span>Ranking</span></button></li>

            {/* --- SECCIÓN CONDICIONAL DE ADMINISTRACIÓN --- */}
            {/* Si canEditClub es verdadero, se renderiza este bloque */}
            {canEditClub && (
              <>
                {/* Separador visual y título pequeño */}
                <li className="nav-item mt-4 mb-2 px-2 text-uppercase small text-sidebar-muted fw-bold" style={{ letterSpacing: '1px', fontSize: '0.7rem' }}>
                  Administración
                </li>
                {/* El botón de editar club */}
                <li className="nav-item">
                  <button
                    type="button"
                    // Reutilizamos las mismas clases para que se vea igual que los otros
                    className="btn w-100 nav-link px-2 d-flex align-items-center gap-3"
                    onClick={() => handleNav("/editar-club")}
                  >
                    {/* Usamos el nuevo icono de settings */}
                    <svg className="sidebar-nav-icon">
                      <use href="#icon-settings"></use>
                    </svg>
                    <span>Editar Club</span>
                  </button>
                </li>
              </>
            )}
          </ul>

          {/* Zona inferior (Perfil) */}
          <div className="mt-auto pt-3 px-1">
            <ul className="nav flex-column border-top border-sidebar pt-2">
               <li className="nav-item">
                  <button type="button" className="btn nav-link px-2 nav-link-profile" onClick={() => handleNav("/mi-perfil")}>
                    <svg className="sidebar-nav-icon"><use href="#icon-user"></use></svg>
                    <div><div className="fw-semibold">Mi perfil</div><div className="small text-sidebar-muted text-start">Ajustes de cuenta</div></div>
                  </button>
                </li>
            </ul>
          </div>
        </nav>

        {/* Sección Cerrar Sesión */}
        <div className="p-2 border-top border-sidebar logout-section">
          <button type="button" className="btn w-100 text-start px-2 d-flex align-items-center gap-3 btn-logout-sidebar nav-link" onClick={onLogout}>
            <svg className="sidebar-nav-icon"><use href="#icon-logout"></use></svg><span className="fw-semibold">Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <div className="d-none d-md-block" style={{ width: "260px" }} />
    </>
  );
};

export default Sidebar;
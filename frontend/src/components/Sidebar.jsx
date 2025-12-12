// src/components/Sidebar.jsx
import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // Importamos useLocation
import "../css/components/Sidebar.css";
import SvgSprite from "./SvgSprite";

const NAV_ITEMS = [
  { path: "/", icon: "#icon-home", label: "Inicio" },
  { path: "/plantilla", icon: "#icon-pitch", label: "Plantilla" },
  { path: "/partidos", icon: "#icon-goal", label: "Partidos" },
  { path: "/ranking", icon: "#icon-trophy", label: "Ranking" },
  { path: "/bus", icon: "#icon-bus", label: "Bus" },
];

const Sidebar = ({
  user,
  currentTeam,
  userTeams,
  isBgLight,
  onTeamChange,
  onLogout,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const navigate = useNavigate();
  const location = useLocation(); // Hook para saber la ruta actual

  const roleGlobal = user?.rol;
  const isAdmin = roleGlobal === "admin";
  const isManagerCurrentTeam = currentTeam?.mi_rol === "manager";
  const canManageTeam = isAdmin || isManagerCurrentTeam;
  const hasMultipleTeams = userTeams && userTeams.length > 1;

  // —— HELPER PARA DETECTAR RUTA ACTIVA —— //
  // Retorna true si la ruta actual coincide con el path del botón
  const isActive = (path) => location.pathname === path;

  // —— MEMOIZACIONES —— //
  const currentTeamInitial = useMemo(
    () => (currentTeam?.nombre ? currentTeam.nombre[0].toUpperCase() : "?"),
    [currentTeam]
  );

  const currentTeamName = currentTeam?.nombre || "Sin Equipo";

  const sectionHeaderStyle = useMemo(
    () => ({
      letterSpacing: "1px",
      fontSize: "0.7rem",
      color: "var(--sidebar-text)", // Asegúrate que esta variable exista o usa var(--sidebar-text-muted)
      opacity: 0.7
    }),
    []
  );

  // —— EVENTOS —— //
  const toggleSidebar = () => setIsOpen((prev) => !prev);
  const closeSidebar = () => setIsOpen(false);

  const handleNav = (path) => {
    navigate(path);
    closeSidebar();
  };

  const toggleTeamDropdown = () => {
    if (hasMultipleTeams) setIsTeamDropdownOpen((prev) => !prev);
  };

  const handleSelectTeamNav = () => {
    // Mostrar una acción explícita en el menú para abrir el selector.
    // Si solo hay 0/1 equipos, no tiene sentido abrir el dropdown.
    if (!hasMultipleTeams) {
      return;
    }
    setIsTeamDropdownOpen(true);
  };

  const handleSelectTeam = (team) => {
    onTeamChange(team);
    setIsTeamDropdownOpen(false);
    closeSidebar();
  };

  const handleLogoutClick = () => {
    try {
      onLogout();
    } catch (e) {
      console.error(e);
    }
    navigate("/");
  };

  // —— CERRAR DROPDOWN AL CLICK FUERA —— //
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsTeamDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sidebarClassName = [
    "sidebar",
    "d-flex",
    "flex-column",
    isOpen ? "is-open" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <SvgSprite />

      {/* Botón móvil */}
      <button
        type="button"
        className="btn btn-movil position-fixed top-0 start-0 m-3 d-lg-none z-3"
        onClick={toggleSidebar}
        aria-controls="app-sidebar"
        aria-expanded={isOpen}
        aria-label="Alternar navegación"
      >
        {isOpen ? "✕" : "☰"}
      </button>

      {/* Fondo opaco móvil */}
      {isOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-lg-none"
          style={{ zIndex: 2 }}
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside id="app-sidebar" className={sidebarClassName}>
        {/* —— Selector de Equipo —— */}
        <div
          className="team-selector-container border-bottom position-relative"
          ref={dropdownRef}
          style={{ borderColor: "var(--sidebar-border-color)" }}
        >
          <button
            type="button"
            className={`d-flex align-items-center p-3 w-100 text-start btn-team-selector ${
              hasMultipleTeams ? "interactive" : ""
            }`}
            onClick={toggleTeamDropdown}
            disabled={!hasMultipleTeams}
          >
            <div className="team-shield shadow-sm">{currentTeamInitial}</div>

            <div className="overflow-hidden ms-2 flex-grow-1">
              <div className="fw-bold text-truncate d-flex align-items-center justify-content-between">
                <span>{currentTeamName}</span>

                {hasMultipleTeams && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="currentColor"
                    className={`bi bi-chevron-down transition-transform ${
                      isTeamDropdownOpen ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 16 16"
                    style={{ opacity: 0.5 }}
                  >
                    <path
                      fillRule="evenodd"
                      d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
                    />
                  </svg>
                )}
              </div>

              <div className="small text-truncate text-sidebar-muted">
                {user?.nombre}{" "}
                {user?.rol && (
                  <span className="text-capitalize">({user.rol})</span>
                )}
              </div>
            </div>
          </button>

          {/* —— Dropdown Equipos —— */}
          {isTeamDropdownOpen && hasMultipleTeams && (
            <div className="team-dropdown-menu shadow">
              <div className="small px-3 py-2 text-uppercase fw-bold text-sidebar-muted title-drop">
                Mis Equipos
              </div>

              <ul className="list-unstyled m-0 p-1">
                {userTeams.map((team) => (
                  <li key={team.id}>
                    <button
                      type="button"
                      className={`btn w-100 text-start d-flex align-items-center gap-2 px-2 py-2 dropdown-item-custom ${
                        currentTeam?.id === team.id ? "active" : ""
                      }`}
                      onClick={() => handleSelectTeam(team)}
                    >
                      <span
                        className="rounded-circle d-inline-block"
                        style={{
                          width: "12px",
                          height: "12px",
                          backgroundColor: team.color_principal,
                        }}
                      ></span>
                      <span className="text-truncate flex-grow-1">
                        {team.nombre}
                      </span>
                      {currentTeam?.id === team.id && (
                        <span className="text-success">✓</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* —— Navegación —— */}
        <nav className="flex-grow-1 overflow-auto p-2 custom-scrollbar d-flex flex-column">
          <ul className="nav flex-column gap-1 flex-grow-1">
            {/* Seleccionar Equipo (atajo explícito) */}
            {/* <li className="nav-item">
              <button
                type="button"
                className={`btn w-100 nav-link px-2 d-flex align-items-center gap-3 ${
                  isTeamDropdownOpen ? "active" : ""
                }`}
                onClick={handleSelectTeamNav}
                disabled={!hasMultipleTeams}
                aria-disabled={!hasMultipleTeams}
                aria-label="Seleccionar equipo"
              >
                <svg className="sidebar-nav-icon">
                  <use href="#icon-shield" />
                </svg>
                <span>Seleccionar equipo</span>
              </button>
            </li> */}

            {/* Items Principales Dinámicos */}
            {NAV_ITEMS.map((item) => (
              <li key={item.path} className="nav-item">
                <button
                  type="button"
                  className={`btn w-100 nav-link px-2 d-flex align-items-center gap-3 ${
                    isActive(item.path) ? "active" : ""
                  }`}
                  onClick={() => handleNav(item.path)}
                >
                  <svg className="sidebar-nav-icon">
                    <use href={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}

            {/* Buscar Equipos */}
            <li className="nav-item">
              <button
                type="button"
                className={`btn w-100 nav-link px-2 d-flex align-items-center gap-3 ${
                  isActive("/buscar-equipos") ? "active" : ""
                }`}
                onClick={() => handleNav("/buscar-equipos")}
              >
                <svg className="sidebar-nav-icon">
                  <use href="#icon-search" />
                </svg>
                <span>Buscar Equipos</span>
              </button>
            </li>

            {/* Gestión de Mi Club */}
            {canManageTeam && (
              <>
                <li
                  className="nav-item mt-4 mb-2 px-2 text-uppercase small fw-bold"
                  style={sectionHeaderStyle}
                >
                  Gestión de Mi Club
                </li>

                <li className="nav-item">
                  <button
                    type="button"
                    className={`btn w-100 nav-link px-2 d-flex align-items-center gap-3 ${
                      isActive("/mi-club/configurar") ? "active" : ""
                    }`}
                    onClick={() => handleNav("/mi-club/configurar")}
                  >
                    <svg className="sidebar-nav-icon">
                      <use href="#icon-settings" />
                    </svg>
                    <span>Editar Mi Club</span>
                  </button>
                </li>

                <li className="nav-item">
                  <button
                    type="button"
                    className={`btn w-100 nav-link px-2 d-flex align-items-center gap-3 ${
                      isActive("/mi-club/solicitudes") ? "active" : ""
                    }`}
                    onClick={() => handleNav("/mi-club/solicitudes")}
                  >
                    <svg className="sidebar-nav-icon">
                      <use href="#icon-users" />
                    </svg>
                    <span>Solicitudes Pendientes</span>
                  </button>
                </li>
              </>
            )}

            {/* Admin Global */}
            {isAdmin && (
              <>
                <li
                  className="nav-item mt-4 mb-2 px-2 text-uppercase small fw-bold"
                  style={sectionHeaderStyle}
                >
                  Administración Global
                </li>

                <li className="nav-item">
                  <button
                    type="button"
                    className={`btn w-100 nav-link px-2 d-flex align-items-center gap-3 ${
                      isActive("/admin/jugadores") ? "active" : ""
                    }`}
                    onClick={() => handleNav("/admin/jugadores")}
                  >
                    <svg className="sidebar-nav-icon">
                      <use href="#icon-users" />
                    </svg>
                    <span>Gestión de jugadores</span>
                  </button>
                </li>

                <li className="nav-item">
                  <button
                    type="button"
                    className={`btn w-100 nav-link px-2 d-flex align-items-center gap-3 ${
                      isActive("/admin/equipos") ? "active" : ""
                    }`}
                    onClick={() => handleNav("/admin/equipos")}
                  >
                    <svg className="sidebar-nav-icon">
                      <use href="#icon-shield" />
                    </svg>
                    <span>Gestión Equipos</span>
                  </button>
                </li>
              </>
            )}

            {/* Ayuda y Legal */}
            <li
              className="nav-item mt-4 mb-2 px-2 text-uppercase small fw-bold"
              style={sectionHeaderStyle}
            >
              Ayuda & recursos
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`btn w-100 nav-link px-2 d-flex align-items-center gap-3 ${
                  isActive("/manual-uso") ? "active" : ""
                }`}
                onClick={() => handleNav("/manual-uso")}
              >
                <svg className="sidebar-nav-icon">
                  <use href="#icon-guide" />
                </svg>
                <span>Manual de uso</span>
              </button>
            </li>

            <li
              className="nav-item mt-4 mb-2 px-2 text-uppercase small fw-bold"
              style={sectionHeaderStyle}
            >
              Legal & cumplimiento
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`btn w-100 nav-link px-2 d-flex align-items-center gap-3 ${
                  isActive("/politica-privacidad") ? "active" : ""
                }`}
                onClick={() => handleNav("/politica-privacidad")}
              >
                <svg className="sidebar-nav-icon">
                  <use href="#icon-privacy" />
                </svg>
                <span>Política de privacidad</span>
              </button>
            </li>
          </ul>

          {/* —— Sección Mi Perfil —— */}
          <div className="mt-auto pt-3 px-1">
            <ul
              className="nav flex-column border-top pt-2"
              style={{ borderColor: "var(--sidebar-border-color)" }}
            >
              <li className="nav-item">
                <button
                  type="button"
                  className={`btn nav-link px-2 nav-link-profile ${
                    isActive("/mi-perfil") ? "active" : ""
                  }`}
                  onClick={() => handleNav("/mi-perfil")}
                >
                  <svg className="sidebar-nav-icon">
                    <use href="#icon-user" />
                  </svg>

                  <div>
                    <div className="fw-semibold">Mi perfil</div>
                    <div className="small text-sidebar-muted">
                      Ajustes de cuenta
                    </div>
                  </div>
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* —— Cerrar sesión —— */}
        <div
          className="p-2 border-top logout-section"
          style={{ borderColor: "var(--sidebar-border-color)" }}
        >
          <button
            type="button"
            className="btn w-100 text-start px-2 d-flex align-items-center gap-3 btn-logout-sidebar nav-link"
            onClick={handleLogoutClick}
          >
            <svg className="sidebar-nav-icon">
              <use href="#icon-logout" />
            </svg>
            <span className="fw-semibold">Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
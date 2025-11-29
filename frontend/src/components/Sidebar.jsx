// src/components/Sidebar.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Sidebar.css";
import SvgSprite from "./SvgSprite";

// RECIBIMOS LA PROP CLAVE: isBgLight
const Sidebar = ({ user, currentTeam, userTeams, isBgLight, onTeamChange, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const roleGlobal = user?.rol;
  const isAdmin = roleGlobal === "admin";
  const isManagerCurrentTeam = currentTeam?.mi_rol === 'manager';
  const canManageTeam = isAdmin || isManagerCurrentTeam;
  const hasMultipleTeams = userTeams && userTeams.length > 1;

  // --- LÓGICA DE COLOR EN LÍNEA ---
  const textColor = isBgLight ? '#212529' : '#ffffff'; 
  const mutedColor = isBgLight ? 'rgba(33, 37, 41, 0.7)' : 'rgba(255, 255, 255, 0.7)';
  const borderColor = isBgLight ? 'rgba(33, 37, 41, 0.15)' : 'rgba(255, 255, 255, 0.15)';
  const hoverBg = isBgLight ? 'rgba(33, 37, 41, 0.05)' : 'rgba(255, 255, 255, 0.1)';

  const navLinkStyle = { color: textColor };
  // --------------------------------------

  // --- MAPA DE RUTAS A ICONOS ---
  const navItems = [
    { path: '/plantilla', icon: '#icon-pitch', label: 'Plantilla' },
    { path: '/partidos', icon: '#icon-goal', label: 'Partidos' },
    { path: '/ranking', icon: '#icon-trophy', label: 'Ranking' },
    { path: '/notificaciones', icon: '#icon-bell', label: 'Notificaciones' },
  ];
  // ---------------------------------------------------------

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);
  
  // AHORA handleNav UTILIZA navigate() para cambiar la URL
  const handleNav = (path) => { 
    console.log("Navegando a:", path); // Mantenemos el log para depuración
    navigate(path); // <-- ESTO CAMBIA LA RUTA
    closeSidebar(); 
  };

  const toggleTeamDropdown = () => { if (hasMultipleTeams) setIsTeamDropdownOpen(!isTeamDropdownOpen); };
  const handleSelectTeamOption = (team) => { onTeamChange(team); setIsTeamDropdownOpen(false); closeSidebar(); };

  const navigate = useNavigate();
  const handleLogoutClick = () => {
    // Primero cerramos sesión en la app, luego navegamos a la pantalla de login
    try { onLogout(); } catch (e) { console.error(e); }
    navigate('/');
  };

  useEffect(() => {
    const handleClickOutside = (event) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsTeamDropdownOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
  const sectionHeaderStyle = { letterSpacing: "1px", fontSize: "0.7rem", color: mutedColor };

  const currentTeamInitial = currentTeam?.nombre ? currentTeam.nombre.charAt(0).toUpperCase() : "?";
  const currentTeamName = currentTeam?.nombre || "Sin Equipo";

  return (
    <>
      <SvgSprite />
      <button type="button" className="btn btn-danger position-fixed top-0 start-0 m-3 d-md-none z-3" onClick={toggleSidebar}> {isOpen ? "✕" : "☰"} </button>
      {isOpen && <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-md-none" style={{ zIndex: 2 }} onClick={closeSidebar} />}

      <aside
        className="sidebar d-flex flex-column"
        style={{ 
          width: "260px", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 3, 
          transform: isDesktop || isOpen ? "translateX(0)" : "translateX(-100%)",
          color: textColor
        }}
      >
        {/* Cabecera */}
        <div className="team-selector-container border-bottom position-relative" style={{ borderColor: borderColor }} ref={dropdownRef}>
          <button
            type="button"
            className={`d-flex align-items-center p-3 w-100 text-start btn-team-selector ${hasMultipleTeams ? "interactive" : ""}`}
            onClick={toggleTeamDropdown}
            disabled={!hasMultipleTeams}
            style={{ color: textColor }}
            onMouseEnter={(e) => { if(hasMultipleTeams) e.currentTarget.style.backgroundColor = hoverBg }}
            onMouseLeave={(e) => { if(hasMultipleTeams) e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <div className="team-shield shadow-sm" style={{ color: textColor, borderColor: borderColor }}>{currentTeamInitial}</div>
            
            <div className="overflow-hidden ms-2 flex-grow-1">
              <div className="fw-bold text-truncate d-flex align-items-center justify-content-between">
                <span>{currentTeamName}</span>
                {hasMultipleTeams && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={`bi bi-chevron-down transition-transform ${isTeamDropdownOpen ? "rotate-180" : ""}`} viewBox="0 0 16 16" style={{ opacity: 0.5 }}> <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z" /> </svg>
                )}
              </div>
              <div className="small text-truncate" style={{ color: mutedColor }}>
                {user?.nombre} {user?.rol && <span className="text-capitalize">({user.rol})</span>}
              </div>
            </div>
          </button>

          {/* Dropdown */}
          {isTeamDropdownOpen && hasMultipleTeams && (
            <div className="team-dropdown-menu shadow">
              <div className="small text-sidebar-muted px-3 py-2 text-uppercase fw-bold" style={{ fontSize: "0.65rem", letterSpacing: "0.5px" }}> Mis Equipos </div>
              <ul className="list-unstyled m-0 p-1">
                {userTeams.map((team) => (
                  <li key={team.id}>
                    <button type="button" className={`btn w-100 text-start d-flex align-items-center gap-2 px-2 py-2 dropdown-item-custom ${currentTeam?.id === team.id ? "active" : ""}`} onClick={() => handleSelectTeamOption(team)}>
                      <span className="rounded-circle d-inline-block" style={{ width: "12px", height: "12px", backgroundColor: team.color_principal }}></span>
                      <span className="text-truncate flex-grow-1"> {team.nombre} </span>
                      {currentTeam?.id === team.id && <span className="text-success">✓</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-grow-1 overflow-auto p-2 custom-scrollbar d-flex flex-column">
          <ul className="nav flex-column gap-1 flex-grow-1">
            {/* USAMOS EL NUEVO ARRAY navItems PARA GENERAR LOS ENLACES */}
            {navItems.map(item => (
                <li className="nav-item" key={item.path}>
                <button type="button" className="btn w-100 nav-link px-2 d-flex align-items-center gap-3" onClick={() => handleNav(item.path)}
                    style={navLinkStyle}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    {/* Aquí usamos el ID correcto del sprite */}
                    <svg className="sidebar-nav-icon"><use href={item.icon}></use></svg><span>{item.label}</span>
                </button>
                </li>
            ))}

            {/* Buscar Equipos */}
            <li className="nav-item">
              <button type="button" className="btn w-100 nav-link px-2 d-flex align-items-center gap-3" onClick={() => handleNav("/buscar-equipos")}
                   style={navLinkStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                <svg className="sidebar-nav-icon"><use href="#icon-search"></use></svg>
                <span>Buscar Equipos</span>
              </button>
            </li>

            {canManageTeam && (
              <>
                <li className="nav-item mt-4 mb-2 px-2 text-uppercase small fw-bold" style={sectionHeaderStyle}> Gestión de Mi Club </li>
                <li className="nav-item">
                  <button type="button" className="btn w-100 nav-link px-2 d-flex align-items-center gap-3" onClick={() => handleNav("/mi-club/configurar")}
                       style={navLinkStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <svg className="sidebar-nav-icon"><use href="#icon-settings"></use></svg><span>Editar Mi Club</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button type="button" className="btn w-100 nav-link px-2 d-flex align-items-center gap-3" onClick={() => handleNav("/mi-club/solicitudes")}
                       style={navLinkStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <svg className="sidebar-nav-icon"><use href="#icon-users"></use></svg><span>Solicitudes Pendientes</span>
                  </button>
                </li>
              </>
            )}

            {isAdmin && (
              <>
                <li className="nav-item mt-4 mb-2 px-2 text-uppercase small fw-bold" style={{...sectionHeaderStyle}}> Administración Global </li>
                <li className="nav-item">
                  <button type="button" className="btn w-100 nav-link px-2 d-flex align-items-center gap-3" onClick={() => handleNav("/admin/jugadores")}
                       style={navLinkStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <svg className="sidebar-nav-icon"><use href="#icon-users"></use></svg><span>Gestión Jugadores</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button type="button" className="btn w-100 nav-link px-2 d-flex align-items-center gap-3" onClick={() => handleNav("/admin/equipos")}
                       style={navLinkStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <svg className="sidebar-nav-icon"><use href="#icon-shield"></use></svg><span>Gestión Equipos</span>
                  </button>
                </li>
              </>
            )}
          </ul>
          
          {/* Perfil */}
          <div className="mt-auto pt-3 px-1">
            <ul className="nav flex-column border-top pt-2" style={{ borderColor: borderColor }}>
               <li className="nav-item">
                  <button type="button" className="btn nav-link px-2 nav-link-profile" onClick={() => handleNav("/mi-perfil")}
                       style={navLinkStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <svg className="sidebar-nav-icon"><use href="#icon-user"></use></svg>
                    <div><div className="fw-semibold">Mi perfil</div><div className="small text-start" style={{ color: mutedColor }}>Ajustes de cuenta</div></div>
                  </button>
                </li>
            </ul>
          </div>
        </nav>

        {/* Logout */}
        <div className="p-2 border-top logout-section" style={{ borderColor: borderColor }}>
          <button type="button" className="btn w-100 text-start px-2 d-flex align-items-center gap-3 btn-logout-sidebar nav-link" onClick={handleLogoutClick}>
            <svg className="sidebar-nav-icon"><use href="#icon-logout"></use></svg><span className="fw-semibold">Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <div className="d-none d-md-block" style={{ width: "260px" }} />
    </>
  );
};

export default Sidebar;
// src/components/SvgSprite.jsx
import React from 'react';

// Este componente define un "sprite" de iconos SVG oculto.
// TODOS los iconos usan el estilo de silueta con trazo grueso (stroke-width="1.5") para consistencia.
// viewBox es 24x24 como en tus ejemplos.
const SvgSprite = () => (
  <svg style={{ display: 'none' }}>
    <defs>
      {/* --- Plantilla (Campo) --- */}
      <symbol id="icon-pitch" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="12" y1="4" x2="12" y2="20" /><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" transform="translate(0 3)" scale="0.5"/><circle cx="12" cy="12" r="2" /><path d="M2 12h3" /><path d="M22 12h-3" /></symbol>

      {/* --- Partidos (Portería) --- */}
      <symbol id="icon-goal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v12h-16z" /><path d="M8 6v12" opacity="0.5"/><path d="M12 6v12" opacity="0.5"/><path d="M16 6v12" opacity="0.5"/><circle cx="12" cy="16" r="3" fill="currentColor" stroke="none"/></symbol>

      {/* --- Ranking (Trofeo) --- */}
      <symbol id="icon-trophy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></symbol>

      {/* --- Notificaciones (Campana - Estilo Línea) --- */}
      <symbol id="icon-bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </symbol>

      {/* --- Buscar Equipos (Lupa - Estilo Línea) --- */}
      <symbol id="icon-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </symbol>

      {/* --- Editar (Engranaje - Estilo Línea) --- */}
      <symbol id="icon-settings" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </symbol>

      {/* --- Usuarios/Solicitudes (Grupo - Estilo Línea) --- */}
      <symbol id="icon-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </symbol>

      {/* --- Equipos (Escudo - Estilo Línea) --- */}
      <symbol id="icon-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </symbol>

      {/* --- Mi Perfil (Usuario - Estilo Línea) --- */}
      <symbol id="icon-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </symbol>

      {/* --- Privacidad (Documento + Escudo) --- */}
      <symbol id="icon-privacy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M10 11h2" />
        <path d="M10 15h1" />
        <path d="M17 11.5L14.5 13v3a5.5 5.5 0 0 0 3.5 5 5.5 5.5 0 0 0 3.5-5v-3Z" />
      </symbol>

      {/* --- Manual (Libro abierto) --- */}
      <symbol id="icon-guide" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21V7a2 2 0 0 0-2-2H4v12a2 2 0 0 0 2 2Z" />
        <path d="M12 21V7a2 2 0 0 1 2-2h6v12a2 2 0 0 1-2 2Z" />
        <path d="M8 9h2" />
        <path d="M8 12h2" />
        <path d="M16 9h2" />
        <path d="M16 12h2" />
      </symbol>
      
      {/* --- Cerrar Sesión (Estilo Línea - El que pediste) --- */}
      <symbol id="icon-logout" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </symbol>
    </defs>
  </svg>
);

export default SvgSprite;
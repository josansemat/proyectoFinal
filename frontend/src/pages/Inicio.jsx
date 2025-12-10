import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../css/pages/Inicio.css";
import { buildCalendarPayload, downloadIcsFile } from "../utils/calendar";

// Iconos inline simplificados para no depender de externos
const Icons = {
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  MapPin: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Whistle: () => (
   <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <circle cx="16" cy="16" r="14"/>
  
  <path d="M16 8l-5 4v6l5 4 5-4v-6z"/>
  
  <path d="M16 8V3"/>
  <path d="M11 12l-4.5-2.5"/>
  <path d="M11 18l-4.5 2.5"/>
  <path d="M16 22v5"/>
  <path d="M21 18l4.5 2.5"/>
  <path d="M21 12l4.5-2.5"/>
</svg>
  ),
  Share: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  ),
  Bus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M3 12h18" />
      <circle cx="7.5" cy="17" r="1.25" />
      <circle cx="16.5" cy="17" r="1.25" />
      <path d="M5 7h3" />
      <path d="M16 7h3" />
    </svg>
  ),
};

export default function Inicio({ user, team: currentTeam }) {
  const [nextMatch, setNextMatch] = useState(null);
  const [myStats, setMyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !currentTeam?.id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [resPartidos, resRanking] = await Promise.all([
          fetch(`/api/index.php?action=partidos_listar&id_equipo=${currentTeam.id}&limit=1&estado=programado`),
          fetch(`/api/index.php?action=partidos_ranking_equipo&id_equipo=${currentTeam.id}&id_usuario=${user.id}&rol_global=${user.rol || "usuario"}`),
        ]);
        const dataPartidos = await resPartidos.json();
        const dataRanking = await resRanking.json();

        setNextMatch(dataPartidos.partidos?.find((p) => p.estado === "programado") || null);
        const rankingList = dataRanking.ranking || [];
        setMyStats(rankingList.find((p) => Number(p.id) === Number(user.id)) || null);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, currentTeam]);

  // Lógica Calendario simplificada (debe ejecutarse siempre para mantener el orden de hooks)
  const calendarPayload = useMemo(
    () => (nextMatch && currentTeam ? buildCalendarPayload(nextMatch, currentTeam.nombre) : null),
    [nextMatch, currentTeam]
  );

  if (!currentTeam) return <div className="empty-msg">Sin equipo seleccionado</div>;

  const handleGoogleCalendar = () => {
    if (!calendarPayload?.googleUrl) return;
    window.open(calendarPayload.googleUrl, "_blank", "noopener,noreferrer");
  };

  const handleCalendarDownload = () => {
    if (!calendarPayload?.icsContent) return;
    downloadIcsFile(calendarPayload.icsContent, calendarPayload.icsFilename);
  };

  const handleBusDirections = () => {
    navigate("/bus");
  };

  const userInitials = (user.apodo || user.nombre).substring(0, 2).toUpperCase();
  const matchDate = nextMatch ? new Date(nextMatch.fecha_hora) : null;

  return (
    <div className="compact-layout fade-in">
      {/* 1. Header Minimalista */}
      <header className="compact-header">
        <div className="user-pill">
          <div className="avatar-mini">{userInitials}</div>
          <span className="username">{user.nombre}</span>
        </div>
        <div className="team-pill" style={{borderColor: currentTeam.color_principal}}>
          {currentTeam.nombre}
        </div>
      </header>

      {/* 2. Tarjeta Principal: El Partido */}
      <section className="main-card-container">
        {loading ? (
          <div className="skeleton-card">Cargando...</div>
        ) : nextMatch ? (
          <div className="match-hero-card">
            <div className="card-top">
              <span className="match-badge">
                {nextMatch.tipo_partido === "externo" ? "OFICIAL" : "AMISTOSO"}
              </span>
              <span className={`status-dot ${nextMatch.total_inscritos >= nextMatch.max_jugadores ? "full" : ""}`}>
                {nextMatch.total_inscritos}/{nextMatch.max_jugadores} Inscritos
              </span>
            </div>
            
            <div className="card-center">
              <div className="big-time">
                {matchDate.toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="mid-date">
                {matchDate.toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div className="location-row">
                <Icons.MapPin />
                <span>{nextMatch.lugar_nombre}</span>
              </div>
            </div>

            <div className="match-meta">
              <div>
                <p className="meta-label">Duración</p>
                <p className="meta-value">{"Suelen ser " + 60} min</p>
              </div>
              <div>
                <p className="meta-label">Notas</p>
                <p className="meta-value">{"Llega 15 min antes"}</p>
              </div>
            </div>

            <div className="card-actions">
              <button type="button" className="btn-save" onClick={handleGoogleCalendar} disabled={!calendarPayload}>
                <Icons.Calendar /> Google Calendar
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleCalendarDownload}
                disabled={!calendarPayload}
              >
                <Icons.Share /> Descargar .ics
              </button>
              
            </div>
          </div>
        ) : (
          <div className="no-match-card">
            <Icons.Whistle />
            <p>No hay partidos próximos</p>
          </div>
        )}
      </section>

      {/* 3. Stats Strip (Barra horizontal de datos) */}
      <section className="stats-strip">
        <div className="stat-item">
          <span className="stat-val">{myStats ? Number(myStats.avg_rating).toFixed(1) : "-"}</span>
          <span className="stat-lbl">RATING</span>
        </div>
        <div className="stat-separator"></div>
        <div className="stat-item">
          <span className="stat-val">{myStats ? myStats.matches_completados : "0"}</span>
          <span className="stat-lbl">PARTIDOS</span>
        </div>
        <div className="stat-separator"></div>
        <div className="stat-item">
          <span className="stat-val">#{myStats ? myStats.rank : "-"}</span>
          <span className="stat-lbl">RANKING</span>
        </div>
      </section>

    </div>
  );
}
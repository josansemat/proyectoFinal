import React, { useEffect, useState } from "react";
import "./Inicio.css";

// Iconos SVG
const Icons = {
  Calendar: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  MapPin: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Chart: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Shield: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Whistle: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 1 0 5Z"/><path d="M5 14.5a2.5 2.5 0 0 1 3.5-2.26L19 18l1.5-3.5-1.5-3.5L8.5 16.74A2.5 2.5 0 0 1 5 14.5Z"/></svg>
};

const formatDate = (dateStr) => {
  if (!dateStr) return "Pendiente";
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
};

export default function Inicio({ user, team: currentTeam }) {
  const [nextMatch, setNextMatch] = useState(null);
  const [myStats, setMyStats] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !currentTeam?.id) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // Solo cargamos Partidos y Ranking (Stats)
        const [resPartidos, resRanking] = await Promise.all([
          fetch(`/api/index.php?action=partidos_listar&id_equipo=${currentTeam.id}&limit=3&estado=programado`),
          fetch(`/api/index.php?action=partidos_ranking_equipo&id_equipo=${currentTeam.id}&id_usuario=${user.id}&rol_global=${user.rol || 'usuario'}`)
        ]);

        const dataPartidos = await resPartidos.json();
        const dataRanking = await resRanking.json();

        // 1. Próximo partido
        const proximo = dataPartidos.partidos?.find(p => p.estado === 'programado') || null;
        setNextMatch(proximo);

        // 2. Stats personales
        const rankingList = dataRanking.ranking || [];
        const me = rankingList.find(p => Number(p.id) === Number(user.id));
        setMyStats(me || null);

        // 3. Stats equipo
        setTeamStats(dataRanking.stats || null);

      } catch (error) {
        console.error("Error cargando dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, currentTeam]);

  if (!currentTeam) {
    return (
      <div className="inicio-layout empty-state">
        <div className="empty-content">
          <Icons.Shield />
          <h2>¡Hola, {user?.nombre}!</h2>
          <p>Selecciona un equipo para ver tu panel.</p>
        </div>
      </div>
    );
  }

  const userInitials = (user.apodo || user.nombre || "YO").substring(0, 2).toUpperCase();

  return (
    <div className="inicio-layout fade-in">
      
      {/* HEADER */}
      <header className="dashboard-header">
        <div className="user-welcome">
          <div className="avatar-circle">{userInitials}</div>
          <div className="texts">
            <span className="subtitle">Tu Panel</span>
            <h1 className="title">{currentTeam.nombre}</h1>
          </div>
        </div>
      </header>

      {/* PRÓXIMO PARTIDO */}
      <section className="section-featured">
        <h3 className="section-title">Próximo Partido</h3>
        <div className="match-card-glass">
          {loading ? (
             <div className="loading-pulse">Buscando partido...</div>
          ) : nextMatch ? (
            <>
              <div className="match-header">
                <span className="match-type-badge">
                  {nextMatch.tipo_partido === 'externo' ? 'Oficial' : 'Interno'}
                </span>
                <span className={`status-dot ${nextMatch.total_inscritos >= nextMatch.max_jugadores ? 'full' : 'open'}`}>
                  {nextMatch.total_inscritos}/{nextMatch.max_jugadores}
                </span>
              </div>
              
              <div className="match-body">
                <div className="match-location">
                  <Icons.MapPin />
                  <span>{nextMatch.lugar_nombre}</span>
                </div>
                <div className="match-datetime">
                  <Icons.Calendar />
                  <span>{formatDate(nextMatch.fecha_hora)}</span>
                </div>
              </div>

              <div className="match-footer">
                <button className="btn-action-primary w-100">Ver Detalles</button>
              </div>
            </>
          ) : (
            <div className="no-match-state">
              <Icons.Whistle />
              <p>No hay partidos programados.</p>
            </div>
          )}
        </div>
      </section>

      {/* RENDIMIENTO (Stats) */}
      <section className="section-stats  ">
        <h3 className="section-title">Tu Rendimiento</h3>
        <div className="stats-grid-mobile">
          
          {/* Tu Rating */}
          <div className="stat-box">
            <div className="icon-wrapper blue"><Icons.Chart /></div>
            <div className="stat-number">{myStats ? Number(myStats.avg_rating).toFixed(1) : "-"}</div>
            <div className="stat-label">Rating Medio</div>
          </div>
          
          {/* Partidos Jugados */}
          <div className="stat-box">
            <div className="icon-wrapper green"><Icons.Whistle /></div>
            <div className="stat-number">{myStats ? myStats.matches_completados : "0"}</div>
            <div className="stat-label">Partidos</div>
          </div>

          {/* Ranking en el Club */}
          <div className="stat-box">
            <div className="icon-wrapper gold">
                <span className="text-icon">#</span>
            </div>
            <div className="stat-number">{myStats ? myStats.rank : "-"}</div>
            <div className="stat-label">Ranking Club</div>
          </div>

          {/* Media del Equipo */}
          <div className="stat-box team-stat">
            <div className="team-shield-mini" style={{backgroundColor: currentTeam.color_principal}}>
                {currentTeam.nombre.charAt(0)}
            </div>
            <div className="stat-number small">{teamStats ? Number(teamStats.rating_promedio_equipo).toFixed(1) : "-"}</div>
            <div className="stat-label">Media Equipo</div>
          </div>
        </div>
      </section>

    </div>
  );
}
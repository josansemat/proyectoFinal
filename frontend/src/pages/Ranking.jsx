import { useCallback, useEffect, useMemo, useState } from "react";
import "../css/pages/Ranking.css";

const formatDecimal = (value, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return Number(value).toFixed(digits);
};

const trendLabel = (trend) => {
  if (trend === null || trend === undefined) {
    return "—";
  }
  const numeric = Number(trend);
  const prefix = numeric > 0 ? "▲" : numeric < 0 ? "▼" : ""; // Usamos flechas para mejor visual
  return `${prefix} ${Math.abs(numeric).toFixed(1)}`;
};

const initialsFromName = (nombre, apodo) => {
  const source = apodo || nombre || "?";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase())
    .join("");
};

function Ranking({ user, currentTeam }) {
  const [ranking, setRanking] = useState([]);
  const [stats, setStats] = useState(null);
  const [highlights, setHighlights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rolGlobal = user?.rol_global || user?.rol || "usuario";

  const fetchRanking = useCallback(async () => {
    if (!user?.id || !currentTeam?.id) {
      setRanking([]);
      setStats(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        action: "partidos_ranking_equipo",
        id_equipo: String(currentTeam.id),
        id_usuario: String(user.id),
        rol_global: rolGlobal,
      });
      const response = await fetch(`/api/index.php?${params.toString()}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "No se pudo cargar el ranking");
      }
      setRanking(Array.isArray(data.ranking) ? data.ranking : []);
      setStats(data.stats || null);
      setHighlights(data.highlights || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, currentTeam?.id, rolGlobal]);

  useEffect(() => {
    if (user?.id && currentTeam?.id) {
      fetchRanking();
    } else {
      setRanking([]);
      setStats(null);
      setHighlights(null);
    }
  }, [user?.id, currentTeam?.id, fetchRanking]);

  const lastUpdatedLabel = useMemo(() => {
    if (!stats?.ultima_actualizacion) {
      return "Sin datos";
    }
    try {
      const date = new Date(stats.ultima_actualizacion);
      return new Intl.DateTimeFormat(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      }).format(date);
    } catch (error) {
      return stats.ultima_actualizacion;
    }
  }, [stats?.ultima_actualizacion]);

  const metricCards = useMemo(() => {
    const ratingPromedio = stats?.rating_promedio_equipo;
    const ratingPromedioLabel = ratingPromedio !== null && ratingPromedio !== undefined ? ratingPromedio.toFixed(2) : "—";
    
    return [
      { key: "avg", label: "Rating Club", value: ratingPromedioLabel },
      { key: "players", label: "Jugadores", value: stats?.jugadores_con_calificacion ?? 0 },
      { key: "matches", label: "Partidos", value: stats?.partidos_completados ?? 0 },
      { key: "mvp", label: "Total MVP", value: stats?.mvp_acumulados ?? 0 },
    ];
  }, [stats]);

  const highlightCards = useMemo(() => {
    if (!highlights) return [];
    const cards = [];
    if (highlights.top_scorer) {
      cards.push({ type: "scorer", ...highlights.top_scorer });
    }
    if (highlights.top_assistant) {
      cards.push({ type: "assistant", ...highlights.top_assistant });
    }
    if (highlights.player_of_month) {
      cards.push({ type: "month", ...highlights.player_of_month });
    }
    return cards;
  }, [highlights]);

  const positionHighlights = useMemo(() => {
    if (!highlights?.positions) return [];
    const order = ["portero", "defensa", "centrocampista", "delantero"];
    return order
      .map((tag) => highlights.positions[tag])
      .filter(Boolean);
  }, [highlights]);

  const skillSpecialists = useMemo(() => {
    if (!highlights?.skills) return [];
    const order = ["regateador", "atacante", "pasador"];
    return order
      .map((tag) => highlights.skills[tag])
      .filter(Boolean);
  }, [highlights]);

  const maxScoreRelative = ranking.length ? ranking[0].score_relative ?? 100 : 100;

  const renderHighlightCard = (card) => {
    const player = card.player;
    const name = player?.apodo || player?.nombre || "—";
    const initials = initialsFromName(player?.nombre, player?.apodo);
    return (
      <article key={card.type} className={`highlight-card highlight-card--${card.type}`}>
        <div className="highlight-card__meta">
          <span className="highlight-card__label">{card.label}</span>
          <strong className="highlight-card__value">{card.metric_value ?? "—"}</strong>
          <span className="highlight-card__metric">{card.metric_label}</span>
          {card.extra?.evaluaciones && (
            <small className="highlight-card__extra">
              {card.extra.evaluaciones} evaluaciones
            </small>
          )}
        </div>
        <div className="highlight-card__player">
          <div className="ranking-avatar ranking-avatar--highlight">{initials}</div>
          <div>
            <span className="highlight-player-name">{name}</span>
            <small className="highlight-player-role">{player?.position_tag || player?.rol}</small>
          </div>
        </div>
      </article>
    );
  };

  const renderPositionCard = (position) => {
    const player = position.player;
    const name = player?.apodo || player?.nombre || "—";
    return (
      <article key={position.tag} className="position-card">
        <header>
          <span className="position-card__label">{position.label}</span>
          <span className="position-card__metric">Score {formatDecimal(position.metric_value, 0)}</span>
        </header>
        <div className="position-card__body">
          <div className="ranking-avatar ranking-avatar--small">
            {initialsFromName(player?.nombre, player?.apodo)}
          </div>
          <div className="position-card__info">
            <span>{name}</span>
            <small>{player?.matches_completados ?? 0} PJ • ★ {formatDecimal(player?.avg_rating, 1)}</small>
          </div>
        </div>
      </article>
    );
  };

  const renderSkillCard = (skill) => {
    const player = skill.player;
    return (
      <article key={skill.tag} className="skill-card">
        <header>
          <span className="skill-card__label">{skill.label}</span>
          <span className="skill-card__metric">{skill.metric_value ?? "—"} {skill.metric_label}</span>
        </header>
        <div className="skill-card__body">
          <div className="ranking-avatar ranking-avatar--tiny">
            {initialsFromName(player?.nombre, player?.apodo)}
          </div>
          <div className="skill-card__info">
            <span>{player?.apodo || player?.nombre || "—"}</span>
            <small>{player?.position_tag || player?.rol || "Jugador"}</small>
          </div>
        </div>
      </article>
    );
  };

  const renderPlayerCard = (player, isTop = false) => {
    const percent = maxScoreRelative > 0 ? Math.round(((player.score_relative ?? 0) / maxScoreRelative) * 100) : 0;
    const trendState = player.trend_vs_avg > 0 ? "positive" : player.trend_vs_avg < 0 ? "negative" : "neutral";
    
    return (
      <article key={player.id} className={`ranking-card ${isTop ? 'ranking-card--gold' : ''}`}>
        <div className="ranking-card__left">
            <span className="ranking-card__rank">#{player.rank}</span>
            <div className="ranking-avatar">
              {initialsFromName(player.nombre, player.apodo)}
            </div>
        </div>
        
        <div className="ranking-card__center">
            <div className="ranking-card__header">
                <span className="ranking-name">{player.apodo || player.nombre}</span>
                {player.rol === "manager" && <span className="badge-manager">M</span>}
            </div>
            
            <div className="ranking-bar-container">
                 <div className="ranking-bar" style={{ width: `${percent}%` }} />
            </div>

            <div className="ranking-mini-stats">
                <span>★ {formatDecimal(player.avg_rating, 2)}</span>
                <span className="separator">•</span>
                <span>{player.matches_completados} PJ</span>
                <span className="separator">•</span>
                <span className={`trend-${trendState}`}>{trendLabel(player.trend_vs_avg)}</span>
            </div>
        </div>

        <div className="ranking-card__right">
             <div className="ranking-score-box">
                <small>SCORE</small>
                <strong>{formatDecimal(player.score, 0)}</strong>
             </div>
        </div>
      </article>
    );
  };

  if (!user) return null;
  if (!currentTeam) return <div className="ranking-empty">Selecciona un club</div>;

  const topPerformer = ranking[0];
  const restPlayers = ranking.slice(1);

  return (
    <div className="ranking-page">
      <header className="ranking-header">
        <div className="header-content">
          <div className="header-meta">
            <span>Actualizado: {lastUpdatedLabel}</span>
          </div>
        </div>
        <button className="btn-icon-refresh" onClick={fetchRanking} disabled={loading}>
            {loading ? "↻" : "⟳"}
        </button>
      </header>

      {error && <div className="ranking-alert error">{error}</div>}

      <div className="ranking-stats-grid">
        {metricCards.map((c) => (
            <div key={c.key} className="stat-item">
                <span className="stat-value">{c.value}</span>
                <span className="stat-label">{c.label}</span>
            </div>
        ))}
      </div>

      {highlightCards.length > 0 && (
        <section className="ranking-highlight-cards">
          {highlightCards.map(renderHighlightCard)}
        </section>
      )}

      {positionHighlights.length > 0 && (
        <section className="ranking-positions">
          <h2>Dominio por posición</h2>
          <div className="positions-grid">
            {positionHighlights.map(renderPositionCard)}
          </div>
        </section>
      )}

      {skillSpecialists.length > 0 && (
        <section className="ranking-skills">
          <h2>Especialistas del club</h2>
          <div className="skills-grid">
            {skillSpecialists.map(renderSkillCard)}
          </div>
        </section>
      )}

      {loading && <div className="ranking-loading">Calculando estadísticas...</div>}

      {!loading && ranking.length === 0 && !error && (
        <div className="ranking-empty">No hay datos suficientes aún.</div>
      )}

      {/* Renderizamos la lista completa, pero el primero tiene estilo especial si quieres, 
          o simplemente usamos la lista unificada para mayor elegancia y consistencia */}
      <section className="ranking-list">
        {topPerformer && renderPlayerCard(topPerformer, true)}
        {restPlayers.map((player) => renderPlayerCard(player, false))}
      </section>
    </div>
  );
}

export default Ranking;
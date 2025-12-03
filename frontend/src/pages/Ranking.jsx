import { useCallback, useEffect, useMemo, useState } from "react";
import "./Ranking.css";

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
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(1)}`;
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
    }
  }, [user?.id, currentTeam?.id, fetchRanking]);

  const lastUpdatedLabel = useMemo(() => {
    if (!stats?.ultima_actualizacion) {
      return "Sin registros";
    }
    try {
      const date = new Date(stats.ultima_actualizacion);
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    } catch (error) {
      return stats.ultima_actualizacion;
    }
  }, [stats?.ultima_actualizacion]);

  const metricCards = useMemo(() => {
    const ratingPromedio = stats?.rating_promedio_equipo;
    const ratingPromedioLabel = ratingPromedio !== null && ratingPromedio !== undefined ? ratingPromedio.toFixed(2) : "—";
    const jugadoresActivos = stats?.jugadores_activos ?? 0;
    const jugadoresConNota = stats?.jugadores_con_calificacion ?? 0;
    const partidosRegistrados = stats?.partidos_registrados ?? 0;
    const partidosCompletados = stats?.partidos_completados ?? 0;
    const evaluaciones = stats?.evaluaciones_registradas ?? 0;
    const mvpAcumulados = stats?.mvp_acumulados ?? 0;

    return [
      {
        key: "avg",
        label: "Rating medio del club",
        value: ratingPromedioLabel,
        helper: "Promedio de jugadores evaluados",
      },
      {
        key: "players-rated",
        label: "Jugadores con nota",
        value: jugadoresConNota,
        helper: `${jugadoresActivos} activos`,
      },
      {
        key: "evaluaciones",
        label: "Evaluaciones registradas",
        value: evaluaciones,
        helper: "Historial acumulado",
      },
      {
        key: "mvp",
        label: "MVP acumulados",
        value: mvpAcumulados,
        helper: "Votos oficiales",
      },
      {
        key: "partidos",
        label: "Partidos completados",
        value: partidosCompletados,
        helper: `${partidosRegistrados} registrados`,
      },
      {
        key: "actualizacion",
        label: "Última actualización",
        value: lastUpdatedLabel,
        helper: "Notas más recientes",
      },
    ];
  }, [stats, lastUpdatedLabel]);

  const maxScoreRelative = ranking.length ? ranking[0].score_relative ?? 100 : 100;

  const renderPlayerCard = (player) => {
    const percent = maxScoreRelative > 0 ? Math.round(((player.score_relative ?? 0) / maxScoreRelative) * 100) : 0;
    const trend = trendLabel(player.trend_vs_avg);
    const trendState = player.trend_vs_avg > 0 ? "positive" : player.trend_vs_avg < 0 ? "negative" : "neutral";
    const topCategory = player.category_top?.etiqueta ?? "—";

    return (
      <article key={player.id} className="ranking-card">
        <div className="ranking-card__position">#{player.rank}</div>
        <div className="ranking-card__body">
          <div className="ranking-card__identity">
            <div className="ranking-avatar">
              <span>{initialsFromName(player.nombre, player.apodo)}</span>
            </div>
            <div>
              <div className="fw-semibold text-truncate">
                {player.apodo || player.nombre}
              </div>
              <div className="ranking-chip">
                {player.rol === "manager" ? "Manager" : "Jugador"}
              </div>
            </div>
            <div className="ranking-score fw-bold">{formatDecimal(player.avg_rating)}</div>
          </div>

          <div className="ranking-bar">
            <div className="ranking-bar__fill" style={{ width: `${percent}%` }} />
          </div>

          <ul className="ranking-card__stats">
            <li>
              <span>Partidos</span>
              <strong>{player.matches_completados ?? 0}</strong>
            </li>
            <li>
              <span>Ult. 30 días</span>
              <strong>{player.matches_last30 ?? 0}</strong>
            </li>
            <li>
              <span>MVP</span>
              <strong>{player.mvp_votes ?? 0}</strong>
            </li>
          </ul>

          <div className="ranking-card__details">
            <div>
              <small>Tendencia</small>
              <span className={`ranking-trend ranking-trend--${trendState}`}>{trend}</span>
            </div>
            <div>
              <small>Última nota</small>
              <span>{formatDecimal(player.last_rating)}</span>
            </div>
            <div>
              <small>Destaca en</small>
              <span>{topCategory}</span>
            </div>
          </div>
        </div>
      </article>
    );
  };

  if (!user) {
    return null;
  }

  if (!currentTeam) {
    return (
      <div className="ranking-page container py-4">
        <div className="alert alert-info">Selecciona un club para ver su ranking.</div>
      </div>
    );
  }

  const topPerformer = ranking[0];
  const restPlayers = ranking.slice(1);

  return (
    <div className="ranking-page container py-4">
      <header className="ranking-header">
        <div>
          <p className="text-uppercase small text-muted mb-1">Ranking del club</p>
          <h1 className="h3 mb-2">{currentTeam.nombre}</h1>
          <p className="text-muted mb-0">Ordenado por desempeño y consistencia dentro del club.</p>
        </div>
        <button
          type="button"
          className="btn btn-outline-light ranking-refresh-btn"
          onClick={fetchRanking}
          disabled={loading}
        >
          {loading ? "Actualizando..." : "Refrescar"}
        </button>
      </header>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <section className="ranking-metrics">
        {metricCards.map((card) => (
          <article key={card.key} className="ranking-metric-card">
            <span className="ranking-metric-card__label">{card.label}</span>
            <strong className="ranking-metric-card__value">{card.value}</strong>
            <small className="text-muted">{card.helper}</small>
          </article>
        ))}
      </section>

      {loading && (
        <div className="text-muted small">Cargando ranking...</div>
      )}

      {!loading && ranking.length === 0 && !error && (
        <div className="alert alert-light border">Aún no hay calificaciones registradas para este club.</div>
      )}

      {topPerformer && (
        <section className="ranking-top-card">
          <div className="ranking-top-card__badge">Top performer</div>
          <div className="ranking-top-card__content">
            <div>
              <h2 className="h4 mb-1">{topPerformer.apodo || topPerformer.nombre}</h2>
              <p className="mb-1">Promedio {formatDecimal(topPerformer.avg_rating)} · {topPerformer.matches_completados ?? 0} partidos</p>
              <small className="text-muted">Mejor nota {formatDecimal(topPerformer.best_rating)} · MVP {topPerformer.mvp_votes ?? 0}</small>
            </div>
            <div className="ranking-top-card__score">
              <span>Score</span>
              <strong>{formatDecimal(topPerformer.score, 0)}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="ranking-list">
        {topPerformer && renderPlayerCard(topPerformer)}
        {restPlayers.map((player) => renderPlayerCard(player))}
      </section>
    </div>
  );
}

export default Ranking;

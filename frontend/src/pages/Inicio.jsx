import React, { useEffect, useState } from "react";
import "./Inicio.css";

const Icons = {
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  MapPin: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Chart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Shield: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Whistle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 17a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 1 0 5Z" />
      <path d="M5 14.5a2.5 2.5 0 0 1 3.5-2.26L19 18l1.5-3.5-1.5-3.5L8.5 16.74A2.5 2.5 0 0 1 5 14.5Z" />
    </svg>
  ),
  Bus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M3 12h18" />
      <circle cx="7.5" cy="17" r="1.5" />
      <circle cx="16.5" cy="17" r="1.5" />
      <path d="M5 7h3" />
      <path d="M16 7h3" />
    </svg>
  ),
};

const helperSteps = [
  {
    title: "1. Mira la tarjeta grande",
    text: "Ahí vive el partido de hoy. Lee la hora despacito y decide si vas a ir.",
  },
  {
    title: "2. Revisa tus números",
    text: "La fila de cajitas muestra tus puntos y la energía de tu equipo.",
  },
  {
    title: "3. Cuenta tus cosas",
    text: "¿Llevas botella, camiseta y sonrisa? Márcalo mentalmente antes de salir.",
  },
];

const busDirections = [
  {
    route: "Bus Arcoiris 5",
    origin: "Parada Plaza Central",
    color: "#fda4af",
    steps: [
      "Súbete en la plaza y muestra al chofer tu pase deportivo.",
      "Cuenta tres paradas mirando por la ventana para encontrar el parque grande.",
      "Bájate en 'Cancha Norte' y camina dos calles hacia las luces del estadio.",
    ],
  },
  {
    route: "Bus Verde 12",
    origin: "Mercado Viejo",
    color: "#86efac",
    steps: [
      "Sube por la puerta del medio y busca asiento cerca de la ventana.",
      "Baja cuando veas el letrero azul de 'Centro Deportivo'.",
      "Gira a la izquierda y sigue las flechas pintadas en el suelo.",
    ],
  },
  {
    route: "Micro Azul 3",
    origin: "Estación Sur",
    color: "#bfdbfe",
    steps: [
      "Pregunta al conductor si llega a la cancha y dile que vas con Furbo.",
      "Cuenta cinco minutos y pide bajar en 'Colegio Rivera'.",
      "Camina recto hasta ver la valla con el escudo del equipo.",
    ],
  },
];

const formatDate = (dateStr) => {
  if (!dateStr) return "Pendiente";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Inicio({ user, team: currentTeam }) {
  const [nextMatch, setNextMatch] = useState(null);
  const [myStats, setMyStats] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMatchDetails, setShowMatchDetails] = useState(false);

  useEffect(() => {
    if (!user || !currentTeam?.id) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [resPartidos, resRanking] = await Promise.all([
          fetch(`/api/index.php?action=partidos_listar&id_equipo=${currentTeam.id}&limit=3&estado=programado`),
          fetch(`/api/index.php?action=partidos_ranking_equipo&id_equipo=${currentTeam.id}&id_usuario=${user.id}&rol_global=${user.rol || "usuario"}`),
        ]);

        const dataPartidos = await resPartidos.json();
        const dataRanking = await resRanking.json();

        const proximo = dataPartidos.partidos?.find((p) => p.estado === "programado") || null;
        setNextMatch(proximo);
        setShowMatchDetails(false);

        const rankingList = dataRanking.ranking || [];
        const me = rankingList.find((p) => Number(p.id) === Number(user.id));
        setMyStats(me || null);

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
  const toggleMatchDetails = () => setShowMatchDetails((prev) => !prev);

  return (
    <div className="inicio-layout fade-in">
      <header className="dashboard-header kiddo">
        <div className="user-welcome">
          <div className="avatar-circle">{userInitials}</div>
          <div className="texts">
            <span className="subtitle">Hola, {user.nombre}</span>
            <h1 className="title">Bienvenido a {currentTeam.nombre}</h1>
          </div>
        </div>
        <p className="hero-subcopy">
          Lee cada tarjeta como si fuera un cuento. Primero miramos el partido, luego tus números y al final
          planificamos el viaje en bus.
        </p>
        <div className="hero-pill-row">
          <span className="hero-pill">Revisa tu botella</span>
          <span className="hero-pill">Avisa si llegas tarde</span>
          <span className="hero-pill">Lleva tu sonrisa</span>
        </div>
      </header>

      <section className="section-soft">
        <h3 className="section-title">Pasos para hoy</h3>
        <div className="helper-grid">
          {helperSteps.map((step) => (
            <article key={step.title} className="helper-card">
              <h4>{step.title}</h4>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-featured">
        <h3 className="section-title">Próximo partido</h3>
        <div className="match-card-glass">
          {loading ? (
            <div className="loading-pulse">Buscando partido...</div>
          ) : nextMatch ? (
            <>
              <div className="match-header">
                <span className="match-type-badge">
                  {nextMatch.tipo_partido === "externo" ? "Oficial" : "Interno"}
                </span>
                <span className={`status-dot ${nextMatch.total_inscritos >= nextMatch.max_jugadores ? "full" : "open"}`}>
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
                <button
                  type="button"
                  className="btn-action-primary"
                  onClick={toggleMatchDetails}
                  aria-expanded={showMatchDetails}
                >
                  {showMatchDetails ? "Ocultar detalles" : "Ver detalles"}
                </button>
              </div>

              <div className={`match-details-panel ${showMatchDetails ? "is-open" : ""}`}>
                <div className="detail-line">
                  <span className="detail-label">Participantes</span>
                  <span className="detail-value">
                    {nextMatch.total_inscritos} de {nextMatch.max_jugadores} amigos apuntados
                  </span>
                </div>
                <div className="detail-line">
                  <span className="detail-label">Formato</span>
                  <span className="detail-value">
                    {nextMatch.tipo_partido === "externo" ? "Partido oficial" : "Partido amistoso"}
                  </span>
                </div>
                <div className="detail-line">
                  <span className="detail-label">Notas del entrenador</span>
                  <p className="detail-note">
                    {nextMatch.descripcion || "Llega quince minutos antes y lleva camiseta clara."}
                  </p>
                </div>
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

      <section className="section-stats">
        <h3 className="section-title">Tu rendimiento</h3>
        <div className="stats-grid-mobile">
          <div className="stat-box">
            <div className="icon-wrapper blue">
              <Icons.Chart />
            </div>
            <div className="stat-number">{myStats ? Number(myStats.avg_rating).toFixed(1) : "-"}</div>
            <div className="stat-label">Rating medio</div>
          </div>

          <div className="stat-box">
            <div className="icon-wrapper green">
              <Icons.Whistle />
            </div>
            <div className="stat-number">{myStats ? myStats.matches_completados : "0"}</div>
            <div className="stat-label">Partidos</div>
          </div>

          <div className="stat-box">
            <div className="icon-wrapper gold">
              <span className="text-icon">#</span>
            </div>
            <div className="stat-number">{myStats ? myStats.rank : "-"}</div>
            <div className="stat-label">Ranking</div>
          </div>

          <div className="stat-box team-stat">
            <div className="team-shield-mini" style={{ backgroundColor: currentTeam.color_principal }}>
              {currentTeam.nombre.charAt(0)}
            </div>
            <div className="stat-number small">
              {teamStats ? Number(teamStats.rating_promedio_equipo).toFixed(1) : "-"}
            </div>
            <div className="stat-label">Media equipo</div>
          </div>
        </div>
      </section>

      <section className="section-bus">
        <div className="section-title">Cómo llegar en bus</div>
        <p className="bus-intro">
          Elige la ruta que te queda más cerca. Lee los pasos uno a uno y pídele a un adulto que te acompañe
          si es la primera vez.
        </p>
        <div className="bus-grid">
          {busDirections.map((bus) => (
            <article key={bus.route} className="bus-card" style={{ borderColor: bus.color }}>
              <header className="bus-card-header">
                <div className="bus-icon" style={{ backgroundColor: bus.color }}>
                  <Icons.Bus />
                </div>
                <div>
                  <p className="bus-label">{bus.route}</p>
                  <p className="bus-origin">Sale desde {bus.origin}</p>
                </div>
              </header>
              <ul className="bus-steps">
                {bus.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="bus-tip">
          Si ninguna ruta llega a tu casa, avisa en el chat del equipo para organizar coche compartido.
        </p>
      </section>
    </div>
  );
}
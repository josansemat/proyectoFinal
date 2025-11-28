// src/pages/BuscarEquipos.jsx
import React, { useState, useEffect } from "react";
import "./BuscarEquipos.css";

const BuscarEquipos = ({ user, userTeams }) => {
  const [allTeams, setAllTeams] = useState([]);
  const [pendingRequestTeamIds, setPendingRequestTeamIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ msg: "", type: "" });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Cargar todos los equipos
        const teamsResponse = await fetch(
          "/api/index.php?action=listar_equipos_todos"
        );
        const teamsData = await teamsResponse.json();
        if (teamsData.success) setAllTeams(teamsData.equipos);

        // 2. Cargar mis solicitudes pendientes
        const requestsResponse = await fetch(
          `/api/index.php?action=mis_solicitudes_ids&id_jugador=${user.id}`
        );
        const requestsData = await requestsResponse.json();
        if (requestsData.success) setPendingRequestTeamIds(requestsData.ids);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchData();
  }, [user]);

  const handleSendRequest = async (teamId) => {
    setFeedback({ msg: "Enviando...", type: "info" });
    try {
      const response = await fetch("/api/index.php?action=solicitar_unirse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_jugador: user.id, id_equipo: teamId }),
      });
      const data = await response.json();
      if (data.success) {
        setFeedback({ msg: "¡Solicitud enviada!", type: "success" });
        setPendingRequestTeamIds([...pendingRequestTeamIds, teamId]);
      } else {
        setFeedback({ msg: data.error || "Error", type: "error" });
      }
    } catch (error) {
      setFeedback({ msg: "Error de conexión", type: "error" });
    }
    setTimeout(() => setFeedback({ msg: "", type: "" }), 3000);
  };

  const getTeamButtonState = (teamId) => {
    if (userTeams.some((ut) => ut.id === teamId))
      return {
        text: "Ya eres miembro",
        disabled: true,
        style: { opacity: 0.7 },
      };
    if (pendingRequestTeamIds.includes(teamId))
      return {
        text: "Solicitud enviada",
        disabled: true,
        style: {
          opacity: 0.9,
          backgroundColor: "#ffc107",
          color: "#000",
        },
      };
    return {
      text: "Solicitar Unirse",
      disabled: false,
      onClick: () => handleSendRequest(teamId),
      style: { cursor: "pointer" },
    };
  };

  if (loading) return <div className="p-4">Cargando...</div>;

  return (
    <div className="buscar-equipos-container p-4">
      {/* Encabezado */}
      <div className="section-header mb-4 text-center">
        <h2>
          <i className="bi bi-people-fill me-2"></i> Buscar Equipos
        </h2>
        <p className="section-subtitle">
          Explora equipos activos y solicita unirte fácilmente
        </p>
        <hr />
      </div>

      {/* Feedback */}
      {feedback.msg && (
        <div
          className={`alert alert-${
            feedback.type === "success"
              ? "success"
              : feedback.type === "error"
              ? "danger"
              : "info"
          } mb-4 text-center`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Grid de equipos */}
      <div className="row">
        {allTeams.map((team) => {
          const btnState = getTeamButtonState(team.id);
          return (
            <div key={team.id} className="col-md-6 col-lg-4 mb-4">
              <div className="card team-card shadow-sm h-100">
                <div
                  className="card-header text-center"
                  style={{ backgroundColor: team.color_principal }}
                >
                  <h5 className="card-title mb-0 text-body">
                    {team.nombre}
                  </h5>
                </div>
                <div className="card-body text-center">
                  <div className="team-shield mb-3">
                    {team.nombre.charAt(0).toUpperCase()}
                  </div>
                  <button
                    className="btn w-100 fw-bold"
                    disabled={btnState.disabled}
                    onClick={btnState.onClick}
                    style={{
                      backgroundColor: team.color_principal,
                      color: btnState.style?.color || "#000000ff",
                      border: "none",
                      ...btnState.style,
                    }}
                  >
                    {btnState.text}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BuscarEquipos;

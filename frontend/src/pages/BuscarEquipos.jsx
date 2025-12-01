// src/pages/BuscarEquipos.jsx
import React, { useState, useEffect } from "react";
import "./BuscarEquipos.css";

const BuscarEquipos = ({ user, userTeams }) => {
  const [allTeams, setAllTeams] = useState([]);
  const [filteredTeams, setFilteredTeams] = useState([]);
  const [pendingRequestTeamIds, setPendingRequestTeamIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ msg: "", type: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teamsResponse = await fetch("/api/index.php?action=listar_equipos_todos");
        const teamsData = await teamsResponse.json();
        if (teamsData.success) {
          setAllTeams(teamsData.equipos);
          setFilteredTeams(teamsData.equipos);
        }
        const requestsResponse = await fetch(`/api/index.php?action=mis_solicitudes_ids&id_jugador=${user.id}`);
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

  useEffect(() => {
    const results = allTeams.filter(team =>
      team.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTeams(results);
    setCurrentPage(1);
  }, [searchTerm, allTeams]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTeams = filteredTeams.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTeams.length / itemsPerPage);

  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

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
        setFeedback({ msg: "Solicitud enviada", type: "success" });
        setPendingRequestTeamIds([...pendingRequestTeamIds, teamId]);
      } else {
        setFeedback({ msg: data.error || "Error", type: "error" });
      }
    } catch {
      setFeedback({ msg: "Error de conexión", type: "error" });
    }
    setTimeout(() => setFeedback({ msg: "", type: "" }), 3000);
  };

  const getTeamButtonState = (teamId) => {
    if (userTeams.some((ut) => ut.id === teamId))
      return { text: "Ya eres miembro", disabled: true };
    if (pendingRequestTeamIds.includes(teamId))
      return { text: "Solicitud enviada", disabled: true };
    return { text: "Solicitar Unirse", disabled: false, onClick: () => handleSendRequest(teamId) };
  };

  if (loading) return <div className="text-contrast">Cargando equipos...</div>;

  return (
    <div className="buscar-equipos-container">
      {/* Encabezado minimalista */}
      <div className="buscar-equipos-header-card">
        <h2>Mercado de Fichajes</h2>
        <p>Explora clubes activos y encuentra tu próximo equipo.</p>
      </div>

      {/* Feedback */}
      {feedback.msg && (
        <div className={`alert alert-${feedback.type}`}>{feedback.msg}</div>
      )}

      {/* Barra de búsqueda */}
      <div className="search-bar-container">
        <input
          type="text"
          className="form-control"
          placeholder="Buscar equipo por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="btn-clear" onClick={() => setSearchTerm("")}>×</button>
        )}
        <div className="muted small">
          Mostrando {filteredTeams.length} {filteredTeams.length === 1 ? "equipo" : "equipos"}
          {searchTerm && ` para "${searchTerm}"`}
        </div>
      </div>

      {/* Grid de equipos */}
      {currentTeams.length > 0 ? (
        <>
          <div className="teams-grid">
            {currentTeams.map((team) => {
              const btnState = getTeamButtonState(team.id);
              return (
                <div key={team.id} className="team-card">
                  <div className="card-accent-bar" style={{ background: team.color_principal || "var(--contrast-text-color)" }}></div>
                  <div className="card-body">
                    <div className="team-shield">{team.nombre.charAt(0).toUpperCase()}</div>
                    <h4>{team.nombre}</h4>
                    <button
                      className="btn-pro"
                      disabled={btnState.disabled}
                      onClick={btnState.onClick}
                      style={{ background: team.color_principal || "var(--contrast-text-color)" }}
                    >
                      {btnState.text}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="pagination-container">
              <button className="btn-pagination" onClick={goToPrevPage} disabled={currentPage === 1}>
                ‹
              </button>
              <span className="text-contrast">Página {currentPage} de {totalPages}</span>
              <button className="btn-pagination" onClick={goToNextPage} disabled={currentPage === totalPages}>
                ›
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-contrast text-center py-5">
          <p>No se encontraron equipos que coincidan con tu búsqueda.</p>
        </div>
      )}
    </div>
  );
};

export default BuscarEquipos;

import React, { useState, useEffect } from "react";
import "../css/pages/BuscarEquipos.css";

// Iconos SVG simples para no depender de librerías externas
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const ChevronLeft = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
);
const ChevronRight = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
);

const BuscarEquipos = ({ user, userTeams }) => {
  const [allTeams, setAllTeams] = useState([]);
  const [filteredTeams, setFilteredTeams] = useState([]);
  const [pendingRequestTeamIds, setPendingRequestTeamIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ msg: "", type: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // Subido a 6 para mejor grid

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teamsResponse = await fetch("/api/index.php?action=listar_equipos_todos");
        const teamsData = await teamsResponse.json();
        if (teamsData.success) {
          setAllTeams(teamsData.equipos);
          setFilteredTeams(teamsData.equipos);
        }
        // Validación segura de user
        if (user?.id) {
          const requestsResponse = await fetch(`/api/index.php?action=mis_solicitudes_ids&id_jugador=${user.id}`);
          const requestsData = await requestsResponse.json();
          if (requestsData.success) setPendingRequestTeamIds(requestsData.ids);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
    if (!user) return;
    setFeedback({ msg: "Enviando solicitud...", type: "info" });
    try {
      const response = await fetch("/api/index.php?action=solicitar_unirse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_jugador: user.id, id_equipo: teamId }),
      });
      const data = await response.json();
      if (data.success) {
        setFeedback({ msg: "¡Solicitud enviada con éxito!", type: "success" });
        setPendingRequestTeamIds([...pendingRequestTeamIds, teamId]);
      } else {
        setFeedback({ msg: data.error || "Error al enviar", type: "error" });
      }
    } catch {
      setFeedback({ msg: "Error de conexión", type: "error" });
    }
    setTimeout(() => setFeedback({ msg: "", type: "" }), 3000);
  };

  const getTeamButtonState = (teamId) => {
    const isMember = userTeams?.some((ut) => String(ut.id) === String(teamId));
    if (isMember) return { text: "Miembro", disabled: true, style: "member" };
    
    if (pendingRequestTeamIds.includes(teamId) || pendingRequestTeamIds.includes(String(teamId)))
      return { text: "Pendiente", disabled: true, style: "pending" };
      
    return { text: "Solicitar Acceso", disabled: false, style: "action", onClick: () => handleSendRequest(teamId) };
  };

  if (loading) return <div className="loader-container"><div className="spinner"></div></div>;

  return (
    <div className="market-page">
      <header className="market-header">
        <h1>Mercado de Fichajes</h1>
        <p>Encuentra tu próximo club y compite.</p>
      </header>

      <div className="market-controls">
        <div className="search-wrapper">
          <span className="search-icon"><SearchIcon /></span>
          <input
            type="text"
            placeholder="Buscar equipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="btn-clear" onClick={() => setSearchTerm("")}>✕</button>
          )}
        </div>
      </div>

      {feedback.msg && (
        <div className={`toast-message toast-${feedback.type}`}>
          {feedback.msg}
        </div>
      )}

      {currentTeams.length > 0 ? (
        <>
          <div className="teams-grid">
            {currentTeams.map((team) => {
              const btnState = getTeamButtonState(team.id);
              // Usamos el color del equipo o un fallback elegante
              const teamColor = team.color_principal || "#3b82f6"; 
              
              return (
                <article key={team.id} className="team-card">
                  <div className="team-card__content">
                    <div 
                      className="team-shield" 
                      style={{ 
                        background: `linear-gradient(135deg, ${teamColor}, #1e293b)`,
                        boxShadow: `0 8px 16px -4px ${teamColor}40`
                      }}
                    >
                      {team.nombre.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="team-name">{team.nombre}</h3>
                    <div className="team-meta">Club Oficial</div>
                  </div>

                  <div className="team-card__footer">
                    <button
                      className={`btn-action btn-${btnState.style}`}
                      disabled={btnState.disabled}
                      onClick={btnState.onClick}
                      style={btnState.style === 'action' ? { '--btn-color': teamColor } : {}}
                    >
                      {btnState.text}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn-page" onClick={goToPrevPage} disabled={currentPage === 1}>
                <ChevronLeft />
              </button>
              <span className="page-info">
                {currentPage} <span className="text-muted">/ {totalPages}</span>
              </span>
              <button className="btn-page" onClick={goToNextPage} disabled={currentPage === totalPages}>
                <ChevronRight />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>No se encontraron equipos para "{searchTerm}"</p>
        </div>
      )}
    </div>
  );
};

export default BuscarEquipos;
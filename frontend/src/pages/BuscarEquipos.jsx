// src/pages/BuscarEquipos.jsx
import React, { useState, useEffect } from "react";
import "./BuscarEquipos.css";

const BuscarEquipos = ({ user, userTeams }) => {
  // Estados para datos
  const [allTeams, setAllTeams] = useState([]); // Todos los equipos cargados
  const [filteredTeams, setFilteredTeams] = useState([]); // Equipos después del filtro
  const [pendingRequestTeamIds, setPendingRequestTeamIds] = useState([]);
  
  // Estados para UI y UX
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ msg: "", type: "" });
  const [searchTerm, setSearchTerm] = useState(""); // Término de búsqueda
  
  // Estados para Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Cantidad de equipos por página

  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Cargar todos los equipos
        const teamsResponse = await fetch(
          "/api/index.php?action=listar_equipos_todos"
        );
        const teamsData = await teamsResponse.json();
        if (teamsData.success) {
            setAllTeams(teamsData.equipos);
            setFilteredTeams(teamsData.equipos); // Inicialmente, los filtrados son todos
        }

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

  // Efecto para filtrar equipos cuando cambia el término de búsqueda
  useEffect(() => {
    const results = allTeams.filter(team =>
      team.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTeams(results);
    setCurrentPage(1); // Resetear a la primera página al filtrar
  }, [searchTerm, allTeams]);

  // --- Lógica de Paginación ---
  // Calcular índices para la página actual
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  // Obtener los equipos para la página actual
  const currentTeams = filteredTeams.slice(indexOfFirstItem, indexOfLastItem);
  // Calcular número total de páginas
  const totalPages = Math.ceil(filteredTeams.length / itemsPerPage);

  // Funciones para cambiar de página
  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));


  // --- Lógica de Solicitudes (igual que antes) ---
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
      return { text: "Ya eres miembro", disabled: true, style: { opacity: 0.7 } };
    if (pendingRequestTeamIds.includes(teamId))
      return { text: "Solicitud enviada", disabled: true, style: { opacity: 0.9, backgroundColor: "#ffc107", color: "#000" } };
    return { text: "Solicitar Unirse", disabled: false, onClick: () => handleSendRequest(teamId), style: { cursor: "pointer" } };
  };

  if (loading) return <div className="p-4 text-white">Cargando equipos...</div>;

  return (
    <div className="buscar-equipos-container">
      
      {/* Encabezado tipo tarjeta Pro */}
      <div className="container my-4">
        <div className="buscar-equipos-header-card shadow-lg p-1 p-md-1 text-center">
          <div className="header-icon mb-3">
              {/* Usamos el icono de billetes/dinero como pediste */}
              <i className="bi bi-cash-stack display-4 text-accent"></i>
          </div>
          <h2 className="display-5 fw-bold text-white text-uppercase ls-1 mb-3">Mercado de Fichajes</h2>
          <p className="lead text-white-50 fs-5 mb-0 mx-auto" style={{ maxWidth: '700px' }}>Explora clubes activos, analiza sus perfiles y encuentra tu próximo equipo.</p>
        </div>
      </div>

      <div className="container pb-5">
        {/* Feedback */}
        {feedback.msg && (
          <div className={`alert alert-${feedback.type === "success" ? "success" : feedback.type === "error" ? "danger" : "info"} mb-4 text-center shadow-sm border-0`}>
            {feedback.msg}
          </div>
        )}

        {/* Barra de Búsqueda y Filtro */}
        <div className="search-bar-container mb-4 shadow-sm">
            <div className="input-group input-group-lg">
                <span className="input-group-text bg-dark border-0 text-white-50 ps-4">
                    <i className="bi bi-search"></i>
                </span>
                <input 
                    type="text" 
                    className="form-control bg-dark border-0 text-white py-3" 
                    placeholder="Buscar equipo por nombre..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button className="btn btn-dark border-0 pe-4 text-white-50" type="button" onClick={() => setSearchTerm('')}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                )}
            </div>
            {/* Contador de resultados */}
            <div className="text-white-50 mt-2 ms-2 small">
                Mostrando {filteredTeams.length} {filteredTeams.length === 1 ? 'equipo' : 'equipos'}
                {searchTerm && ` para "${searchTerm}"`}
            </div>
        </div>

        {/* Grid de equipos Paginado */}
        {currentTeams.length > 0 ? (
            <>
                <div className="row g-4">
                    {currentTeams.map((team) => {
                    const btnState = getTeamButtonState(team.id);
                    return (
                        <div key={team.id} className="col-md-6 col-lg-4">
                        <div className="card team-card h-100 border-0 shadow-lg" style={{'--team-color': team.color_principal || '#ffffff'}}>
                            <div className="card-accent-bar"></div>
                            <div className="card-body text-center p-4 d-flex flex-column">
                            <div className="team-shield-container mb-4">
                                <div className="team-shield-glow"></div>
                                <div className="team-shield fw-bolder display-6">{team.nombre.charAt(0).toUpperCase()}</div>
                            </div>
                            <h4 className="card-title fw-bold text-uppercase mb-3 text-white ls-1">{team.nombre}</h4>
                            <div className="mt-auto w-100">
                                <button className={`btn w-100 btn-pro fw-bold py-3 text-uppercase ls-1`} disabled={btnState.disabled} onClick={btnState.onClick} style={{'--btn-team-color': team.color_principal || '#ffffff', ...btnState.style}}>
                                {btnState.text}
                                </button>
                            </div>
                            </div>
                        </div>
                        </div>
                    );
                    })}
                </div>

                {/* Controles de Paginación */}
                {/* Controles de Paginación */}
        {totalPages > 1 && (
            <div className="pagination-container d-flex justify-content-around align-items-center mt-5 pt-3 border-top border-secondary">
                <button 
                    // Clase 'btn-outline-light' de Bootstrap para borde blanco y texto blanco
                    className="btn btn-pagination" 
                    onClick={goToPrevPage} 
                    disabled={currentPage === 1}
                >
                    <i className="bi bi-chevron-left me-2"></i> 
                </button>
                
                {/* Texto de la página en blanco y negrita */}
                <span className="text-white fw-bold text-pepe">
                    Página {currentPage} de {totalPages}
                </span>
                
                <button 
                    // Clase 'btn-outline-light' de Bootstrap para borde blanco y texto blanco
                    className="btn btn-pagination" 
                    onClick={goToNextPage} 
                    disabled={currentPage === totalPages}
                >
                     <i className="bi bi-chevron-right ms-2"></i>
                </button>
            </div>
        )}
            </>
        ) : (
            // Mensaje cuando no hay resultados
            <div className="text-center text-dark py-5">
                <i className="bi bi-emoji-frown display-1 mb-3 d-block"></i>
                <p className="fs-4">No se encontraron equipos que coincidan con tu búsqueda.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default BuscarEquipos;
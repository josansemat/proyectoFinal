// src/pages/BuscarEquipos.jsx
import React, { useState, useEffect } from 'react';

const BuscarEquipos = ({ user, userTeams }) => {
  const [allTeams, setAllTeams] = useState([]);
  const [pendingRequestTeamIds, setPendingRequestTeamIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ msg: '', type: '' });

  useEffect(() => {
    const fetchData = async () => {
        try {
            // 1. Cargar todos los equipos (NECESITAS ESTE ENDPOINT)
            const teamsResponse = await fetch('/api/index.php?action=listar_equipos_todos');
            const teamsData = await teamsResponse.json();
            if(teamsData.success) setAllTeams(teamsData.equipos);

            // 2. Cargar mis solicitudes pendientes
            const requestsResponse = await fetch(`/api/index.php?action=mis_solicitudes_ids&id_jugador=${user.id}`);
            const requestsData = await requestsResponse.json();
            if(requestsData.success) setPendingRequestTeamIds(requestsData.ids);

        } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    if(user) fetchData();
  }, [user]);

  const handleSendRequest = async (teamId) => {
      setFeedback({ msg: 'Enviando...', type: 'info' });
      try {
          const response = await fetch('/api/index.php?action=solicitar_unirse', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id_jugador: user.id, id_equipo: teamId })
          });
          const data = await response.json();
          if (data.success) {
              setFeedback({ msg: '¡Solicitud enviada!', type: 'success' });
              setPendingRequestTeamIds([...pendingRequestTeamIds, teamId]);
          } else {
              setFeedback({ msg: data.error || 'Error', type: 'error' });
          }
      } catch (error) { setFeedback({ msg: 'Error de conexión', type: 'error' }); }
      setTimeout(() => setFeedback({ msg: '', type: '' }), 3000);
  };

  const getTeamButtonState = (teamId) => {
      if (userTeams.some(ut => ut.id === teamId)) return { text: 'Ya eres miembro', disabled: true, style: {opacity: 0.7} };
      if (pendingRequestTeamIds.includes(teamId)) return { text: 'Solicitud enviada', disabled: true, style: {opacity: 0.7, backgroundColor: '#ffc107', color: '#000'} };
      return { text: 'Solicitar Unirse', disabled: false, onClick: () => handleSendRequest(teamId), style: {cursor: 'pointer'} };
  };

  if (loading) return <div className="p-4">Cargando...</div>;

  return (
    <div className="p-4">
      <h2 className="mb-4">Buscar Equipos</h2>
      {feedback.msg && <div className={`alert alert-${feedback.type === 'success' ? 'success' : (feedback.type === 'error' ? 'danger' : 'info')} mb-4`}>{feedback.msg}</div>}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem'}}>
        {allTeams.map(team => {
            const btnState = getTeamButtonState(team.id);
            return (
                <div key={team.id} className="p-3 rounded shadow-sm border" style={{borderColor: team.color_principal, backgroundColor: 'var(--primary-color)', color: 'var(--contrast-text-color)'}}>
                    <div className="d-flex align-items-center gap-3 mb-3">
                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm team-shield"> 
                            {team.nombre.charAt(0).toUpperCase()}
                        </div>
                        <h4 className="m-0 text-truncate">{team.nombre}</h4>
                    </div>
                    <button className="btn w-100 fw-bold" disabled={btnState.disabled} onClick={btnState.onClick}
                        style={{ backgroundColor: team.color_principal, color: btnState.style?.color || '#fff', border: 'none', ...btnState.style }}>
                        {btnState.text}
                    </button>
                </div>
            )
        })}
      </div>
    </div>
  );
};
export default BuscarEquipos;
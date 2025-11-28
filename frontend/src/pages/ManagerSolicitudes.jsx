// src/pages/ManagerSolicitudes.jsx
import React, { useState, useEffect } from 'react';

const ManagerSolicitudes = ({ user, currentTeam }) => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  // Verificar permisos basados en el rol del equipo actual
  const isManager = currentTeam?.mi_rol === 'manager';
  const isAdminGlobal = user?.rol === 'admin';

  useEffect(() => {
    if (currentTeam?.id && (isManager || isAdminGlobal)) {
        fetchSolicitudes();
    } else {
        setLoading(false);
    }
  }, [currentTeam, isManager, isAdminGlobal]);

  const fetchSolicitudes = async () => {
      setLoading(true);
      try {
          const response = await fetch(`/api/index.php?action=ver_solicitudes_equipo&id_equipo=${currentTeam.id}`);
          const data = await response.json();
          if (data.success) setSolicitudes(data.solicitudes);
      } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleResponse = async (idSolicitud, estado) => {
      setProcessingId(idSolicitud);
      try {
          const response = await fetch('/api/index.php?action=responder_solicitud', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id_solicitud, estado, id_equipo_manager: currentTeam.id })
          });
          const data = await response.json();
          if (data.success) fetchSolicitudes();
          else alert(data.error);
      } catch (error) { console.error(error); } finally { setProcessingId(null); }
  };

  if (!currentTeam) return <div className="p-4">Selecciona un equipo.</div>;
  if (!isManager && !isAdminGlobal) return <div className="p-4 text-danger">No tienes permisos de manager en este equipo.</div>;
  if (loading) return <div className="p-4">Cargando...</div>;

  return (
    <div className="p-4 container" style={{maxWidth: '800px'}}>
      <h2 className="mb-4">Solicitudes Pendientes para {currentTeam.nombre}</h2>
      {solicitudes.length === 0 ? (
          <div className="alert alert-info" style={{backgroundColor: 'rgba(var(--contrast-text-color-rgb), 0.1)', color: 'inherit', borderColor: 'rgba(var(--contrast-text-color-rgb), 0.2)'}}>No hay solicitudes pendientes.</div>
      ) : (
          <div className="list-group shadow">
              {solicitudes.map(sol => (
                  <div key={sol.id} className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded" 
                       style={{backgroundColor: 'rgba(var(--contrast-text-color-rgb), 0.05)', color: 'inherit', borderColor: 'rgba(var(--contrast-text-color-rgb), 0.1)'}}>
                      <div>
                          <h5 className="mb-1">{sol.nombre_jugador} {sol.apodo && <small>({sol.apodo})</small>}</h5>
                          <small style={{opacity: 0.7}}>Solicitado el: {new Date(sol.fecha_solicitud).toLocaleDateString()}</small>
                      </div>
                      <div className="d-flex gap-2">
                          <button className="btn btn-success btn-sm" onClick={() => handleResponse(sol.id, 'aceptada')} disabled={processingId === sol.id}>
                              {processingId === sol.id ? '...' : '✅ Aceptar'}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleResponse(sol.id, 'rechazada')} disabled={processingId === sol.id}>
                              {processingId === sol.id ? '...' : '❌ Rechazar'}
                          </button>
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};
export default ManagerSolicitudes;
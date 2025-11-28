// src/pages/ManagerSolicitudes.jsx
import React, { useState, useEffect } from "react";
import "./ManagerSolicitudes.css";

const ManagerSolicitudes = ({ user, currentTeam }) => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const isManager = currentTeam?.mi_rol === "manager";
  const isAdminGlobal = user?.rol === "admin";

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
      const response = await fetch(
        `/api/index.php?action=ver_solicitudes_equipo&id_equipo=${currentTeam.id}`
      );
      const data = await response.json();
      if (data.success) setSolicitudes(data.solicitudes);
      else setSolicitudes([]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (idSolicitud, estado) => {
    setProcessingId(idSolicitud);
    try {
      const response = await fetch(
        "/api/index.php?action=responder_solicitud",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_solicitud: idSolicitud,
            estado,
            id_equipo_manager: currentTeam.id,
          }),
        }
      );
      const data = await response.json();
      if (data.success) fetchSolicitudes();
      else alert(data.error);
    } catch (error) {
      console.error(error);
    } finally {
      setProcessingId(null);
    }
  };

  if (!currentTeam) return <div className="p-4">Selecciona un equipo.</div>;
  if (!isManager && !isAdminGlobal)
    return (
      <div className="p-4 text-danger">
        No tienes permisos de manager en este equipo.
      </div>
    );
  if (loading) return <div className="p-4">Cargando...</div>;

  return (
    <div className="manager-solicitudes-container p-4">
      {/* Título de sección */}
      <div className="section-header mb-4">
        <h2 className="section-title">
          <i className="bi bi-journal-text me-2"></i>
          Gestión de Solicitudes
        </h2>
        <p className="section-subtitle">
          Revisa y responde las solicitudes pendientes para{" "}
          <strong>{currentTeam.nombre}</strong>
        </p>
        <hr />
      </div>

      {solicitudes.length === 0 ? (
        <div className="alert alert-info text-center">
          No hay solicitudes pendientes.
        </div>
      ) : (
        <div className="table-responsive shadow-sm">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>#</th>
                <th>Jugador</th>
                <th>Apodo</th>
                <th>Fecha Solicitud</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((sol, index) => (
                <tr key={sol.id}>
                  <td>{index + 1}</td>
                  <td>{sol.nombre_jugador}</td>
                  <td>{sol.apodo || "-"}</td>
                  <td>{new Date(sol.fecha_solicitud).toLocaleDateString()}</td>
                  <td className="text-center">
                    <button
                      className="btn btn-success btn-sm me-2"
                      onClick={() => handleResponse(sol.id, "aceptada")}
                      disabled={processingId === sol.id}
                    >
                      {processingId === sol.id ? "..." : "✅ Aceptar"}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleResponse(sol.id, "rechazada")}
                      disabled={processingId === sol.id}
                    >
                      {processingId === sol.id ? "..." : "❌ Rechazar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ManagerSolicitudes;

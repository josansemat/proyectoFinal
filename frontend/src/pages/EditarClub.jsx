// src/pages/EditarClub.jsx
import React, { useState, useEffect } from 'react';
import './EditarClub.css';

const EditarClub = ({ user, currentTeam, onTeamUpdate }) => {
  // Estado para los datos del equipo
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    color_principal: '#000000',
    fondo_imagen: '',
    // Nuevos campos para lanzadores
    id_lanzador_penalti: '',
    id_lanzador_falta_lejana: '',
    id_lanzador_corner_izq: '',
    id_lanzador_corner_der: '',
  });
  
  // Estados para listas y UI
  const [listaFondos, setListaFondos] = useState([]); 
  const [jugadores, setJugadores] = useState([]); // Lista de jugadores del equipo
  const [dorsales, setDorsales] = useState([]); // Array de objetos {id_jugador, nuevo_dorsal}
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Carga inicial de datos
  useEffect(() => {
    if (currentTeam?.id) {
        setLoading(true);
        // Usamos Promise.all para cargar todo en paralelo
        Promise.all([
            cargarDatosEquipo(),
            cargarListaFondos(),
            cargarJugadoresEquipo() // Nueva función
        ]).finally(() => setLoading(false));
    }
  }, [currentTeam]);

  // --- FUNCIONES DE CARGA ---
  const cargarListaFondos = async () => {
      try {
          const response = await fetch('/api/index.php?action=get_fondos');
          const data = await response.json();
          if (data.success) setListaFondos(data.fondos);
      } catch (error) { console.error("Error cargando fondos", error); }
  };

  const cargarDatosEquipo = async () => {
    try {
        const response = await fetch(`/api/index.php?action=get_equipo&id=${currentTeam.id}`);
        const data = await response.json();
        if (data.success) {
            const eq = data.equipo;
            setFormData(prev => ({
                ...prev,
                nombre: eq.nombre || '',
                descripcion: eq.descripcion || '',
                color_principal: eq.color_principal || '#000000',
                fondo_imagen: eq.fondo_imagen || '',
                // Mapeamos los lanzadores, asegurando que no sean null
                id_lanzador_penalti: eq.id_lanzador_penalti || '',
                id_lanzador_falta_lejana: eq.id_lanzador_falta_lejana || '',
                id_lanzador_corner_izq: eq.id_lanzador_corner_izq || '',
                id_lanzador_corner_der: eq.id_lanzador_corner_der || '',
            }));
        }
    } catch (error) { console.error("Error cargando equipo", error); }
  };

  const cargarJugadoresEquipo = async () => {
    try {
      const response = await fetch(`/api/index.php?action=jugadores_equipo&id_equipo=${currentTeam.id}`);
      const data = await response.json();
      if (data.success) {
        setJugadores(data.jugadores || []);
        // Inicializamos el estado de los dorsales con los valores actuales
        setDorsales(data.jugadores.map(j => ({
          id_jugador: j.id,
          nuevo_dorsal: j.dorsal || '' // Si es null en BD, usamos string vacío para el input
        })));
      }
    } catch (error) { console.error("Error cargando jugadores", error); }
  };

  // --- MANEJADORES DE CAMBIOS ---
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Función específica para manejar cambios en los inputs de dorsal
  const handleDorsalChange = (idJugador, nuevoValor) => {
    setDorsales(prevDorsales => 
      prevDorsales.map(d => 
        d.id_jugador === idJugador ? { ...d, nuevo_dorsal: nuevoValor } : d
      )
    );
  };

  // --- ENVÍO DEL FORMULARIO ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: 'Guardando...', type: 'info' });

    try {
        // Preparamos el objeto JSON completo a enviar
        const payload = {
            id_equipo: currentTeam.id,
            id_usuario: user.id,
            rol_global: user.rol,
            ...formData, // Todos los campos del formulario (nombre, color, lanzadores, etc.)
            dorsales: dorsales // El array con los nuevos dorsales
        };

        const response = await fetch('/api/index.php?action=update_equipo_completo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, // Importante indicar que es JSON
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            setMessage({ text: data.message, type: 'success' });
            // Notificamos al componente padre (App.jsx) para que actualice el estado global
            if (onTeamUpdate) {
                onTeamUpdate({
                    ...currentTeam,
                    nombre: data.nuevo_nombre,
                    color_principal: data.nuevo_color,
                    fondo_imagen: data.nuevo_fondo
                });
            }
        } else {
            setMessage({ text: data.error || 'Error al guardar', type: 'error' });
        }
    } catch (error) {
        setMessage({ text: 'Error de conexión al servidor', type: 'error' });
        console.error(error);
    }
  };

  if (!currentTeam) return <div className="p-4 text-white">Selecciona un equipo primero.</div>;
  if (loading) return <div className="p-4 text-white">Cargando datos...</div>;

  return (
    <div className="container py-5 editar-club-wrapper">
      {/* Banner del título */}
      <div className="club-title-banner shadow-sm" style={{backgroundColor: currentTeam.color_principal}}>
        <h2 className="text-center m-0 text-white" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.5)'}}>
          Personalizar {currentTeam.nombre}
        </h2>
      </div>
      
      {message.text && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : message.type} my-3 fw-bold`}>
            {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card club-form-card p-4 shadow-lg border-0">
        <div className="row g-4">
            
            {/* --- COLUMNA IZQUIERDA: Datos y Lanzadores --- */}
            <div className="col-lg-6 d-flex flex-column gap-4">
                
                {/* SECCIÓN 1: Datos Básicos */}
                <div className="p-3 bg-light border rounded">
                  <h4 className="mb-3 text-primary fw-bold">Información Básica</h4>
                  <div className="mb-3">
                      <label className="form-label fw-bold">Nombre del Equipo</label>
                      <input type="text" className="form-control" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre del club"/>
                  </div>

                  <div className="mb-3">
                      <label className="form-label fw-bold">Color Principal</label>
                      <div className="d-flex align-items-center gap-2">
                          <input type="color" className="form-control form-control-color p-0 border-0" name="color_principal" value={formData.color_principal} onChange={handleChange} title="Elige el color" style={{height:'38px', width:'60px'}} />
                          <input type="text" className="form-control" value={formData.color_principal} readOnly style={{maxWidth:'100px', fontFamily:'monospace'}} />
                      </div>
                  </div>

                  <div>
                      <label className="form-label fw-bold">Descripción</label>
                      <textarea className="form-control" name="descripcion" rows="3" value={formData.descripcion} onChange={handleChange} style={{resize: 'none'}}></textarea>
                  </div>
                </div>

                {/* SECCIÓN 2: Lanzadores a Balón Parado */}
                {jugadores.length > 0 && (
                  <div className="p-3 bg-light border rounded">
                    <h4 className="mb-3 text-primary fw-bold">Lanzadores</h4>
                    <div className="row g-3">
                      {/* Helper para generar las opciones del select */}
                      {(() => {
                        const options = [
                          <option key="none" value="">(Ninguno)</option>,
                          ...jugadores.map(j => (
                            <option key={j.id} value={j.id}>
                              {j.nombre}{j.apodo ? ` (${j.apodo})` : ''}
                            </option>
                          ))
                        ];
                        return (
                          <>
                            <div className="col-md-6">
                              <label className="form-label fw-bold small">Penaltis</label>
                              <select className="form-select" name="id_lanzador_penalti" value={formData.id_lanzador_penalti} onChange={handleChange}>{options}</select>
                            </div>
                            <div className="col-md-6">
                              <label className="form-label fw-bold small">Faltas Lejanas</label>
                              <select className="form-select" name="id_lanzador_falta_lejana" value={formData.id_lanzador_falta_lejana} onChange={handleChange}>{options}</select>
                            </div>
                            <div className="col-md-6">
                              <label className="form-label fw-bold small">Córners Izq.</label>
                              <select className="form-select" name="id_lanzador_corner_izq" value={formData.id_lanzador_corner_izq} onChange={handleChange}>{options}</select>
                            </div>
                            <div className="col-md-6">
                              <label className="form-label fw-bold small">Córners Der.</label>
                              <select className="form-select" name="id_lanzador_corner_der" value={formData.id_lanzador_corner_der} onChange={handleChange}>{options}</select>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
            </div>

            {/* --- COLUMNA DERECHA: Fondo y Dorsales --- */}
            <div className="col-lg-6 d-flex flex-column gap-4">
                
                {/* SECCIÓN 3: Imagen de Fondo */}
                <div className="p-3 bg-light border rounded">
                    <h4 className="mb-3 text-primary fw-bold">Imagen de Fondo</h4>
                    <select className="form-select mb-3" name="fondo_imagen" value={formData.fondo_imagen} onChange={handleChange}>
                        <option value="">-- Sin fondo / Por defecto --</option>
                        {listaFondos.map((fondo, index) => (
                            <option key={index} value={fondo}>{fondo}</option>
                        ))}
                    </select>
                    <div className="preview-container shadow-sm mx-auto bg-white" style={{height: '180px', border:'2px solid #eee'}}>
                        {formData.fondo_imagen ? (
                            <img src={`/fondos/${formData.fondo_imagen}`} alt="Vista previa" className="preview-image"
                                onError={(e) => { e.target.onerror = null; e.target.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='50'><rect width='100' height='50' fill='%23eee'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23aaa'>Error</text></svg>"; }} />
                        ) : (
                            <div className="d-flex align-items-center justify-content-center h-100 text-muted small">Sin imagen</div>
                        )}
                    </div>
                </div>

                {/* SECCIÓN 4: Gestión de Dorsales */}
                <div className="p-3 bg-light border rounded flex-grow-1 d-flex flex-column" style={{minHeight: '300px'}}>
                  <h4 className="mb-3 text-primary fw-bold">
                    Dorsales <span className="badge bg-secondary ms-2">{jugadores.length}</span>
                  </h4>
                  {jugadores.length === 0 ? (
                    <p className="text-muted fst-italic">No hay jugadores en el equipo.</p>
                  ) : (
                    <div className="flex-grow-1 overflow-auto custom-scrollbar pe-2" style={{maxHeight: '400px'}}>
                      {jugadores.map(j => {
                        const dorsalValue = dorsales.find(d => d.id_jugador === j.id)?.nuevo_dorsal || '';
                        return (
                          <div key={j.id} className="d-flex align-items-center justify-content-between p-2 mb-2 bg-white border rounded">
                            <div className="d-flex align-items-center text-truncate me-3">
                              {/* Escudo pequeño con el color del equipo */}
                              <div className="rounded-circle me-2 d-flex align-items-center justify-content-center fw-bold text-white" 
                                   style={{width:'32px', height:'32px', backgroundColor: currentTeam.color_principal, fontSize:'0.8rem', border:'2px solid white', boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>
                                {dorsalValue || '?'}
                              </div>
                              <div className="text-truncate">
                                <span className="fw-bold text-dark">{j.nombre}</span>
                                {j.apodo && <small className="text-muted ms-1">({j.apodo})</small>}
                              </div>
                            </div>
                            <input 
                              type="number" 
                              className="form-control text-center fw-bold" 
                              style={{width: '70px'}}
                              min="1" 
                              max="99" 
                              placeholder="#"
                              value={dorsalValue}
                              onChange={(e) => handleDorsalChange(j.id, e.target.value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
            </div>

            {/* Botón de guardar */}
            <div className="col-12 mt-2">
                <button type="submit" className="btn w-100 fw-bold py-3 fs-5 btn-guardar shadow text-white"
                        style={{backgroundColor: currentTeam.color_principal, borderColor: currentTeam.color_principal, transition: 'all 0.3s ease'}}>
                    <i className="bi bi-save me-2"></i> Guardar Todos los Cambios
                </button>
            </div>
        </div>
      </form>
    </div>
  );
};

export default EditarClub;
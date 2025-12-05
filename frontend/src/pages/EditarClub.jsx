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
  const [managers, setManagers] = useState({}); // Objeto {id_jugador: true/false} para el estado de manager
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
        // Inicializamos el estado de los dorsales y managers
        const initialDorsales = [];
        const initialManagers = {};
        data.jugadores.forEach(j => {
            initialDorsales.push({
                id_jugador: j.id,
                nuevo_dorsal: j.dorsal || ''
            });
            // Asumimos que la API devuelve un campo 'rol_en_equipo' ('manager' o 'jugador')
            initialManagers[j.id] = j.rol_en_equipo === 'manager';
        });
        setDorsales(initialDorsales);
        setManagers(initialManagers);
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

  // Función para manejar el checkbox de manager
  const handleManagerChange = (idJugador, isManager) => {
    setManagers(prev => ({
        ...prev,
        [idJugador]: isManager
    }));
  };

  // --- ENVÍO DEL FORMULARIO ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: 'Guardando...', type: 'info' });

    try {
        // Preparamos el array de roles para enviar
        const rolesToSend = Object.entries(managers).map(([id_jugador, is_manager]) => ({
            id_jugador: parseInt(id_jugador),
            rol: is_manager ? 'manager' : 'jugador'
        }));

        // Preparamos el objeto JSON completo a enviar
        const payload = {
            id: currentTeam.id, // Usamos 'id' para que coincida con el controlador del admin
            id_usuario: user.id,
            rol_global: user.rol,
            ...formData, // Todos los campos del formulario (nombre, color, lanzadores, etc.)
            dorsales: dorsales, // El array con los nuevos dorsales
            roles: rolesToSend // El array con los nuevos roles
        };

        // Usamos la misma acción que el administrador para unificar la lógica
        const response = await fetch('/api/index.php?action=admin_update_equipo_completo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            setMessage({ text: data.message || '¡Cambios guardados con éxito!', type: 'success' });
            // Notificamos al componente padre (App.jsx) para que actualice el estado global
            if (onTeamUpdate) {
                onTeamUpdate({
                    ...currentTeam,
                    nombre: data.nuevo_nombre || currentTeam.nombre,
                    color_principal: data.nuevo_color || currentTeam.color_principal,
                    fondo_imagen: data.nuevo_fondo || currentTeam.fondo_imagen,
                    // Si el usuario actual cambió su propio rol, esto se actualizará al recargar
                });
            }
            // Recargamos los jugadores para reflejar los cambios de rol y dorsal
            cargarJugadoresEquipo();
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
        <div className="row g-4 editar-club-grid">
            
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

            {/* --- COLUMNA DERECHA: Fondo, Dorsales y Managers --- */}
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

                {/* SECCIÓN 4: Gestión de Plantilla (Dorsales y Managers) */}
                <div className="p-3 bg-light border rounded flex-grow-1 d-flex flex-column" style={{minHeight: '300px'}}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                      <h4 className="m-0 text-primary fw-bold">Plantilla</h4>
                      <span className="badge bg-secondary">{jugadores.length} jugadores</span>
                  </div>
                  
                  {jugadores.length === 0 ? (
                    <p className="text-muted fst-italic">No hay jugadores en el equipo.</p>
                  ) : (
                    <>
                      {/* Cabecera de la tabla */}
                      <div className="roster-header d-flex px-2 mb-2 fw-bold text-muted small text-uppercase">
                          <div style={{flex: '1'}}>Jugador</div>
                          <div className="text-center" style={{width: '80px'}}>Manager</div>
                          <div className="text-center" style={{width: '80px'}}>Dorsal</div>
                      </div>
                      
                      <div className="player-list flex-grow-1 overflow-auto custom-scrollbar pe-2" style={{maxHeight: '400px'}}>
                        {jugadores.map(j => {
                          const dorsalValue = dorsales.find(d => d.id_jugador === j.id)?.nuevo_dorsal || '';
                          const isManager = managers[j.id] || false;
                          
                          return (
                            <div key={j.id} className="player-row d-flex align-items-center justify-content-between p-2 mb-2 bg-white border rounded">
                              {/* Columna Jugador */}
                              <div className="player-row__info d-flex align-items-center text-truncate" style={{flex: '1'}}>
                                {/* Escudo pequeño con el color del equipo */}
                                <div className="rounded-circle me-2 d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0" 
                                     style={{width:'32px', height:'32px', backgroundColor: currentTeam.color_principal, fontSize:'0.8rem', border:'2px solid white', boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>
                                  {dorsalValue || '?'}
                                </div>
                                <div className="text-truncate">
                                  <span className="fw-bold text-dark">{j.nombre}</span>
                                  {j.apodo && <small className="text-muted ms-1">({j.apodo})</small>}
                                </div>
                              </div>
                              
                              {/* Columna Manager (Checkbox) */}
                              <div className="player-row__manager text-center d-flex flex-column align-items-center justify-content-center" style={{width: '80px'}}>
                                <span className="player-row__label d-md-none text-muted text-uppercase small mb-1">Manager</span>
                                <div className="form-check form-switch mb-0">
                                    <input 
                                        className="form-check-input" 
                                        type="checkbox" 
                                        role="switch"
                                        checked={isManager}
                                        onChange={(e) => handleManagerChange(j.id, e.target.checked)}
                                        // Evitar que un manager se quite a sí mismo el rol si es el único (opcional, requiere lógica extra)
                                        // disabled={j.id === user.id && Object.values(managers).filter(m => m).length === 1}
                                        style={{cursor: 'pointer'}}
                                    />
                                </div>
                              </div>

                              {/* Columna Dorsal (Input) */}
                                <div className="player-row__number" style={{width: '80px'}}>
                                  <span className="player-row__label d-md-none text-muted text-uppercase small mb-1">Dorsal</span>
                                  <input 
                                    type="number" 
                                    className="form-control text-center fw-bold" 
                                    min="1" 
                                    max="99" 
                                    placeholder="#"
                                    value={dorsalValue}
                                    onChange={(e) => handleDorsalChange(j.id, e.target.value)}
                                  />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
            </div>

            {/* Botón de guardar */}
            <div className="col-12 mt-2">
                <button type="submit" className="btn w-100 fw-bold btn-guardar shadow text-white"
                      style={{backgroundColor: currentTeam.color_principal, borderColor: currentTeam.color_principal, transition: 'all 0.3s ease'}}>
                    <i className="bi bi-save me-2"></i> Guardar Cambios
                </button>
            </div>
        </div>
      </form>
    </div>
  );
};

export default EditarClub;
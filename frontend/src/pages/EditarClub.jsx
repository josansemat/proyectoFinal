import React, { useState, useEffect } from 'react';
import '../css/pages/EditarClub.css';

const EditarClub = ({ user, currentTeam, onTeamUpdate }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    color_principal: '#000000',
    fondo_imagen: '',
    id_lanzador_penalti: '',
    id_lanzador_falta_lejana: '',
    id_lanzador_corner_izq: '',
    id_lanzador_corner_der: '',
  });
  
  const [listaFondos, setListaFondos] = useState([]); 
  const [jugadores, setJugadores] = useState([]); 
  const [dorsales, setDorsales] = useState([]); 
  const [managers, setManagers] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [kickLoadingIds, setKickLoadingIds] = useState(() => new Set());
  const [kickDialog, setKickDialog] = useState(null); // { id, nombre }

  useEffect(() => {
    if (!message?.text) return;
    if (message.type === 'info') return;
    const timeout = setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    return () => clearTimeout(timeout);
  }, [message]);

  const rolGlobal = user?.rol_global ?? user?.rol ?? 'usuario';
  const isAdmin = rolGlobal === 'admin';
  const isManager = currentTeam?.mi_rol === 'manager';
  const canManage = isAdmin || isManager;

  useEffect(() => {
    if (currentTeam?.id) {
        setLoading(true);
        Promise.all([
            cargarDatosEquipo(),
            cargarListaFondos(),
            cargarJugadoresEquipo()
        ]).finally(() => setLoading(false));
    }
  }, [currentTeam]);

  const cargarListaFondos = async () => {
      try {
          const response = await fetch('/api/index.php?action=get_fondos');
          const data = await response.json();
          if (data.success) setListaFondos(data.fondos);
      } catch (error) { console.error("Error cargando fondos", error); }
  };

  const cargarDatosEquipo = async () => {
    try {
      const response = await fetch(`/api/index.php?action=get_equipo&id=${currentTeam.id}`, { cache: "no-store" });
        const data = await response.json();
        if (data.success) {
            const eq = data.equipo;
            setFormData(prev => ({
                ...prev,
                nombre: eq.nombre || '',
                descripcion: eq.descripcion || '',
                color_principal: eq.color_principal || '#000000',
                fondo_imagen: eq.fondo_imagen || '',
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
        const initialDorsales = [];
        const initialManagers = {};
        data.jugadores.forEach(j => {
            initialDorsales.push({
                id_jugador: j.id,
                nuevo_dorsal: j.dorsal || ''
            });
            initialManagers[j.id] = j.rol_en_equipo === 'manager';
        });
        setDorsales(initialDorsales);
        setManagers(initialManagers);
      }
    } catch (error) { console.error("Error cargando jugadores", error); }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDorsalChange = (idJugador, nuevoValor) => {
    setDorsales(prev => prev.map(d => d.id_jugador === idJugador ? { ...d, nuevo_dorsal: nuevoValor } : d));
  };

  const handleManagerChange = (idJugador, isManager) => {
    setManagers(prev => ({ ...prev, [idJugador]: isManager }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: 'Guardando...', type: 'info' });

    try {
        const rolesToSend = Object.entries(managers).map(([id_jugador, is_manager]) => ({
            id_jugador: parseInt(id_jugador),
            rol: is_manager ? 'manager' : 'jugador'
        }));

        const payload = {
            id: currentTeam.id, 
            id_usuario: user.id,
          rol_global: rolGlobal,
            ...formData, 
            dorsales: dorsales, 
            roles: rolesToSend 
        };

        const response = await fetch('/api/index.php?action=admin_update_equipo_completo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            setMessage({ text: data.message || '¡Cambios guardados con éxito!', type: 'success' });
            if (onTeamUpdate) {
                onTeamUpdate({
                    ...currentTeam,
                    nombre: data.nuevo_nombre || currentTeam.nombre,
                    color_principal: data.nuevo_color || currentTeam.color_principal,
                    fondo_imagen: data.nuevo_fondo || currentTeam.fondo_imagen,
                });
            }
            cargarJugadoresEquipo();
        } else {
            setMessage({ text: data.error || 'Error al guardar', type: 'error' });
        }
    } catch (error) {
        setMessage({ text: 'Error de conexión al servidor', type: 'error' });
    }
  };

  const handleKickPlayer = async (idJugador) => {
    if (!currentTeam?.id || !idJugador) return;
    if (!canManage) {
      setMessage({ text: 'No tienes permisos para sacar jugadores del equipo.', type: 'error' });
      return;
    }
    if (Number(idJugador) === Number(user?.id)) {
      setMessage({ text: 'No puedes sacarte a ti mismo desde aquí. Usa “Mi perfil → Equipos” para abandonar el equipo.', type: 'error' });
      return;
    }
    setKickDialog(null);

    setKickLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(Number(idJugador));
      return next;
    });
    setMessage({ text: 'Procesando...', type: 'info' });
    try {
      const resp = await fetch('/api/index.php?action=salir_equipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_jugador: Number(idJugador),
          id_equipo: Number(currentTeam.id),
          id_usuario: Number(user?.id),
          rol_global: rolGlobal,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setMessage({ text: 'Jugador sacado del equipo.', type: 'success' });
        await cargarJugadoresEquipo();
      } else {
        setMessage({ text: data.error || 'No se pudo sacar al jugador.', type: 'error' });
      }
    } catch (e) {
      setMessage({ text: 'Error de conexión al servidor', type: 'error' });
    } finally {
      setKickLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(Number(idJugador));
        return next;
      });
    }
  };
  
  if (!currentTeam) return <div className="editar-club-page"><div className="edt-alert info">Selecciona un equipo primero.</div></div>;
  if (!canManage) return <div className="editar-club-page"><div className="edt-alert error">No tienes permisos para editar este club.</div></div>;
  if (loading) return <div className="editar-club-page"><div className="edt-alert info">Cargando datos...</div></div>;

  return (
    <div className="editar-club-page">
      {kickDialog && (
        <div
          className="edt-modal-overlay"
          onClick={() => setKickDialog(null)}
        >
          <div
            className="edt-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edt-kick-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="edt-modal-title" id="edt-kick-title">Confirmar acción</h3>
            <p className="edt-modal-text">
              ¿Seguro que quieres sacar a <strong>{kickDialog.nombre || 'este jugador'}</strong> del club?
            </p>
            <div className="edt-modal-actions">
              <button
                type="button"
                className="edt-modal-btn edt-modal-btn--cancel"
                onClick={() => setKickDialog(null)}
                disabled={kickLoadingIds.has(Number(kickDialog.id))}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="edt-modal-btn edt-modal-btn--danger"
                onClick={() => handleKickPlayer(kickDialog.id)}
                disabled={kickLoadingIds.has(Number(kickDialog.id))}
              >
                {kickLoadingIds.has(Number(kickDialog.id)) ? 'Procesando...' : 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="edt-header">
        <h2>Personalizar {currentTeam.nombre}</h2>
      </header>
      
      {message.text && (
        <div className={`edt-alert ${message.type}`}>
            {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="edt-form">
        <div className="edt-grid">
            
            {/* --- COLUMNA IZQUIERDA: Datos y Lanzadores --- */}
            <div style={{display:'flex', flexDirection:'column', gap:'1.5rem'}}>
                
                {/* SECCIÓN 1: Datos Básicos */}
                <div className="edt-section">
                  <h3 className="edt-section-title">Información Básica</h3>
                  
                  <div className="edt-form-group">
                      <label className="edt-label">Nombre del Equipo</label>
                      <input type="text" className="edt-input" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre del club"/>
                  </div>

                  <div className="edt-form-group">
                      <label className="edt-label">Color Principal</label>
                      <div className="edt-color-wrapper">
                          <input type="color" className="edt-input-color" name="color_principal" value={formData.color_principal} onChange={handleChange} />
                          <input type="text" className="edt-input" value={formData.color_principal} readOnly style={{fontFamily:'monospace', width:'100px'}} />
                      </div>
                  </div>

                  <div className="edt-form-group">
                      <label className="edt-label">Descripción</label>
                      <textarea className="edt-textarea" name="descripcion" rows="3" value={formData.descripcion} onChange={handleChange}></textarea>
                  </div>
                </div>

                {/* SECCIÓN 2: Lanzadores */}
                {jugadores.length > 0 && (
                  <div className="edt-section">
                    <h3 className="edt-section-title">Lanzadores</h3>
                    <div className="edt-grid" style={{gap:'1rem', gridTemplateColumns:'1fr 1fr'}}>
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
                            <div className="edt-form-group">
                              <label className="edt-label">Penaltis</label>
                              <select className="edt-select" name="id_lanzador_penalti" value={formData.id_lanzador_penalti} onChange={handleChange}>{options}</select>
                            </div>
                            <div className="edt-form-group">
                              <label className="edt-label">Faltas</label>
                              <select className="edt-select" name="id_lanzador_falta_lejana" value={formData.id_lanzador_falta_lejana} onChange={handleChange}>{options}</select>
                            </div>
                            <div className="edt-form-group">
                              <label className="edt-label">Córner Izq.</label>
                              <select className="edt-select" name="id_lanzador_corner_izq" value={formData.id_lanzador_corner_izq} onChange={handleChange}>{options}</select>
                            </div>
                            <div className="edt-form-group">
                              <label className="edt-label">Córner Der.</label>
                              <select className="edt-select" name="id_lanzador_corner_der" value={formData.id_lanzador_corner_der} onChange={handleChange}>{options}</select>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
            </div>

            {/* --- COLUMNA DERECHA: Fondo y Plantilla --- */}
            <div style={{display:'flex', flexDirection:'column', gap:'1.5rem'}}>
                
                {/* SECCIÓN 3: Imagen de Fondo */}
                <div className="edt-section">
                    <h3 className="edt-section-title">Imagen de Fondo</h3>
                    <select className="edt-select" name="fondo_imagen" value={formData.fondo_imagen} onChange={handleChange}>
                        <option value="">-- Sin fondo / Por defecto --</option>
                        {listaFondos.map((fondo, index) => (
                            <option key={index} value={fondo}>{fondo}</option>
                        ))}
                    </select>
                    <div className="edt-preview-box">
                        {formData.fondo_imagen ? (
                            <img src={`/fondos/${formData.fondo_imagen}`} alt="Vista previa" className="edt-preview-img"
                                onError={(e) => { e.target.style.display='none'; }} />
                        ) : (
                            <span className="edt-preview-placeholder">Sin imagen seleccionada</span>
                        )}
                    </div>
                </div>

                {/* SECCIÓN 4: Plantilla */}
                <div className="edt-section" style={{flex:1}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
                      <h3 className="edt-section-title" style={{margin:0, border:0, padding:0}}>Plantilla</h3>
                      <span className="edt-label">{jugadores.length} Jugadores</span>
                  </div>
                  
                  {jugadores.length === 0 ? (
                    <p className="edt-preview-placeholder">No hay jugadores en el equipo.</p>
                  ) : (
                    <>
                        <div className="edt-roster-header">
                          <div style={{flex: 1}}>Jugador</div>
                          <div style={{width: '80px', textAlign:'center'}}>Manager</div>
                          <div style={{width: '60px', textAlign:'center'}}>Dorsal</div>
                          <div style={{width: '90px', textAlign:'right'}}>Acciones</div>
                        </div>
                      
                      <div className="edt-roster-list custom-scrollbar">
                        {jugadores.map(j => {
                          const dorsalValue = dorsales.find(d => d.id_jugador === j.id)?.nuevo_dorsal || '';
                          const isManager = managers[j.id] || false;
                          
                          return (
                            <div key={j.id} className="edt-player-row">
                              <div className="edt-player-info">
                                <div className="edt-player-shield" style={{backgroundColor: currentTeam.color_principal}}>
                                  {dorsalValue || '?'}
                                </div>
                                <div style={{overflow:'hidden'}}>
                                  <div className="edt-player-name">{j.nombre}</div>
                                  {j.apodo && <div className="edt-player-apodo">{j.apodo}</div>}
                                </div>
                              </div>
                              
                              <div className="edt-player-controls">
                                <div className="edt-manager-check">
                                    <span className="edt-check-label d-md-none">Manager</span>
                                    <input 
                                        className="edt-checkbox" 
                                        type="checkbox" 
                                        checked={isManager}
                                        onChange={(e) => handleManagerChange(j.id, e.target.checked)}
                                    />
                                </div>

                                <div className="edt-dorsal-wrapper">
                                  <span className="edt-dorsal-label edt-check-label d-md-none">Dorsal</span>
                                  <input 
                                    type="number" 
                                    className="edt-input-dorsal" 
                                    min="1" 
                                    max="99" 
                                    placeholder="#"
                                    value={dorsalValue}
                                    onChange={(e) => handleDorsalChange(j.id, e.target.value)}
                                  />
                                </div>

                                <div className="edt-player-actions">
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => setKickDialog({ id: j.id, nombre: j.nombre })}
                                    disabled={kickLoadingIds.has(Number(j.id))}
                                    title="Sacar jugador del club"
                                  >
                                    {kickLoadingIds.has(Number(j.id)) ? '...' : 'Sacar'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
            </div>
        </div>

        <div className="edt-footer">
            <button type="submit" className="edt-btn-save">
                Guardar Cambios
            </button>
        </div>
      </form>
    </div>
  );
};

export default EditarClub;
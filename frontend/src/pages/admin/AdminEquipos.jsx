import React, { useEffect, useMemo, useState } from "react";
import "../../css/pages/AdminEquipos.css";

function Badge({ active }) {
  const isActive = active === 1 || active === true;
  return <span className={`adm-badge ${isActive ? 'green' : 'red'}`}>{isActive ? 'Activo' : 'Inactivo'}</span>;
}

export default function AdminEquipos() {
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(""), 4500);
    return () => clearTimeout(timeout);
  }, [error]);

  // Estados para el Modal
  const [editing, setEditing] = useState(null); 
  const [isCreating, setIsCreating] = useState(false); 

  const [fondos, setFondos] = useState([]);
  const [jugadores, setJugadores] = useState([]); 
  const [managers, setManagers] = useState({}); 

  const initialFormState = {
    nombre: "",
    descripcion: "",
    color_principal: "#3b82f6", 
    fondo_imagen: "",
    id_lanzador_penalti: "",
    id_lanzador_falta_lejana: "",
    id_lanzador_corner_izq: "",
    id_lanzador_corner_der: "",
  };
  const [form, setForm] = useState(initialFormState);
  const [dorsales, setDorsales] = useState([]); 

  // --- CARGA DE DATOS ---
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (estado) p.set("estado", estado);
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [search, estado, page, limit]);

  const loadData = async (ignore = false) => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`/api/index.php?action=admin_listar_equipos&${query}`);
        const j = await r.json();
        if (!ignore) {
          if (j.success) {
            setData(j.equipos || []);
            setTotalPages(j.totalPages || 1);
          } else {
            setError(j.error || 'Error al cargar');
            setData([]);
            setTotalPages(1);
          }
        }
      } catch (e) {
        if (!ignore) { setError('Error de conexión'); }
      } finally {
        if (!ignore) setLoading(false);
      }
  };

  useEffect(() => {
    let ignore = false;
    loadData(ignore);
    return () => { ignore = true; };
  }, [query]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/index.php?action=get_fondos');
        const j = await r.json();
        if (j.success) setFondos(j.fondos || []);
      } catch {}
    })();
  }, []);

  // --- PAGINACIÓN Y ESTADO ---
  const nextPage = () => setPage(p => Math.min(p + 1, totalPages));
  const prevPage = () => setPage(p => Math.max(p - 1, 1));
  const isMobileView = () => typeof window !== "undefined" && window.innerWidth < 768;

  const toggleRowExpansion = (id) => {
    if (!isMobileView()) return;
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleToggleActivo = async (eq) => {
    try {
      const nuevoEstado = (eq.activo === 1 || eq.activo === true) ? 0 : 1;
      const r = await fetch('/api/index.php?action=admin_toggle_equipo_activo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eq.id, activo: nuevoEstado })
      });
      const j = await r.json();
      if (j.success) {
        setData(prev => prev.map(it => it.id === eq.id ? { ...it, activo: nuevoEstado } : it));
      } else {
        setError(j.error || 'No se pudo cambiar el estado');
      }
    } catch { setError('Error de conexión'); }
  };

  // --- FUNCIONES DEL MODAL ---
  const openCreate = () => {
      setEditing(null);
      setJugadores([]);
      setDorsales([]);
      setManagers({});
      setForm(initialFormState);
      setIsCreating(true);
  };

  const openEdit = async (eq) => {
    try {
      const r = await fetch(`/api/index.php?action=admin_get_equipo_detalle&id=${eq.id}`);
      const j = await r.json();
      if (!j.success) { setError(j.error || 'No se pudo cargar detalle'); return; }
      
      setEditing(j.equipo);
      setIsCreating(false);
      setJugadores(j.jugadores || []);
      
      setForm({
        nombre: j.equipo.nombre || '',
        descripcion: j.equipo.descripcion || '',
        color_principal: j.equipo.color_principal || '#3b82f6',
        fondo_imagen: j.equipo.fondo_imagen || '',
        id_lanzador_penalti: j.equipo.id_lanzador_penalti || '',
        id_lanzador_falta_lejana: j.equipo.id_lanzador_falta_lejana || '',
        id_lanzador_corner_izq: j.equipo.id_lanzador_corner_izq || '',
        id_lanzador_corner_der: j.equipo.id_lanzador_corner_der || '',
      });
      setDorsales((j.jugadores || []).map(row => ({ id_jugador: row.id, nuevo_dorsal: row.dorsal || '' })));
      const initialManagers = {};
      (j.jugadores || []).forEach(row => {
        initialManagers[row.id] = (row.rol_en_equipo || row.rol) === 'manager';
      });
      setManagers(initialManagers);
    } catch { setError('Error de conexión al cargar detalle'); }
  };

  const closeModal = () => {
      setEditing(null);
      setIsCreating(false);
      setJugadores([]);
      setManagers({});
      setError("");
  };

  const onFormChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const onDorsalChange = (idJugador, value) => {
    setDorsales(prev => prev.map(d => d.id_jugador === idJugador ? { ...d, nuevo_dorsal: value } : d));
  };

  const handleManagerChange = (idJugador, isManager) => {
    setManagers(prev => ({
      ...prev,
      [idJugador]: isManager
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    setError("");
    
    try {
      let url = '';
      let payload = {};
      const rolesPayload = (jugadores || []).map(j => ({
        id_jugador: j.id,
        rol: (managers[j.id] ? 'manager' : 'jugador')
      }));

      if (isCreating) {
          url = '/api/index.php?action=admin_crear_equipo';
          payload = {
              nombre: form.nombre,
              descripcion: form.descripcion,
              color_principal: form.color_principal,
              fondo_imagen: form.fondo_imagen
          };
      } else if (editing) {
          url = '/api/index.php?action=admin_update_equipo_completo';
          payload = { id: editing.id, ...form, dorsales, roles: rolesPayload };
      } else {
          return;
      }

      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const j = await r.json();

      if (j.success) {
        closeModal();
        if (isCreating) {
            loadData(); 
        } else {
            setData(prev => prev.map(it => it.id === editing.id ? {
              ...it,
              nombre: form.nombre,
              descripcion: form.descripcion,
              color_principal: form.color_principal,
            } : it));
        }
      } else { 
          setError(j.error || 'No se pudo guardar cambios'); 
      }
    } catch { 
        setError('Error de conexión al guardar'); 
    }
  };

  const showModal = editing !== null || isCreating === true;
  const modalTitle = isCreating ? "Nuevo Equipo" : (editing ? `Editar: ${editing.nombre}` : "");

  return (
    <div className="admin-equipos-page">
      <div className="adm-panel">
        {/* Toolbar */}
        <div className="adm-toolbar">
          <input 
            className="adm-search" 
            placeholder="Buscar equipo..." 
            value={search} 
            onChange={e=>{setPage(1);setSearch(e.target.value)}} 
          />
          <select 
            className="adm-select" 
            value={estado} 
            onChange={e=>{setPage(1);setEstado(e.target.value)}}
            aria-label="Filtrar equipos por estado"
          >
            <option value="">Estado: Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
          <button className="adm-btn-create" onClick={openCreate}>+ Nuevo Equipo</button>
        </div>

        {/* Tabla Responsive */}
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>EQUIPO</th>
                <th>DESCRIPCIÓN</th>
                <th>COLOR</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="adm-muted adm-text-center">Cargando...</td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="adm-error adm-text-center">{error}</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={6} className="adm-muted adm-text-center">Sin resultados</td></tr>
              ) : (
                data.map(eq => (
                  <React.Fragment key={eq.id}>
                    <tr>
                      <td className="adm-hide-mobile" style={{fontFamily:'monospace'}}>{eq.id}</td>
                      <td data-label="Equipo">
                        <div
                          className="adm-row-main"
                          role={isMobileView() ? "button" : undefined}
                          tabIndex={isMobileView() ? 0 : undefined}
                          aria-expanded={isMobileView() ? expandedId === eq.id : undefined}
                          aria-controls={isMobileView() ? `equipo-${eq.id}-details` : undefined}
                          onClick={() => toggleRowExpansion(eq.id)}
                          onKeyDown={(event) => {
                            if (!isMobileView()) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleRowExpansion(eq.id);
                            }
                          }}
                        >
                          <span className="adm-shield" style={{ backgroundColor: eq.color_principal }} />
                          <div style={{fontWeight:600}}>{eq.nombre}</div>
                          {/* Chevron solo visible en móvil por CSS del componente */}
                          <span className="chevron" style={{display: isMobileView() ? 'block' : 'none'}}>
                            {expandedId === eq.id ? '▼' : '▶'}
                          </span>
                        </div>
                      </td>
                      <td className="adm-muted adm-hide-mobile" title={eq.descripcion} style={{maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis'}}>
                        {eq.descripcion || '-'}
                      </td>
                      <td className="adm-hide-mobile">
                        <div style={{display:'flex', alignItems:'center'}}>
                          <span className="adm-color-swatch" style={{ backgroundColor: eq.color_principal }} />
                          <span style={{fontFamily:'monospace', fontSize:'0.85rem'}}>{eq.color_principal}</span>
                        </div>
                      </td>
                      <td className="adm-hide-mobile"><Badge active={eq.activo} /></td>
                      <td className="adm-hide-mobile">
                        <div className="adm-actions">
                          <button
                            className="adm-icon-btn"
                            title="Editar"
                            aria-label={`Editar equipo ${eq.nombre}`}
                            onClick={()=>openEdit(eq)}
                          >
                            ✎
                          </button>
                          <button 
                              className={`adm-toggle ${eq.activo == 1 ? 'on':''}`} 
                              onClick={()=>handleToggleActivo(eq)} 
                              title={eq.activo == 1 ? "Desactivar" : "Activar"} 
                              aria-label={eq.activo == 1 ? `Desactivar al equipo ${eq.nombre}` : `Activar al equipo ${eq.nombre}`}
                              aria-pressed={eq.activo == 1}
                          />
                        </div>
                      </td>
                    </tr>
                    
                    {/* Vista Expandida Móvil */}
                    {expandedId === eq.id && (
                      <tr className="adm-expanded-row" id={`equipo-${eq.id}-details`}>
                        <td colSpan={6}>
                          <div className="adm-expanded-inner">
                            <div className="adm-expanded-item">
                              <span className="adm-expanded-label">ID</span>
                              <span>{eq.id}</span>
                            </div>
                            <div className="adm-expanded-item">
                              <span className="adm-expanded-label">Descripción</span>
                              <span>{eq.descripcion || '-'}</span>
                            </div>
                            <div className="adm-expanded-item">
                              <span className="adm-expanded-label">Color</span>
                              <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                                <span className="adm-color-swatch" style={{ backgroundColor: eq.color_principal }} />
                                {eq.color_principal}
                              </div>
                            </div>
                            <div className="adm-expanded-item">
                              <span className="adm-expanded-label">Estado</span>
                              <Badge active={eq.activo} />
                            </div>
                            <div className="adm-expanded-item">
                              <span className="adm-expanded-label">Acciones</span>
                              <div className="adm-actions">
                                <button className="adm-btn save" style={{padding:'0.4rem 1rem', fontSize:'0.8rem'}} onClick={()=>openEdit(eq)}>
                                  Editar
                                </button>
                                <button className="adm-btn cancel" style={{padding:'0.4rem 1rem', fontSize:'0.8rem'}} onClick={()=>handleToggleActivo(eq)}>
                                  {eq.activo == 1 ? 'Desactivar' : 'Activar'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="adm-pagination">
            <button className="adm-icon-btn" onClick={prevPage} disabled={page===1} aria-label="Página anterior">‹</button>
            <span className="adm-page-info">Página {page} de {totalPages}</span>
            <button className="adm-icon-btn" onClick={nextPage} disabled={page===totalPages} aria-label="Página siguiente">›</button>
          </div>
        )}

        {/* MODAL */}
        {showModal && (
          <div className="adm-modal-backdrop">
            <div className="adm-modal-card">
              <div className="adm-modal-header">
                <h2>{modalTitle}</h2>
                <button className="adm-icon-btn" onClick={closeModal} aria-label="Cerrar modal">✕</button>
              </div>
              
              <form className="adm-modal-body" onSubmit={handleSubmit}>
                <div className="adm-section">
                  <h3>Información básica</h3>
                  <div className="adm-form-grid">
                    <div className="adm-form-row" style={{gridColumn:'1 / -1'}}>
                      <label>Nombre del Equipo *</label>
                      <input className="adm-input" name="nombre" value={form.nombre} onChange={onFormChange} required placeholder="Ej: Rayo Vallecano"/>
                    </div>
                    <div className="adm-form-row">
                      <label>Color principal</label>
                      <div style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
                        <input className="adm-input-color" type="color" name="color_principal" value={form.color_principal} onChange={onFormChange} />
                      </div>
                    </div>
                    <div className="adm-form-row">
                      <label>Fondo (Imagen)</label>
                      <select className="adm-input" name="fondo_imagen" value={form.fondo_imagen} onChange={onFormChange}>
                        <option value="">(Sin fondo)</option>
                        {fondos.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="adm-form-row" style={{gridColumn:'1 / -1'}}>
                      <label>Descripción</label>
                      <textarea className="adm-textarea" name="descripcion" value={form.descripcion} onChange={onFormChange} placeholder="Breve descripción..."/>
                    </div>
                  </div>
                </div>

                {!isCreating && jugadores.length > 0 && (
                  <>
                    <div className="adm-section">
                      <h3>Lanzadores</h3>
                      <div className="adm-form-grid">
                        <div className="adm-form-row">
                          <label>Penaltis</label>
                          <select className="adm-input" name="id_lanzador_penalti" value={form.id_lanzador_penalti || ''} onChange={onFormChange}>
                            <option value="">(Ninguno)</option>
                            {jugadores.map(j => <option key={j.id} value={j.id}>{j.nombre}</option>)}
                          </select>
                        </div>
                        <div className="adm-form-row">
                          <label>Faltas</label>
                          <select className="adm-input" name="id_lanzador_falta_lejana" value={form.id_lanzador_falta_lejana || ''} onChange={onFormChange}>
                            <option value="">(Ninguno)</option>
                            {jugadores.map(j => <option key={j.id} value={j.id}>{j.nombre}</option>)}
                          </select>
                        </div>
                         <div className="adm-form-row">
                          <label>Córner Izq</label>
                          <select className="adm-input" name="id_lanzador_corner_izq" value={form.id_lanzador_corner_izq || ''} onChange={onFormChange}>
                            <option value="">(Ninguno)</option>
                            {jugadores.map(j => <option key={j.id} value={j.id}>{j.nombre}</option>)}
                          </select>
                        </div>
                        <div className="adm-form-row">
                          <label>Córner Der</label>
                          <select className="adm-input" name="id_lanzador_corner_der" value={form.id_lanzador_corner_der || ''} onChange={onFormChange}>
                            <option value="">(Ninguno)</option>
                            {jugadores.map(j => <option key={j.id} value={j.id}>{j.nombre}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="adm-section">
                      <h3>Plantilla ({jugadores.length})</h3>
                      <div className="adm-roster-grid">
                        {jugadores.map(j => (
                          <div key={j.id} className="adm-roster-item">
                            <div className="adm-roster-left">
                              <span className="adm-shield small" style={{ backgroundColor: editing?.color_principal }} />
                              <div className="adm-roster-name" title={j.nombre}>{j.nombre}</div>
                            </div>
                            <div className="adm-roster-right">
                              <div style={{display:'flex', alignItems:'center', gap:'0.25rem'}}>
                                <label style={{fontSize:'0.7rem', color:'var(--adm-text-muted)'}}>MGR</label>
                                <input
                                  type="checkbox"
                                  checked={managers[j.id] || false}
                                  onChange={(e) => handleManagerChange(j.id, e.target.checked)}
                                  style={{cursor:'pointer'}}
                                />
                              </div>
                              <input 
                                className="adm-input adm-dorsal-input" 
                                type="number" 
                                min={1} max={99} 
                                placeholder="#"
                                value={(dorsales.find(d=>d.id_jugador===j.id)?.nuevo_dorsal) ?? ''}
                                onChange={e=>onDorsalChange(j.id, e.target.value)} 
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                 
                {!isCreating && jugadores.length === 0 && (
                    <div className="adm-alert">
                        Este equipo aún no tiene jugadores asignados.
                    </div>
                )}

                <div className="adm-modal-footer">
                  <button type="button" className="adm-btn cancel" onClick={closeModal}>Cancelar</button>
                  <button type="submit" className="adm-btn save">
                      {isCreating ? "Crear Equipo" : "Guardar Cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
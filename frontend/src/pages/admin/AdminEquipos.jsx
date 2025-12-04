import { useEffect, useMemo, useState } from "react";
import "./AdminEquipos.css";

function Badge({ active }) {
  // Aseguramos que active sea booleano, a veces la BD devuelve 1/0
  const isActive = active === 1 || active === true;
  return <span className={`badge ${isActive ? 'green' : 'red'}`}>{isActive ? 'Activo' : 'Inactivo'}</span>;
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

  // Estados para el Modal
  const [editing, setEditing] = useState(null); // Objeto del equipo si se edita
  const [isCreating, setIsCreating] = useState(false); // Booleano si se está creando

  const [fondos, setFondos] = useState([]);
  const [jugadores, setJugadores] = useState([]); // Lista de jugadores del equipo actual

  // Formulario inicial vacío
  const initialFormState = {
    nombre: "",
    descripcion: "",
    color_principal: "#3b82f6", // Un azul por defecto
    fondo_imagen: "",
    id_lanzador_penalti: "",
    id_lanzador_falta_lejana: "",
    id_lanzador_corner_izq: "",
    id_lanzador_corner_der: "",
  };
  const [form, setForm] = useState(initialFormState);
  const [dorsales, setDorsales] = useState([]); // {id_jugador, nuevo_dorsal}

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
    // Cargar lista de fondos una sola vez
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

  const handleToggleActivo = async (eq) => {
    try {
      const nuevoEstado = (eq.activo === 1 || eq.activo === true) ? 0 : 1;
      const r = await fetch('/api/index.php?action=admin_toggle_equipo_activo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eq.id, activo: nuevoEstado })
      });
      const j = await r.json();
      if (j.success) {
        // Actualización optimista local
        setData(prev => prev.map(it => it.id === eq.id ? { ...it, activo: nuevoEstado } : it));
      } else {
        setError(j.error || 'No se pudo cambiar el estado');
      }
    } catch { setError('Error de conexión'); }
  };

  // --- FUNCIONES DEL MODAL (CREAR / EDITAR) ---

  // 1. ABRIR PARA CREAR
  const openCreate = () => {
      setEditing(null);
      setJugadores([]); // Un equipo nuevo no tiene jugadores
      setDorsales([]);
      setForm(initialFormState); // Reseteamos formulario
      setIsCreating(true); // Modo creación activado
  };

  // 2. ABRIR PARA EDITAR
  const openEdit = async (eq) => {
    try {
      const r = await fetch(`/api/index.php?action=admin_get_equipo_detalle&id=${eq.id}`);
      const j = await r.json();
      if (!j.success) { setError(j.error || 'No se pudo cargar detalle'); return; }
      
      setEditing(j.equipo);
      setIsCreating(false); // Modo edición activado
      setJugadores(j.jugadores || []);
      
      // Rellenar formulario con datos existentes
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
    } catch { setError('Error de conexión al cargar detalle'); }
  };

  // 3. CERRAR MODAL
  const closeModal = () => {
      setEditing(null);
      setIsCreating(false);
      setJugadores([]);
      setError("");
  };

  // Manejadores de formulario
  const onFormChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const onDorsalChange = (idJugador, value) => {
    setDorsales(prev => prev.map(d => d.id_jugador === idJugador ? { ...d, nuevo_dorsal: value } : d));
  };

  // 4. ENVIAR FORMULARIO (UNI-FICADO)
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validación básica
    if(!form.nombre.trim()) { alert("El nombre es obligatorio"); return; }

    setError("");
    
    try {
      let url = '';
      let payload = {};

      if (isCreating) {
          // MODO CREACIÓN
          url = '/api/index.php?action=admin_crear_equipo';
          // Solo enviamos datos básicos, los jugadores se asignan después
          payload = {
              nombre: form.nombre,
              descripcion: form.descripcion,
              color_principal: form.color_principal,
              fondo_imagen: form.fondo_imagen
          };
      } else if (editing) {
          // MODO EDICIÓN
          url = '/api/index.php?action=admin_update_equipo_completo';
          payload = { id: editing.id, ...form, dorsales };
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
            // Si creamos, recargamos toda la data para ver el nuevo equipo al principio
            loadData(); 
        } else {
            // Si editamos, actualizamos la lista localmente
            setData(prev => prev.map(it => it.id === editing.id ? {
              ...it,
              nombre: form.nombre,
              descripcion: form.descripcion,
              color_principal: form.color_principal,
              // Actualizamos visualmente el estado activo si el backend lo devolviera, por ahora mantenemos el que estaba
            } : it));
        }
      } else { 
          setError(j.error || 'No se pudo guardar cambios'); 
      }
    } catch { 
        setError('Error de conexión al guardar'); 
    }
  };

  // Condición para mostrar el modal
  const showModal = editing !== null || isCreating === true;
  // Título dinámico
  const modalTitle = isCreating ? "Nuevo Equipo" : (editing ? `Editar Equipo: ${editing.nombre}` : "");

  return (
    <div className="admin-equipos-page">
      <div className="perfil-bg" aria-hidden="true" />
      
      <div className="panel">
        {/* Toolbar con botón de crear funcional */}
        <div className="toolbar">
          <input className="search" placeholder="Buscar equipo..." value={search} onChange={e=>{setPage(1);setSearch(e.target.value)}} />
          <select className="select" value={estado} onChange={e=>{setPage(1);setEstado(e.target.value)}}>
            <option value="">Estado: Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
          <button className="btn-create" onClick={openCreate}>+ Nuevo Equipo</button>
        </div>

        {/* Tabla */}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>EQUIPO</th>
                <th>DESCRIPCIÓN</th>
                <th>COLOR PRINCIPAL</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="muted center-text">Cargando...</td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="error center-text">{error}</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={6} className="muted center-text">Sin resultados</td></tr>
              ) : (
                data.map(eq => (
                  <tr key={eq.id}>
                    <td className="mono" data-label="ID">{eq.id}</td>
                    <td data-label="Equipo">
                      <div style={{display:'flex', alignItems:'center'}}>
                        <span className="shield" style={{ background: eq.color_principal }} />
                        <div className="data-equipo-name">{eq.nombre}</div>
                      </div>
                    </td>
                    <td className="muted truncate-text" title={eq.descripcion} data-label="Descripción">{eq.descripcion || '-'}</td>
                    <td data-label="Color">
                      <div style={{display:'flex', alignItems:'center'}}>
                        <span className="color-swatch" style={{ background: eq.color_principal }} />
                        <span className="mono" style={{fontSize:'0.85rem'}}>{eq.color_principal}</span>
                      </div>
                    </td>
                    <td data-label="Estado"><Badge active={eq.activo} /></td>
                    <td>
                      <div className="actions">
                        <button className="icon-btn" title="Editar" onClick={()=>openEdit(eq)}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button 
                            className={`toggle ${eq.activo == 1 ? 'on':''}`} 
                            onClick={()=>handleToggleActivo(eq)} 
                            title={eq.activo == 1 ? "Desactivar" : "Activar"} 
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="pagination">
          <button className="icon-btn" onClick={prevPage} disabled={page===1}>‹</button>
          <div className="mono" style={{fontSize:'0.9rem'}}>Página {page} de {totalPages}</div>
          <button className="icon-btn" onClick={nextPage} disabled={page===totalPages}>›</button>
        </div>

        {/* MODAL UNIFICADO (CREAR Y EDITAR) */}
        {showModal && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <div className="modal-header">
                <h2>{modalTitle}</h2>
                <button className="icon-btn" onClick={closeModal}><i className="bi bi-x" /></button>
              </div>
              
              <form className="modal-body" onSubmit={handleSubmit}>
                {/* Sección 1: Básica (Siempre visible) */}
                <div className="section">
                  <h3>Información básica y visual</h3>
                  <div className="form-grid">
                    <div className="form-row" style={{gridColumn:'1 / -1'}}>
                      <label>Nombre del Equipo *</label>
                      <input className="input" name="nombre" value={form.nombre} onChange={onFormChange} required placeholder="Ej: Rayo Vallecano"/>
                    </div>
                    <div className="form-row">
                      <label>Color principal</label>
                      <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                        <input className="input-color" type="color" name="color_principal" value={form.color_principal} onChange={onFormChange} />
                        <span className="mono" style={{fontSize:'0.8rem'}}>{form.color_principal}</span>
                      </div>
                    </div>
                    <div className="form-row">
                      <label>Imagen de fondo</label>
                      <select className="input select-input" name="fondo_imagen" value={form.fondo_imagen} onChange={onFormChange}>
                        <option value="">(Sin fondo)</option>
                        {fondos.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="form-row" style={{gridColumn:'1 / -1'}}>
                      <label>Descripción</label>
                      <textarea className="textarea" name="descripcion" value={form.descripcion} onChange={onFormChange} placeholder="Breve descripción del club..."/>
                    </div>
                  </div>
                </div>

                {/* Secciones 2 y 3: SOLO VISIBLES AL EDITAR (No al crear) */}
                {!isCreating && jugadores.length > 0 && (
                  <>
                    <div className="section">
                      <h3>Lanzadores a balón parado</h3>
                      <div className="form-grid">
                        <div className="form-row">
                          <label>Penaltis</label>
                          <select className="input select-input" name="id_lanzador_penalti" value={form.id_lanzador_penalti || ''} onChange={onFormChange}>
                            <option value="">(Ninguno)</option>
                            {jugadores.map(j => <option key={j.id} value={j.id}>{j.nombre}{j.apodo?` (${j.apodo})`:''}</option>)}
                          </select>
                        </div>
                        {/* ... Repite para los otros lanzadores ... */}
                        <div className="form-row">
                          <label>Faltas lejanas</label>
                          <select className="input select-input" name="id_lanzador_falta_lejana" value={form.id_lanzador_falta_lejana || ''} onChange={onFormChange}>
                            <option value="">(Ninguno)</option>
                            {jugadores.map(j => <option key={j.id} value={j.id}>{j.nombre}{j.apodo?` (${j.apodo})`:''}</option>)}
                          </select>
                        </div>
                         <div className="form-row">
                          <label>Córners izquierda</label>
                          <select className="input select-input" name="id_lanzador_corner_izq" value={form.id_lanzador_corner_izq || ''} onChange={onFormChange}>
                            <option value="">(Ninguno)</option>
                            {jugadores.map(j => <option key={j.id} value={j.id}>{j.nombre}{j.apodo?` (${j.apodo})`:''}</option>)}
                          </select>
                        </div>
                        <div className="form-row">
                          <label>Córners derecha</label>
                          <select className="input select-input" name="id_lanzador_corner_der" value={form.id_lanzador_corner_der || ''} onChange={onFormChange}>
                            <option value="">(Ninguno)</option>
                            {jugadores.map(j => <option key={j.id} value={j.id}>{j.nombre}{j.apodo?` (${j.apodo})`:''}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="section">
                      <h3>Plantilla y Dorsales ({jugadores.length} jugadores)</h3>
                      <div className="roster-grid">
                        {(jugadores || []).map(j => (
                          <div key={j.id} className="roster-item">
                            <div className="roster-left">
                              <span className="shield small" style={{ background: editing?.color_principal }} />
                              <div className="roster-name text-truncate" title={j.nombre + (j.apodo?` (${j.apodo})`:'')}>
                                {j.nombre}{j.apodo?` (${j.apodo})`:''}
                              </div>
                            </div>
                            <div className="roster-dorsal">
                              <input className="input dorsal-input" type="number" min={1} max={99} placeholder="#"
                                value={(dorsales.find(d=>d.id_jugador===j.id)?.nuevo_dorsal) ?? ''}
                                onChange={e=>onDorsalChange(j.id, e.target.value)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                 
                {!isCreating && jugadores.length === 0 && (
                    <div className="alert alert-info" style={{fontSize:'0.9rem'}}>
                        Este equipo aún no tiene jugadores asignados. Los jugadores deben unirse al equipo para poder asignarles dorsales y roles.
                    </div>
                )}

                <div className="modal-footer">
                  <button type="button" className="btn cancel" onClick={closeModal}>Cancelar</button>
                  <button type="submit" className="btn save">
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
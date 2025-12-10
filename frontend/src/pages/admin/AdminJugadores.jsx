import React, { useEffect, useMemo, useState } from "react";
import "../../css/pages/AdminJugadores.css";

// Badge usando clases usr-*
function Badge({ type, children }) {
  return <span className={`usr-badge ${type}`}>{children}</span>;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function AdminJugadores({ user, currentTeam }) {
  const [search, setSearch] = useState("");
  const [rol, setRol] = useState("");
  const [estado, setEstado] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 768 : false));
  
  const [editing, setEditing] = useState(null); 
  const [form, setForm] = useState({ nombre: "", apodo: "", email: "", telefono: "" });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (rol) p.set("rol", rol);
    if (estado) p.set("estado", estado);
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [search, rol, estado, page, limit]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const resp = await fetch(`/api/index.php?action=admin_listar_jugadores&${query}`);
        const json = await resp.json();
        if (!ignore) {
          if (json.success) {
            setData(json.jugadores || []);
            setTotalPages(json.totalPages || 1);
          } else {
            setError(json.error || "Error al cargar jugadores");
            setData([]);
            setTotalPages(1);
          }
        }
      } catch (e) {
        if (!ignore) {
          setError("Error de conexión");
          setData([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, [query]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setExpandedId(null);
    }
  }, [isMobile]);

  const nextPage = () => setPage(p => Math.min(p + 1, totalPages));
  const prevPage = () => setPage(p => Math.max(p - 1, 1));

  const onSearchChange = (e) => { setPage(1); setSearch(e.target.value); };
  const onRolChange = (e) => { setPage(1); setRol(e.target.value); };
  const onEstadoChange = (e) => { setPage(1); setEstado(e.target.value); };

  const rolBadge = (r) => r === 'admin' ? <Badge type="blue">Admin</Badge> : <Badge type="gray">Usuario</Badge>;
  const estadoBadge = (act, elim) => {
    if (elim === 1) return <Badge type="red">Eliminado</Badge>;
    if (act === 1) return <Badge type="green">Activo</Badge>;
    return <Badge type="orange">Inactivo</Badge>;
  };

  const handleToggleActivo = async (j) => {
    try {
      const nuevoActivo = j.activo === 1 ? 0 : 1;
      const resp = await fetch('/api/index.php?action=admin_toggle_activo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: j.id, activo: nuevoActivo })
      });
      const json = await resp.json();
      if (json.success) {
        setData((prev) => prev.map((it) => it.id === j.id ? { ...it, activo: nuevoActivo } : it));
      } else {
        setError(json.error || 'No se pudo actualizar activo');
      }
    } catch (e) {
      setError('Error de conexión');
    }
  };

  const handleToggleEliminado = async (j) => {
    try {
      const nuevoEliminado = j.eliminado === 1 ? 0 : 1;
      const resp = await fetch('/api/index.php?action=admin_toggle_eliminado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: j.id, eliminado: nuevoEliminado })
      });
      const json = await resp.json();
      if (json.success) {
        setData((prev) => prev.map((it) => it.id === j.id ? { ...it, eliminado: nuevoEliminado } : it));
      } else {
        setError(json.error || 'No se pudo actualizar eliminado');
      }
    } catch (e) {
      setError('Error de conexión');
    }
  };

  const openEdit = (j) => {
    setEditing(j);
    setForm({
      nombre: j.nombre || "",
      apodo: j.apodo || "",
      email: j.email || "",
      telefono: j.telefono || "",
    });
    setError("");
  };

  const closeEdit = () => {
    setEditing(null);
    setError("");
  };

  const onFormChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setError("");

    try {
      const payload = {
        id_jugador: editing.id,
        nombre: form.nombre,
        apodo: form.apodo,
        email: form.email,
        telefono: form.telefono,
      };
      
      const resp = await fetch('/api/index.php?action=actualizar_datos', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      
      if (json.success) {
        setData((prev) => prev.map((it) => it.id === editing.id ? { ...it, ...payload } : it));
        closeEdit();
      } else {
        setError(json.error || 'No se pudo guardar cambios');
      }
    } catch (err) {
      setError('Error de conexión al guardar');
    }
  };

  const toggleExpanded = (id) => {
    if (!isMobile) return;
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="admin-jugadores-page">
      <div className="usr-panel">
        {/* Toolbar */}
        <div className="usr-toolbar">
          <input
            className="usr-search-input"
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={onSearchChange}
          />
          <div className="usr-toolbar-right">
            <select className="usr-select" value={rol} onChange={onRolChange}>
              <option value="">Todos los Roles</option>
              <option value="admin">Admin</option>
              <option value="usuario">Usuario</option>
            </select>
            <select className="usr-select" value={estado} onChange={onEstadoChange}>
              <option value="">Todos los Estados</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="eliminado">Eliminado</option>
            </select>
          </div>
        </div>

        {/* Tabla / Tarjetas */}
        <div className="usr-table-wrap">
          {isMobile ? (
            <div className="usr-player-cards">
              {loading ? (
                <div className="usr-card-state">Cargando...</div>
              ) : error ? (
                <div className="usr-card-state usr-error">{error}</div>
              ) : data.length === 0 ? (
                <div className="usr-card-state">Sin resultados</div>
              ) : (
                data.map((j) => (
                  <div className={`usr-player-card ${expandedId === j.id ? 'open' : ''}`} key={j.id}>
                    <button
                      className="usr-player-summary"
                      type="button"
                      onClick={() => toggleExpanded(j.id)}
                    >
                      <div className="usr-player-text">
                        <span className="usr-player-name">{j.nombre}{j.apodo ? ` (${j.apodo})` : ''}</span>
                        <span className="usr-player-email">{j.email}</span>
                      </div>
                      <div className="usr-player-meta">
                        {estadoBadge(j.activo, j.eliminado)}
                        <span className="usr-player-chevron">{expandedId === j.id ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    <div className="usr-player-details">
                      <div className="usr-player-grid">
                        <div>
                          <span className="usr-player-label">ID</span>
                          <span className="usr-player-value usr-mono">{j.id}</span>
                        </div>
                        <div>
                          <span className="usr-player-label">Rol</span>
                          <span className="usr-player-value">{rolBadge(j.rol)}</span>
                        </div>
                        <div>
                          <span className="usr-player-label">Rating</span>
                          <span className="usr-player-value">{Number(j.rating_habilidad || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="usr-player-label">Registro</span>
                          <span className="usr-player-value usr-mono">{formatDate(j.fecha_registro)}</span>
                        </div>
                        {j.telefono && (
                          <div>
                            <span className="usr-player-label">Teléfono</span>
                            <span className="usr-player-value usr-mono">{j.telefono}</span>
                          </div>
                        )}
                      </div>
                      <div className="usr-player-actions">
                        <button className="usr-btn-sm" onClick={() => openEdit(j)}>
                          ✎ Editar
                        </button>
                        <button className="usr-btn-sm" onClick={() => handleToggleActivo(j)}>
                          {j.activo === 1 ? '🚫 Banear' : '✅ Desbanear'}
                        </button>
                        <button className="usr-btn-sm" onClick={() => handleToggleEliminado(j)}>
                          {j.eliminado === 1 ? '♻️ Restaurar' : '🗑️ Eliminar'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <table className="usr-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>JUGADOR</th>
                  <th>EMAIL</th>
                  <th>ROL</th>
                  <th>RATING</th>
                  <th>REGISTRO</th>
                  <th>ESTADO</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{textAlign:'center', color:'var(--usr-text-muted)'}}>Cargando...</td></tr>
                ) : error ? (
                  <tr><td colSpan={8} style={{textAlign:'center', color:'var(--usr-danger)'}}>{error}</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center', color:'var(--usr-text-muted)'}}>Sin resultados</td></tr>
                ) : (
                  data.map((j) => (
                    <tr key={j.id}>
                      <td className="usr-mono">{j.id}</td>
                      <td style={{fontWeight:600}}>{j.nombre}{j.apodo ? ` (${j.apodo})` : ''}</td>
                      <td className="usr-mono">{j.email}</td>
                      <td>{rolBadge(j.rol)}</td>
                      <td>{Number(j.rating_habilidad || 0).toFixed(2)}</td>
                      <td className="usr-mono">{formatDate(j.fecha_registro)}</td>
                      <td>{estadoBadge(j.activo, j.eliminado)}</td>
                      <td>
                        <div className="usr-actions">
                          <button className="usr-icon-btn" title="Editar" onClick={() => openEdit(j)}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="usr-icon-btn danger" title="Banear/Desbanear" onClick={() => handleToggleActivo(j)}>
                            <i className="bi bi-slash-circle"></i>
                          </button>
                          <button className="usr-icon-btn danger" title="Eliminar/Restaurar" onClick={() => handleToggleEliminado(j)}>
                             <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="usr-pagination">
            <button className="usr-page-btn" onClick={prevPage} disabled={page === 1}>‹</button>
            <span className="usr-page-info">Página {page} de {totalPages}</span>
            <button className="usr-page-btn" onClick={nextPage} disabled={page === totalPages}>›</button>
          </div>
        )}

        {/* MODAL DE EDICIÓN */}
        {editing && (
          <div className="usr-modal-backdrop">
            <div className="usr-modal-card">
              <div className="usr-modal-header">
                <h2>Editar Jugador #{editing.id}</h2>
                <button className="usr-icon-btn" onClick={closeEdit}>✕</button>
              </div>
              <form className="usr-modal-body" onSubmit={submitEdit}>
                {error && <div className="usr-error">{error}</div>}
                
                <div className="usr-form-row">
                  <label>Nombre</label>
                  <input name="nombre" value={form.nombre} onChange={onFormChange} className="usr-input" required />
                </div>
                <div className="usr-form-row">
                  <label>Apodo</label>
                  <input name="apodo" value={form.apodo} onChange={onFormChange} className="usr-input" />
                </div>
                <div className="usr-form-row">
                  <label>Email</label>
                  <input name="email" type="email" value={form.email} onChange={onFormChange} className="usr-input" required />
                </div>
                <div className="usr-form-row">
                  <label>Teléfono</label>
                  <input name="telefono" value={form.telefono} onChange={onFormChange} className="usr-input" />
                </div>
                
                <div className="usr-modal-footer">
                  <button type="button" className="usr-btn-cancel" onClick={closeEdit}>Cancelar</button>
                  <button type="submit" className="usr-btn-primary">Guardar Cambios</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
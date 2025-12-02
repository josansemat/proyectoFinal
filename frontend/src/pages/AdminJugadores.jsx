import { useEffect, useMemo, useState } from "react";
import "./AdminJugadores.css";

// Componente para los badges de estado y rol
function Badge({ type, children }) {
  return <span className={`badge-pill ${type}`}>{children}</span>;
}

// Función auxiliar para formatear la fecha
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function AdminJugadores() {
  // Estados para filtros, paginación y datos de la tabla
  const [search, setSearch] = useState("");
  const [rol, setRol] = useState("");
  const [estado, setEstado] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Estados para el Modal de Edición
  const [editing, setEditing] = useState(null); 
  const [form, setForm] = useState({ nombre: "", apodo: "", email: "", telefono: "" });

  // Memoriza los parámetros de la URL para evitar recargas innecesarias
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (rol) p.set("rol", rol);
    if (estado) p.set("estado", estado);
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [search, rol, estado, page, limit]);

  // Carga inicial y recarga de datos cuando cambia la query
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

  // Funciones de paginación
  const nextPage = () => setPage(p => Math.min(p + 1, totalPages));
  const prevPage = () => setPage(p => Math.max(p - 1, 1));

  // Funciones de manejo de filtros
  const onSearchChange = (e) => { setPage(1); setSearch(e.target.value); };
  const onRolChange = (e) => { setPage(1); setRol(e.target.value); };
  const onEstadoChange = (e) => { setPage(1); setEstado(e.target.value); };

  // Helpers para renderizar los badges
  const rolBadge = (r) => r === 'admin' ? <Badge type="badge-blue">Admin</Badge> : <Badge type="badge-gray">Usuario</Badge>;
  const estadoBadge = (act, elim) => {
    if (elim === 1) return <Badge type="badge-red">Eliminado</Badge>;
    if (act === 1) return <Badge type="badge-green">Activo</Badge>;
    return <Badge type="badge-orange">Inactivo</Badge>;
  };

  // Función para Banear/Desbanear
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

  // Función para Eliminar/Restaurar
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

  // --- FUNCIONES DEL MODAL DE EDICIÓN (Ahora en el lugar correcto) ---

  // Abre el modal y carga los datos del jugador seleccionado
  const openEdit = (j) => {
    setEditing(j);
    setForm({
      nombre: j.nombre || "",
      apodo: j.apodo || "",
      email: j.email || "",
      telefono: j.telefono || "",
    });
    setError(""); // Limpia errores previos al abrir
  };

  // Cierra el modal
  const closeEdit = () => {
    setEditing(null);
    setError("");
  };

  // Maneja los cambios en los inputs del formulario
  const onFormChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  // Envía los datos editados al servidor
  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setError(""); // Limpia errores antes de enviar

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
        // Actualiza los datos en la tabla localmente sin recargar
        setData((prev) => prev.map((it) => it.id === editing.id ? { ...it, ...payload } : it));
        closeEdit();
      } else {
        setError(json.error || 'No se pudo guardar cambios');
      }
    } catch (err) {
      setError('Error de conexión al guardar');
    }
  };

  return (
    <div className="admin-jugadores-page">
      <div className="perfil-bg" aria-hidden="true" />
      <h1 className="page-title">Administración Global - Gestión de Jugadores</h1>

      <div className="panel">
        {/* Barra de Herramientas (Búsqueda y Filtros) */}
        <div className="toolbar">
          <input
            className="search-input"
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={onSearchChange}
          />
          <div className="toolbar-right">
            <select className="select" value={rol} onChange={onRolChange}>
              <option value="">Filtrar por Rol (Todos)</option>
              <option value="admin">Admin</option>
              <option value="usuario">Usuario</option>
            </select>
            <select className="select" value={estado} onChange={onEstadoChange}>
              <option value="">Estado (Todos)</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="eliminado">Eliminado</option>
            </select>
          </div>
        </div>

        {/* Tabla de Datos */}
        <div className="table-wrap">
          <table className="data-table">
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
                <tr><td colSpan={8} className="muted">Cargando...</td></tr>
              ) : error ? (
                <tr><td colSpan={8} className="error">{error}</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={8} className="muted">Sin resultados</td></tr>
              ) : (
                data.map((j) => (
                  <tr key={j.id}>
                    <td className="mono">{j.id}</td>
                    <td className="player-cell">{j.nombre}{j.apodo ? ` (${j.apodo})` : ''}</td>
                    <td className="mono">{j.email}</td>
                    <td>{rolBadge(j.rol)}</td>
                    <td>{Number(j.rating_habilidad || 0).toFixed(2)}</td>
                    <td className="mono">{formatDate(j.fecha_registro)}</td>
                    <td>{estadoBadge(j.activo, j.eliminado)}</td>
                    <td>
                      <div className="actions">
                        <button className="icon-btn" title="Editar" onClick={() => openEdit(j)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="icon-btn danger" title="Banear/Desbanear" onClick={() => handleToggleActivo(j)}>
                          <i className="bi bi-slash-circle"></i>
                        </button>
                        <button className="icon-btn danger" title="Eliminar/Restaurar" onClick={() => handleToggleEliminado(j)}>
                          <i className="bi bi-trash"></i>
                        </button>
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
          <button className="page-btn" onClick={prevPage} disabled={page === 1}>‹</button>
          <div className="page-info">Página {page} de {totalPages}</div>
          <button className="page-btn" onClick={nextPage} disabled={page === totalPages}>›</button>
        </div>

        {/* MODAL DE EDICIÓN (Tarjeta Superpuesta) */}
        {editing && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <div className="modal-header">
                <h2>Editar jugador #{editing.id}</h2>
                <button className="icon-btn" onClick={closeEdit} title="Cerrar">
                  <i className="bi bi-x"></i>
                </button>
              </div>
              <form className="modal-body" onSubmit={submitEdit}>
                {error && <div className="error mb-3">{error}</div>}
                <div className="form-row">
                  <label>Nombre</label>
                  <input name="nombre" value={form.nombre} onChange={onFormChange} className="select" required />
                </div>
                <div className="form-row">
                  <label>Apodo</label>
                  <input name="apodo" value={form.apodo} onChange={onFormChange} className="select" />
                </div>
                <div className="form-row">
                  <label>Email</label>
                  <input name="email" type="email" value={form.email} onChange={onFormChange} className="select" required />
                </div>
                <div className="form-row">
                  <label>Teléfono</label>
                  <input name="telefono" value={form.telefono} onChange={onFormChange} className="select" />
                </div>
                <div className="modal-footer">
                  <button type="button" className="page-btn" onClick={closeEdit}>Cancelar</button>
                  {/* Botón primario azul para la acción principal */}
                  <button type="submit" className="page-btn btn-primary">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
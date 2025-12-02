import { useEffect, useMemo, useState } from "react";
import "./PartidosDashboard.css";

const estados = [
  { value: "todos", label: "Todos" },
  { value: "programado", label: "Programados" },
  { value: "en_curso", label: "En curso" },
  { value: "completado", label: "Completados" },
  { value: "cancelado", label: "Cancelados" },
];

const emptyForm = {
  fecha_hora: "",
  lugar_nombre: "",
  lugar_enlace_maps: "",
  max_jugadores: 10,
  precio_total_pista: "",
  estado: "programado",
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T"));
  return date.toLocaleString();
};

const toDatetimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value.replace(" ", "T"));
  const tzOffset = date.getTimezoneOffset();
  date.setMinutes(date.getMinutes() - tzOffset);
  return date.toISOString().slice(0, 16);
};

const percent = (current, max) => {
  if (!max) return 0;
  return Math.min(100, Math.round((current / max) * 100));
};

function PartidosDashboard({ user }) {
  const [partidos, setPartidos] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ search: "", estado: "todos" });
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formValues, setFormValues] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const responsableDefault = useMemo(() => user?.id ?? null, [user]);

  useEffect(() => {
    fetchPartidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const fetchPartidos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: "partidos_listar",
        page,
        limit,
        with_stats: "1",
      });
      if (filters.search) params.append("search", filters.search);
      if (filters.estado && filters.estado !== "todos") {
        params.append("estado", filters.estado);
      }
      const response = await fetch(`/api/index.php?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setPartidos(data.partidos || []);
        setStats(data.stats || null);
        setTotalPages(data.totalPages || 1);
      } else {
        throw new Error(data.error || "No se pudo cargar la tabla");
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormValues({ ...emptyForm, estado: "programado" });
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: "", text: "" });

    const payload = {
      ...formValues,
      id: editingId,
      id_responsable_alquiler: formValues.id_responsable_alquiler || responsableDefault,
    };

    const action = editingId ? "partido_actualizar" : "partido_crear";

    try {
      const response = await fetch(`/api/index.php?action=${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "No se pudo guardar el partido");
      }
      setMessage({ type: "success", text: editingId ? "Partido actualizado" : "Partido creado" });
      resetForm();
      fetchPartidos();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (partido) => {
    setEditingId(partido.id);
    setFormValues({
      fecha_hora: toDatetimeLocal(partido.fecha_hora),
      lugar_nombre: partido.lugar_nombre || "",
      lugar_enlace_maps: partido.lugar_enlace_maps || "",
      max_jugadores: partido.max_jugadores || 10,
      precio_total_pista: partido.precio_total_pista ?? "",
      estado: partido.estado,
      id_responsable_alquiler: partido.id_responsable_alquiler || responsableDefault,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este partido?")) return;
    try {
      const response = await fetch(`/api/index.php?action=partido_eliminar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudo eliminar");
      setMessage({ type: "success", text: "Partido eliminado" });
      fetchPartidos();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const resumenCards = stats ? [
    { label: "Programados", value: stats.totalProgramados },
    { label: "Completados", value: stats.totalCompletados },
    { label: "Pendiente €", value: `€${stats.pendienteCobrar?.toFixed(2) ?? "0.00"}` },
    { label: "Recaudado €", value: `€${stats.totalRecaudado?.toFixed(2) ?? "0.00"}` },
    { label: "Ocupación", value: `${stats.promedioOcupacion ?? 0}%` },
  ] : [];

  const proximo = stats?.proximoPartido;

  return (
    <div className="partidos-dashboard container py-4">
      <header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Dashboard de Partidos</h1>
          <p className="text-muted mb-0">Administra el calendario y controla la ocupación de cada fecha.</p>
        </div>
        <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
          {editingId ? "Cancelar edición" : "Limpiar"}
        </button>
      </header>

      {message.text && (
        <div className={`alert ${message.type === "error" ? "alert-danger" : "alert-success"}`}>
          {message.text}
        </div>
      )}

      <section className="row g-3 mb-4">
        {resumenCards.map((card) => (
          <div key={card.label} className="col-6 col-md-4 col-xl-2">
            <div className="card resumen-card h-100">
              <div className="card-body">
                <p className="text-muted text-uppercase small mb-1">{card.label}</p>
                <h3 className="mb-0">{card.value}</h3>
              </div>
            </div>
          </div>
        ))}
        {proximo && (
          <div className="col-12 col-xl-4">
            <div className="card resumen-card proximo h-100">
              <div className="card-body">
                <p className="text-muted text-uppercase small mb-1">Próximo partido</p>
                <h4 className="mb-2">{proximo.lugar_nombre}</h4>
                <div className="text-muted small">{formatDate(proximo.fecha_hora)}</div>
                <span className={`badge estado ${proximo.estado}`}>{proximo.estado}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="h5 mb-3">Crear / Editar partido</h2>
          <form className="row g-3" onSubmit={handleSubmit}>
            <div className="col-md-4">
              <label className="form-label">Fecha y hora*</label>
              <input type="datetime-local" name="fecha_hora" className="form-control"
                value={formValues.fecha_hora}
                onChange={handleChange} required />
            </div>
            <div className="col-md-4">
              <label className="form-label">Lugar*</label>
              <input type="text" name="lugar_nombre" className="form-control" value={formValues.lugar_nombre}
                onChange={handleChange} required />
            </div>
            <div className="col-md-4">
              <label className="form-label">Enlace Maps</label>
              <input type="url" name="lugar_enlace_maps" className="form-control"
                value={formValues.lugar_enlace_maps}
                onChange={handleChange} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Cupo máximo*</label>
              <input type="number" min="2" name="max_jugadores" className="form-control"
                value={formValues.max_jugadores}
                onChange={handleChange} required />
            </div>
            <div className="col-md-3">
              <label className="form-label">Precio total (€)</label>
              <input type="number" step="0.01" name="precio_total_pista" className="form-control"
                value={formValues.precio_total_pista}
                onChange={handleChange} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Estado</label>
              <select name="estado" className="form-select" value={formValues.estado}
                onChange={handleChange}>
                {estados.filter((opt) => opt.value !== "todos").map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">ID responsable</label>
              <input type="number" name="id_responsable_alquiler" className="form-control"
                value={formValues.id_responsable_alquiler || responsableDefault || ""}
                onChange={handleChange} />
            </div>
            <div className="col-12 d-flex gap-3">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Guardando..." : editingId ? "Actualizar partido" : "Crear partido"}
              </button>
              {editingId && (
                <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>Cancelar</button>
              )}
            </div>
          </form>
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <div className="d-flex flex-column flex-md-row justify-content-between gap-3 align-items-md-end mb-3">
            <div>
              <h2 className="h5 mb-1">Listado de partidos</h2>
              <p className="text-muted small mb-0">Filtra por estado, busca por lugar o fecha.</p>
            </div>
            <div className="d-flex flex-column flex-md-row gap-2 w-100 w-md-auto">
              <input type="text" name="search" placeholder="Buscar por lugar o fecha" className="form-control"
                value={filters.search}
                onChange={handleFilterChange} />
              <select name="estado" className="form-select" value={filters.estado}
                onChange={handleFilterChange}>
                {estados.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Lugar</th>
                  <th>Cupo</th>
                  <th>Inscritos</th>
                  <th>Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="text-center py-4">Cargando...</td></tr>
                ) : partidos.length ? (
                  partidos.map((partido) => (
                    <tr key={partido.id} className={partido.eliminado ? "text-muted" : ""}>
                      <td>{formatDate(partido.fecha_hora)}</td>
                      <td>
                        <div className="fw-semibold">{partido.lugar_nombre}</div>
                        {partido.lugar_enlace_maps && (
                          <a href={partido.lugar_enlace_maps} target="_blank" rel="noreferrer" className="text-decoration-none small">
                            Ver ubicación ↗
                          </a>
                        )}
                      </td>
                      <td>{partido.max_jugadores}</td>
                      <td>
                        <div className="d-flex flex-column gap-1">
                          <span>{partido.total_inscritos || 0} jugadores</span>
                          <div className="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent(partido.total_inscritos || 0, partido.max_jugadores)}>
                            <div className="progress-bar" style={{ width: `${percent(partido.total_inscritos || 0, partido.max_jugadores)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge estado ${partido.estado}`}>{partido.estado}</span></td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button type="button" className="btn btn-outline-primary" onClick={() => handleEdit(partido)}>Editar</button>
                          <button type="button" className="btn btn-outline-danger" onClick={() => handleDelete(partido.id)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" className="text-center py-4">No hay partidos</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between align-items-center mt-3">
            <p className="mb-0 text-muted small">Página {page} de {totalPages}</p>
            <div className="btn-group">
              <button type="button" className="btn btn-outline-secondary" disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Anterior
              </button>
              <button type="button" className="btn btn-outline-secondary" disabled={page >= totalPages}
                onClick={() => setPage((prev) => prev + 1)}>
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default PartidosDashboard;

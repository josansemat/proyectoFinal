import { useCallback, useEffect, useMemo, useState } from "react";
import "./PartidosDashboard.css";
import PartidoLineup from "./PartidoLineup";

const estados = [
  { value: "todos", label: "Todos" },
  { value: "programado", label: "Programados" },
  { value: "en_curso", label: "En curso" },
  { value: "completado", label: "Completados" },
  { value: "cancelado", label: "Cancelados" },
];

const emptyForm = {
  fecha_hora: "",
  fecha_limite_inscripcion: "",
  lugar_nombre: "",
  lugar_enlace_maps: "",
  max_jugadores: 10,
  precio_total_pista: "",
  estado: "programado",
  id_responsable_alquiler: "",
  equipos_generados: false,
  votacion_habilitada: false,
  comprobante_pdf: "",
  goles_equipo_A: 0,
  goles_equipo_B: 0,
  tipo_partido: "interno",
  modalidad_juego: "f7",
  metodo_generacion: "aleatorio",
};

const normalizeDateValue = (value) => {
  if (!value) return "";
  return value.includes("T") ? value : value.replace(" ", "T");
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(normalizeDateValue(value));
  return date.toLocaleString();
};

const toDatetimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(normalizeDateValue(value));
  const tzOffset = date.getTimezoneOffset();
  date.setMinutes(date.getMinutes() - tzOffset);
  return date.toISOString().slice(0, 16);
};

const percent = (current, max) => {
  if (!max) return 0;
  return Math.min(100, Math.round((current / max) * 100));
};

function PartidosDashboard({ user, currentTeam }) {
  const currentTeamId = currentTeam?.id;
  const globalRole = user?.rol || "usuario";
  const canManagePartidos = globalRole === "admin" || currentTeam?.mi_rol === "manager";

  const [partidos, setPartidos] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ search: "", estado: "todos" });
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formValues, setFormValues] = useState(() => ({
    ...emptyForm,
    id_responsable_alquiler: user?.id || "",
  }));
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [detalleSeleccionado, setDetalleSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [teamRoster, setTeamRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [inscripcionLoading, setInscripcionLoading] = useState(false);

  const responsableDefault = useMemo(() => user?.id ?? null, [user]);

  useEffect(() => {
    setFormValues((prev) => ({
      ...prev,
      id_responsable_alquiler: prev.id_responsable_alquiler || responsableDefault || "",
    }));
  }, [responsableDefault]);

  useEffect(() => {
    setPage(1);
    setDetalleSeleccionado(null);
    setDetalle(null);
  }, [currentTeamId]);

  const loadPartidos = useCallback(async () => {
    if (!currentTeamId) {
      setPartidos([]);
      setStats(null);
      setTotalPages(1);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: "partidos_listar",
        id_equipo: currentTeamId,
        page: String(page),
        limit: String(limit),
        with_stats: "1",
      });
      if (filters.search) params.append("search", filters.search);
      if (filters.estado && filters.estado !== "todos") params.append("estado", filters.estado);
      const response = await fetch(`/api/index.php?${params.toString()}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudo cargar la tabla");
      setPartidos(data.partidos || []);
      setStats(data.stats || null);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }, [currentTeamId, filters, page, limit]);

  useEffect(() => {
    loadPartidos();
  }, [loadPartidos]);

  useEffect(() => {
    if (!currentTeamId) {
      setTeamRoster([]);
      return;
    }
    let ignore = false;
    const loadRoster = async () => {
      setRosterLoading(true);
      try {
        const response = await fetch(`/api/index.php?action=jugadores_equipo&id_equipo=${currentTeamId}`);
        const data = await response.json();
        if (!ignore) setTeamRoster(data.success ? data.jugadores || [] : []);
      } catch (error) {
        if (!ignore) {
          setTeamRoster([]);
          console.error(error);
        }
      } finally {
        if (!ignore) setRosterLoading(false);
      }
    };
    loadRoster();
    return () => {
      ignore = true;
    };
  }, [currentTeamId]);

  const fetchDetalle = useCallback(async (partidoId) => {
    setDetalleLoading(true);
    try {
      const response = await fetch(`/api/index.php?action=partido_detalle&id=${partidoId}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudo obtener el detalle");
      setDetalle({
        ...data,
        jugadores: data.jugadores ?? [],
        espera: data.espera ?? [],
        eventos: data.eventos ?? [],
        formaciones: data.formaciones ?? [],
        comentarios: data.comentarios ?? [],
        ratings: data.ratings ?? [],
        votos_categorias: data.votos_categorias ?? [],
        votos_mvp: data.votos_mvp ?? [],
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
      setDetalleSeleccionado(null);
      throw error;
    } finally {
      setDetalleLoading(false);
    }
  }, []);

  const refreshDetalle = useCallback(async () => {
    if (!detalleSeleccionado) return;
    await fetchDetalle(detalleSeleccionado);
  }, [detalleSeleccionado, fetchDetalle]);

  const resetForm = useCallback(() => {
    setFormValues({
      ...emptyForm,
      id_responsable_alquiler: responsableDefault || "",
    });
    setEditingId(null);
  }, [responsableDefault]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const parsedValue = type === "checkbox" ? checked : value;
    setFormValues((prev) => ({ ...prev, [name]: parsedValue }));
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

    if (!currentTeamId) {
      setSubmitting(false);
      setMessage({ type: "error", text: "Selecciona un equipo antes de crear un partido" });
      return;
    }
    if (!canManagePartidos) {
      setSubmitting(false);
      setMessage({ type: "error", text: "Solo los managers del equipo pueden gestionar partidos" });
      return;
    }

    const payload = {
      ...formValues,
      id: editingId,
      id_equipo: currentTeamId,
      id_responsable_alquiler: formValues.id_responsable_alquiler || responsableDefault,
      max_jugadores: Number(formValues.max_jugadores) || 0,
      goles_equipo_A: Number(formValues.goles_equipo_A) || 0,
      goles_equipo_B: Number(formValues.goles_equipo_B) || 0,
      id_usuario: user?.id,
      rol_global: globalRole,
    };

    const action = editingId ? "partido_actualizar" : "partido_crear";

    try {
      const response = await fetch(`/api/index.php?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudo guardar el partido");
      setMessage({ type: "success", text: editingId ? "Partido actualizado" : "Partido creado" });
      resetForm();
      await loadPartidos();
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
      fecha_limite_inscripcion: toDatetimeLocal(partido.fecha_limite_inscripcion),
      lugar_nombre: partido.lugar_nombre || "",
      lugar_enlace_maps: partido.lugar_enlace_maps || "",
      max_jugadores: partido.max_jugadores || 10,
      precio_total_pista: partido.precio_total_pista ?? "",
      estado: partido.estado,
      id_responsable_alquiler: partido.id_responsable_alquiler || responsableDefault || "",
      equipos_generados: Boolean(partido.equipos_generados),
      votacion_habilitada: Boolean(partido.votacion_habilitada),
      comprobante_pdf: partido.comprobante_pdf || "",
      goles_equipo_A: partido.goles_equipo_A ?? 0,
      goles_equipo_B: partido.goles_equipo_B ?? 0,
      tipo_partido: partido.tipo_partido || "interno",
      modalidad_juego: partido.modalidad_juego || "f7",
      metodo_generacion: partido.metodo_generacion || "aleatorio",
    });
    setIsFormOpen(true);
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
      if (detalleSeleccionado === id) {
        setDetalleSeleccionado(null);
        setDetalle(null);
      }
      await loadPartidos();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const handleDetalle = useCallback(
    (partido) => {
      if (detalleSeleccionado === partido.id) {
        setDetalleSeleccionado(null);
        setDetalle(null);
        return;
      }
      setDetalleSeleccionado(partido.id);
      setDetalle(null);
      fetchDetalle(partido.id);
    },
    [detalleSeleccionado, fetchDetalle]
  );

  const handleInscribirJugador = async (jugadorId) => {
    if (!detalleSeleccionado) {
      setMessage({ type: "error", text: "Abre el detalle de un partido para inscribir jugadores" });
      return;
    }
    setInscripcionLoading(true);
    try {
      const response = await fetch(`/api/index.php?action=partido_inscribir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_partido: detalleSeleccionado, id_jugador: jugadorId }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudo inscribir al jugador");
      await refreshDetalle();
      await loadPartidos();
      setMessage({ type: "success", text: data.message || "Jugador inscrito" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setInscripcionLoading(false);
    }
  };

  const handleDesinscribirJugador = async (jugadorId) => {
    if (!detalleSeleccionado) {
      setMessage({ type: "error", text: "Selecciona un partido para gestionar la lista" });
      return;
    }
    setInscripcionLoading(true);
    try {
      const response = await fetch(`/api/index.php?action=partido_desinscribir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_partido: detalleSeleccionado, id_jugador: jugadorId }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudo quitar al jugador");
      await refreshDetalle();
      await loadPartidos();
      setMessage({ type: "success", text: data.message || "Jugador eliminado" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setInscripcionLoading(false);
    }
  };

  const handleGuardarFormacion = async (payload) => {
    if (!detalleSeleccionado) throw new Error("Primero selecciona un partido");
    const response = await fetch(`/api/index.php?action=partido_guardar_formacion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_partido: detalleSeleccionado, ...payload }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "No se pudo guardar la formación");
    await refreshDetalle();
  };

  const resumenCards = stats
    ? [
        { label: "Programados", value: stats.totalProgramados },
        { label: "Completados", value: stats.totalCompletados },
        { label: "Pendiente €", value: `€${stats.pendienteCobrar?.toFixed(2) ?? "0.00"}` },
        { label: "Recaudado €", value: `€${stats.totalRecaudado?.toFixed(2) ?? "0.00"}` },
        { label: "Ocupación", value: `${stats.promedioOcupacion ?? 0}%` },
      ]
    : [];

  const proximo = stats?.proximoPartido;

  if (!currentTeamId) {
    return (
      <div className="partidos-dashboard container py-4">
        <div className="alert alert-info">
          Selecciona un equipo en la barra lateral para gestionar sus partidos.
        </div>
      </div>
    );
  }

  return (
    <div className="partidos-dashboard container py-4">
      <header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Dashboard de Partidos</h1>
          <p className="text-muted mb-0">Administra el calendario y controla la ocupación de cada fecha.</p>
        </div>
        <div className="d-flex gap-2">
          {editingId && (
            <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
              Cancelar edición
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canManagePartidos}
            onClick={() => setIsFormOpen((prev) => !prev)}
          >
            {isFormOpen ? "Ocultar formulario" : "Nuevo partido"}
          </button>
        </div>
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

      <section className="mb-4">
        {!canManagePartidos && (
          <div className="alert alert-light border">
            Solo los managers del equipo (o administradores) pueden crear y actualizar partidos.
          </div>
        )}
        {canManagePartidos && isFormOpen && (
          <div className="card">
            <div className="card-body">
              <h2 className="h5 mb-3">{editingId ? "Editar partido" : "Nuevo partido"}</h2>
              <form className="row g-3" onSubmit={handleSubmit}>
                <div className="col-md-4">
                  <label className="form-label">Fecha y hora*</label>
                  <input
                    type="datetime-local"
                    name="fecha_hora"
                    className="form-control"
                    value={formValues.fecha_hora}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Fecha límite inscripción</label>
                  <input
                    type="datetime-local"
                    name="fecha_limite_inscripcion"
                    className="form-control"
                    value={formValues.fecha_limite_inscripcion}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Lugar*</label>
                  <input
                    type="text"
                    name="lugar_nombre"
                    className="form-control"
                    value={formValues.lugar_nombre}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Tipo de partido</label>
                  <select name="tipo_partido" className="form-select" value={formValues.tipo_partido} onChange={handleChange}>
                    <option value="interno">Interno</option>
                    <option value="externo">Externo</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Modalidad</label>
                  <select
                    name="modalidad_juego"
                    className="form-select"
                    value={formValues.modalidad_juego}
                    onChange={handleChange}
                  >
                    <option value="f5">Fútbol 5</option>
                    <option value="f7">Fútbol 7</option>
                    <option value="f11">Fútbol 11</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Método generación equipos</label>
                  <select
                    name="metodo_generacion"
                    className="form-select"
                    value={formValues.metodo_generacion}
                    onChange={handleChange}
                  >
                    <option value="manual">Manual</option>
                    <option value="aleatorio">Aleatorio</option>
                    <option value="equilibrado">Equilibrado</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Enlace Maps</label>
                  <input
                    type="url"
                    name="lugar_enlace_maps"
                    className="form-control"
                    value={formValues.lugar_enlace_maps}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Cupo máximo*</label>
                  <input
                    type="number"
                    min="2"
                    name="max_jugadores"
                    className="form-control"
                    value={formValues.max_jugadores}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Precio total (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="precio_total_pista"
                    className="form-control"
                    value={formValues.precio_total_pista}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Estado</label>
                  <select name="estado" className="form-select" value={formValues.estado} onChange={handleChange}>
                    {estados
                      .filter((opt) => opt.value !== "todos")
                      .map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">ID responsable</label>
                  <input
                    type="number"
                    name="id_responsable_alquiler"
                    className="form-control"
                    value={formValues.id_responsable_alquiler || responsableDefault || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Comprobante (PDF)</label>
                  <input
                    type="text"
                    name="comprobante_pdf"
                    className="form-control"
                    placeholder="ej: recibo_12_2025.pdf"
                    value={formValues.comprobante_pdf}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Goles equipo A</label>
                  <input
                    type="number"
                    name="goles_equipo_A"
                    className="form-control"
                    value={formValues.goles_equipo_A}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Goles equipo B</label>
                  <input
                    type="number"
                    name="goles_equipo_B"
                    className="form-control"
                    value={formValues.goles_equipo_B}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-3 d-flex align-items-end gap-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="equiposGenerados"
                      name="equipos_generados"
                      checked={formValues.equipos_generados}
                      onChange={handleChange}
                    />
                    <label htmlFor="equiposGenerados" className="form-check-label">
                      Equipos generados
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="votacionHabilitada"
                      name="votacion_habilitada"
                      checked={formValues.votacion_habilitada}
                      onChange={handleChange}
                    />
                    <label htmlFor="votacionHabilitada" className="form-check-label">
                      Votación habilitada
                    </label>
                  </div>
                </div>
                <div className="col-12 d-flex gap-3 flex-wrap">
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Guardando..." : editingId ? "Actualizar partido" : "Crear partido"}
                  </button>
                  <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
                    Limpiar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-body">
          <div className="d-flex flex-column flex-md-row justify-content-between gap-3 align-items-md-end mb-3">
            <div>
              <h2 className="h5 mb-1">Listado de partidos</h2>
              <p className="text-muted small mb-0">Filtra por estado, busca por lugar o fecha.</p>
            </div>
            <div className="d-flex flex-column flex-md-row gap-2 w-100 w-md-auto">
              <input
                type="text"
                name="search"
                placeholder="Buscar por lugar o fecha"
                className="form-control"
                value={filters.search}
                onChange={handleFilterChange}
              />
              <select name="estado" className="form-select" value={filters.estado} onChange={handleFilterChange}>
                {estados.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
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
                  <tr>
                    <td colSpan="6" className="text-center py-4">
                      Cargando...
                    </td>
                  </tr>
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
                          <div
                            className="progress"
                            role="progressbar"
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-valuenow={percent(partido.total_inscritos || 0, partido.max_jugadores)}
                          >
                            <div className="progress-bar" style={{ width: `${percent(partido.total_inscritos || 0, partido.max_jugadores)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge estado ${partido.estado}`}>{partido.estado}</span>
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button type="button" className="btn btn-outline-primary" onClick={() => handleEdit(partido)}>
                            Editar
                          </button>
                          <button type="button" className="btn btn-outline-secondary" onClick={() => handleDetalle(partido)}>
                            {detalleSeleccionado === partido.id ? "Ocultar" : "Detalle"}
                          </button>
                          <button type="button" className="btn btn-outline-danger" onClick={() => handleDelete(partido.id)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-4">
                      No hay partidos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between align-items-center mt-3">
            <p className="mb-0 text-muted small">
              Página {page} de {totalPages}
            </p>
            <div className="btn-group">
              <button type="button" className="btn btn-outline-secondary" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Anterior
              </button>
              <button type="button" className="btn btn-outline-secondary" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>
                Siguiente
              </button>
            </div>
          </div>

          {detalleSeleccionado && (
            <div className="card detalle-card mt-4">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <div>
                    <h3 className="h5 mb-1">Detalle del partido #{detalleSeleccionado}</h3>
                    <p className="text-muted small mb-0">Gestiona inscripciones, equipos y registro del partido.</p>
                  </div>
                  {detalleLoading && <span className="text-muted small">Cargando detalle…</span>}
                </div>
                {detalle && detalle.partido?.id === detalleSeleccionado ? (
                  <>
                    <div className="row g-4 detalle-sections">
                      <div className="col-12 col-xl-4 d-flex flex-column gap-3">
                        <PartidoResumenCard partido={detalle.partido} costo={detalle.costo_jugador} inscritos={detalle.jugadores.length} />
                        <InscripcionesPanel
                          jugadores={detalle.jugadores}
                          roster={teamRoster}
                          costoJugador={detalle.costo_jugador}
                          maxJugadores={detalle.partido?.max_jugadores}
                          loading={inscripcionLoading}
                          rosterLoading={rosterLoading}
                          onAdd={handleInscribirJugador}
                          onRemove={handleDesinscribirJugador}
                        />
                        <ListaEsperaPanel espera={detalle.espera} />
                      </div>
                      <div className="col-12 col-xl-8">
                        <PartidoLineup detalle={detalle} onSave={handleGuardarFormacion} />
                      </div>
                    </div>
                    <div className="row g-4 mt-1">
                      <div className="col-12 col-lg-4">
                        <SimpleListCard
                          title="Eventos"
                          items={detalle.eventos}
                          emptyText="Sin eventos registrados"
                          getKey={(item) => `event-${item.id}`}
                          renderItem={(ev) => (
                            <div className="d-flex flex-column">
                              <div className="fw-semibold text-capitalize">{ev.tipo}</div>
                              <small className="text-muted">
                                {ev.jugador_nombre}
                                {ev.asistente_nombre && ` · asist. ${ev.asistente_nombre}`}
                                {ev.minuto && ` · ${ev.minuto}'`}
                              </small>
                            </div>
                          )}
                        />
                      </div>
                      <div className="col-12 col-lg-4">
                        <SimpleListCard
                          title="Comentarios"
                          items={detalle.comentarios}
                          emptyText="Sin comentarios"
                          getKey={(item) => `coment-${item.id}`}
                          renderItem={(c) => (
                            <div>
                              <div className="fw-semibold">{c.nombre}</div>
                              <small className="text-muted">{c.comentario}</small>
                            </div>
                          )}
                        />
                      </div>
                      <div className="col-12 col-lg-4">
                        <SimpleListCard
                          title="Ratings & Votos"
                          items={[
                            ...detalle.ratings.map((r) => ({ ...r, __type: "rating" })),
                            ...detalle.votos_categorias.map((v) => ({ ...v, __type: "categoria" })),
                            ...detalle.votos_mvp.map((v) => ({ ...v, __type: "mvp" })),
                          ]}
                          emptyText="Sin datos registrados"
                          getKey={(item) => `${item.__type}-${item.id}`}
                          renderItem={(item) => {
                            if (item.__type === "rating") {
                              return (
                                <div>
                                  <div className="fw-semibold">{item.evaluador_nombre} → {item.evaluado_nombre}</div>
                                  <small className="text-muted">Rating {item.rating}</small>
                                </div>
                              );
                            }
                            if (item.__type === "categoria") {
                              return (
                                <div>
                                  <div className="fw-semibold">{item.categoria}</div>
                                  <small className="text-muted">
                                    {item.votado_nombre} · por {item.votante_nombre}
                                  </small>
                                </div>
                              );
                            }
                            return (
                              <div>
                                <div className="fw-semibold">MVP</div>
                                <small className="text-muted">{item.votado_nombre} · por {item.votante_nombre}</small>
                              </div>
                            );
                          }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  !detalleLoading && <p className="text-muted mb-0">No hay detalle para mostrar.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PartidoResumenCard({ partido, costo, inscritos }) {
  if (!partido) return null;
  const cupoTexto = partido.max_jugadores ? `${inscritos}/${partido.max_jugadores}` : `${inscritos}`;
  return (
    <div className="card panel-soft">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <div className="text-muted small">Fecha</div>
            <div className="fw-semibold">{formatDate(partido.fecha_hora)}</div>
          </div>
          <span className={`badge estado ${partido.estado}`}>{partido.estado}</span>
        </div>
        <div className="mb-2">
          <div className="text-muted small">Lugar</div>
          <div className="fw-semibold">{partido.lugar_nombre}</div>
          {partido.lugar_enlace_maps && (
            <a href={partido.lugar_enlace_maps} target="_blank" rel="noreferrer" className="small">
              Ver mapa ↗
            </a>
          )}
        </div>
        <div className="d-flex flex-wrap gap-2 mb-2">
          <span className="badge text-bg-light text-dark">{partido.tipo_partido}</span>
          <span className="badge text-bg-light text-dark">{partido.modalidad_juego?.toUpperCase()}</span>
          <span className="badge text-bg-light text-dark">{partido.metodo_generacion}</span>
        </div>
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <div className="text-muted small">Inscritos</div>
            <div className="fw-semibold">{cupoTexto}</div>
          </div>
          {costo && (
            <div className="text-end">
              <div className="text-muted small">Costo estimado</div>
              <div className="fw-semibold">€{Number(costo).toFixed(2)} / jugador</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InscripcionesPanel({ jugadores, roster, costoJugador, maxJugadores, loading, rosterLoading, onAdd, onRemove }) {
  const [selected, setSelected] = useState("");
  const disponibles = useMemo(
    () => roster.filter((p) => !jugadores.some((j) => Number(j.id) === Number(p.id))),
    [roster, jugadores]
  );

  const handleAdd = () => {
    if (!selected) return;
    onAdd(Number(selected));
    setSelected("");
  };

  return (
    <div className="card panel-soft">
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <div className="fw-semibold">
            Inscripciones ({jugadores.length}
            {maxJugadores ? `/${maxJugadores}` : ""})
          </div>
          {costoJugador && <small className="text-muted">€{Number(costoJugador).toFixed(2)} por jugador</small>}
        </div>
      </div>
      <div className="card-body">
        <div className="d-flex gap-2 mb-3">
          <select
            className="form-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={loading || rosterLoading || !disponibles.length}
          >
            <option value="">Selecciona jugador</option>
            {disponibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.apodo || p.nombre}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="button" onClick={handleAdd} disabled={!selected || loading}>
            Agregar
          </button>
        </div>
        <div className="inscritos-table">
          {jugadores.length ? (
            jugadores.map((j) => (
              <div key={j.id} className="inscrito-row">
                <div>
                  <div className="fw-semibold">{j.nombre}</div>
                  <small className="text-muted">
                    Equipo {j.equipo || "-"} · Rating {Number(j.rating_habilidad ?? 0).toFixed(1)}
                  </small>
                </div>
                <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => onRemove(j.id)} disabled={loading}>
                  Quitar
                </button>
              </div>
            ))
          ) : (
            <div className="text-muted small">Aún no hay jugadores registrados.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ListaEsperaPanel({ espera }) {
  return (
    <div className="card panel-soft">
      <div className="card-header fw-semibold">Lista de espera ({espera.length})</div>
      <div className="card-body">
        {espera.length ? (
          <ul className="detalle-list mb-0">
            {espera.map((item) => (
              <li key={item.id}>
                <div className="fw-semibold">{item.nombre}</div>
                <small className="text-muted">{new Date(item.fecha_registro).toLocaleString()}</small>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-muted small">Sin jugadores en espera.</div>
        )}
      </div>
    </div>
  );
}

function SimpleListCard({ title, items = [], emptyText, renderItem, getKey }) {
  return (
    <div className="card panel-soft h-100">
      <div className="card-header fw-semibold">{title}</div>
      <div className="card-body">
        {items.length ? (
          <ul className="detalle-list mb-0">
            {items.map((item, idx) => (
              <li key={getKey ? getKey(item, idx) : idx}>{renderItem(item)}</li>
            ))}
          </ul>
        ) : (
          <div className="text-muted small">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

export default PartidosDashboard;

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

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const toDatetimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const percent = (value, total) => {
  if (!total) return 0;
  return Math.min(100, Math.round(((Number(value) || 0) / Number(total)) * 100));
};

const jugadorId = (jugador) => Number(jugador?.jugador_id ?? jugador?.id_jugador ?? jugador?.id ?? 0);

const RIVAL_OPTION_VALUE = "__rival__";
const VOTACION_CATEGORIAS = ["regateador", "atacante", "pasador", "defensa", "portero"];

const normalizeRatingInput = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const normalized = String(value).replace(/,/g, ".").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const createEventoFormState = () => ({
  tipo: "gol",
  equipo: "A",
  id_jugador: "",
  id_asistente: "",
  minuto: "",
  es_rival: false,
});

const normalizeDetalle = (raw) => ({
  ...raw,
  jugadores: (raw?.jugadores || []).map((jugador) => ({
    ...jugador,
    jugador_id: jugadorId(jugador),
  })),
});

function PartidosDashboard({ user, currentTeam }) {
  const userId = user?.id ?? null;
  const globalRole = user?.rol_global ?? user?.rol ?? "usuario";
  const currentTeamId = currentTeam?.id ?? null;
  const responsableDefault = currentTeam?.id_responsable_alquiler ?? "";
  const isAdmin = globalRole === "admin";

  const [message, setMessage] = useState({ type: "", text: "" });
  const [filters, setFilters] = useState({ estado: "todos", search: "" });
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formValues, setFormValues] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detalleSeleccionado, setDetalleSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [teamRoster, setTeamRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [inscripcionLoading, setInscripcionLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatMeta, setChatMeta] = useState({ open: false, close: null });
  const [categoriaSelections, setCategoriaSelections] = useState({});
  const [mvpSelection, setMvpSelection] = useState("");
  const [votacionSending, setVotacionSending] = useState(false);
  const [managerRatings, setManagerRatings] = useState({});
  const [managerRatingsSending, setManagerRatingsSending] = useState(false);

  const canManagePartidos = useMemo(() => Boolean(isAdmin || currentTeam?.mi_rol === "manager"), [isAdmin, currentTeam]);
  const pageLimit = 10;

  const resetForm = useCallback(() => {
    setEditingId(null);
    setFormValues({
      ...emptyForm,
      id_responsable_alquiler: responsableDefault || "",
    });
  }, [responsableDefault]);

  useEffect(() => {
    if (!message.text) return;
    const timeout = setTimeout(() => setMessage({ type: "", text: "" }), 4000);
    return () => clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    setFormValues((prev) => ({
      ...prev,
      id_responsable_alquiler: prev.id_responsable_alquiler || responsableDefault || "",
    }));
  }, [responsableDefault]);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const loadPartidos = useCallback(async () => {
    if (!currentTeamId) {
      setPartidos([]);
      setStats(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: "partidos_listar",
        id_equipo: String(currentTeamId),
        page: String(page),
        limit: String(pageLimit),
        with_stats: "1",
      });
      if (filters.estado && filters.estado !== "todos") {
        params.append("estado", filters.estado);
      }
      if (filters.search?.trim()) {
        params.append("search", filters.search.trim());
      }
      const response = await fetch(`/api/index.php?${params.toString()}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudieron cargar los partidos");
      setPartidos(data.partidos || []);
      setTotalPages(data.totalPages || 1);
      setStats(data.stats || null);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }, [currentTeamId, page, filters.estado, filters.search]);

  const fetchRoster = useCallback(async () => {
    if (!currentTeamId) {
      setTeamRoster([]);
      return;
    }
    setRosterLoading(true);
    try {
      const response = await fetch(`/api/index.php?action=jugadores_equipo&id_equipo=${currentTeamId}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudo cargar la plantilla");
      setTeamRoster(data.jugadores || []);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setRosterLoading(false);
    }
  }, [currentTeamId]);

  const fetchDetalle = useCallback(async (idPartido) => {
    if (!idPartido) return;
    setDetalleLoading(true);
    try {
      const response = await fetch(`/api/index.php?action=partido_detalle&id=${idPartido}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudo cargar el detalle");
      setDetalle(normalizeDetalle(data));
      setCategoriaSelections({});
      setMvpSelection("");
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setDetalleLoading(false);
    }
  }, []);

  const fetchChat = useCallback(
    async (idPartido) => {
      const partidoId = idPartido ?? detalleSeleccionado;
      if (!partidoId) return;
      setChatLoading(true);
      try {
        const response = await fetch(`/api/index.php?action=partido_chat_listar&id_partido=${partidoId}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "No se pudo cargar el chat");
        setChatMessages(data.messages || []);
        setChatMeta({ open: Boolean(data.chat_open), close: data.chat_close || null });
      } catch (error) {
        setMessage({ type: "error", text: error.message });
      } finally {
        setChatLoading(false);
      }
    },
    [detalleSeleccionado]
  );

  const refreshDetalle = useCallback(async () => {
    if (!detalleSeleccionado) return;
    await fetchDetalle(detalleSeleccionado);
    await fetchChat(detalleSeleccionado);
  }, [detalleSeleccionado, fetchDetalle, fetchChat]);

  useEffect(() => {
    loadPartidos();
  }, [loadPartidos]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  useEffect(() => {
    if (!currentTeamId) {
      setPartidos([]);
      setStats(null);
      setDetalleSeleccionado(null);
      setDetalle(null);
      setChatMessages([]);
      setChatMeta({ open: false, close: null });
      setFilters({ estado: "todos", search: "" });
      setPage(1);
      setIsFormOpen(false);
      setCategoriaSelections({});
      setMvpSelection("");
      setVotacionSending(false);
      setChatInput("");
      resetForm();
      return;
    }
    setPage(1);
    setFilters({ estado: "todos", search: "" });
    setIsFormOpen(false);
    resetForm();
  }, [currentTeamId, resetForm]);

  useEffect(() => {
    if (!detalleSeleccionado) {
      setChatMessages([]);
      setChatMeta({ open: false, close: null });
      setChatInput("");
      return;
    }
    fetchChat(detalleSeleccionado);
  }, [detalleSeleccionado, fetchChat]);

  useEffect(() => {
    if (!detalle?.jugadores?.length) {
      setManagerRatings({});
      return;
    }
    const ownRatings = {};
    if (userId && detalle?.ratings?.length) {
      detalle.ratings.forEach((entry) => {
        if (Number(entry.id_evaluador) === Number(userId)) {
          const evaluadoId = Number(entry.id_evaluado);
          if (evaluadoId > 0) {
            const numericRating = Number(entry.rating ?? 0);
            ownRatings[evaluadoId] = Number.isFinite(numericRating) ? numericRating.toFixed(1) : "";
          }
        }
      });
    }
    const nextState = {};
    detalle.jugadores.forEach((jugador) => {
      const id = jugadorId(jugador);
      if (id > 0) {
        nextState[id] = ownRatings[id] ?? "";
      }
    });
    setManagerRatings(nextState);
  }, [detalle, userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentTeamId || !userId) {
      setMessage({ type: "error", text: "Selecciona un equipo antes de gestionar partidos" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...formValues,
        id_equipo: currentTeamId,
        id_usuario: userId,
        rol_global: globalRole,
        max_jugadores: Number(formValues.max_jugadores) || 0,
        precio_total_pista: formValues.precio_total_pista === "" ? null : Number(formValues.precio_total_pista),
        id_responsable_alquiler: formValues.id_responsable_alquiler ? Number(formValues.id_responsable_alquiler) : null,
        goles_equipo_A: Number(formValues.goles_equipo_A) || 0,
        goles_equipo_B: Number(formValues.goles_equipo_B) || 0,
        equipos_generados: Boolean(formValues.equipos_generados),
        votacion_habilitada: Boolean(formValues.votacion_habilitada),
      };
      const action = editingId ? "partido_actualizar" : "partido_crear";
      if (editingId) {
        payload.id = editingId;
      }
      const response = await fetch(`/api/index.php?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudo guardar el partido");
      setMessage({ type: "success", text: editingId ? "Partido actualizado" : "Partido creado" });
      resetForm();
      setIsFormOpen(false);
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
        body: JSON.stringify({ id, id_usuario: userId, rol_global: globalRole }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudo eliminar");
      setMessage({ type: "success", text: "Partido eliminado" });
      if (detalleSeleccionado === id) {
        setDetalleSeleccionado(null);
        setDetalle(null);
        setChatMessages([]);
        setChatMeta({ open: false, close: null });
        setChatInput("");
        setCategoriaSelections({});
        setMvpSelection("");
        setVotacionSending(false);
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
        setChatMessages([]);
        setChatMeta({ open: false, close: null });
        setChatInput("");
        setCategoriaSelections({});
        setMvpSelection("");
        setVotacionSending(false);
        return;
      }
      setDetalleSeleccionado(partido.id);
      setDetalle(null);
      setCategoriaSelections({});
      setMvpSelection("");
      setVotacionSending(false);
      fetchDetalle(partido.id);
      fetchChat(partido.id);
    },
    [detalleSeleccionado, fetchDetalle, fetchChat]
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
        body: JSON.stringify({
          id_partido: detalleSeleccionado,
          id_jugador: jugadorId,
          id_usuario: userId,
          rol_global: globalRole,
        }),
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
        body: JSON.stringify({
          id_partido: detalleSeleccionado,
          id_jugador: jugadorId,
          id_usuario: userId,
          rol_global: globalRole,
        }),
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
      body: JSON.stringify({ id_partido: detalleSeleccionado, id_usuario: userId, rol_global: globalRole, ...payload }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "No se pudo guardar la formación");
    await refreshDetalle();
  };

  const handleSendChat = async () => {
    if (!detalleSeleccionado || !chatInput.trim()) return;
    setChatSending(true);
    try {
      const response = await fetch(`/api/index.php?action=partido_chat_publicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_partido: detalleSeleccionado,
          id_usuario: userId,
          rol_global: globalRole,
          mensaje: chatInput.trim(),
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudo enviar el mensaje");
      setChatInput("");
      await fetchChat();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setChatSending(false);
    }
  };

  const handleActivarVotacion = async () => {
    if (!detalleSeleccionado) return;
    try {
      const response = await fetch(`/api/index.php?action=partido_activar_votacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_partido: detalleSeleccionado, id_usuario: userId, rol_global: globalRole }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "No se pudo habilitar la votación");
      setMessage({ type: "success", text: "Votaciones habilitadas" });
      await refreshDetalle();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const handleRegistrarEvento = async (payload) => {
    if (!detalleSeleccionado) throw new Error("Selecciona un partido antes de añadir eventos");
    const response = await fetch(`/api/index.php?action=partido_registrar_evento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_partido: detalleSeleccionado, id_usuario: userId, rol_global: globalRole, ...payload }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "No se pudo registrar el evento");
    setMessage({ type: "success", text: "Evento registrado" });
    await refreshDetalle();
  };

  const handleEliminarEvento = async (eventoId) => {
    if (!detalleSeleccionado) return;
    const response = await fetch(`/api/index.php?action=partido_eliminar_evento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_partido: detalleSeleccionado, id_evento: eventoId, id_usuario: userId, rol_global: globalRole }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "No se pudo eliminar el evento");
    setMessage({ type: "success", text: "Evento eliminado" });
    await refreshDetalle();
  };

  const handleEnviarVotos = async () => {
    if (!detalleSeleccionado) return;
    const categoriasSeleccionadas = VOTACION_CATEGORIAS.filter((categoria) => categoriaSelections[categoria]);
    const incluyeMvp = Boolean(mvpSelection);
    if (!categoriasSeleccionadas.length && !incluyeMvp) {
      setMessage({ type: "error", text: "Selecciona al menos un voto para enviar" });
      return;
    }
    setVotacionSending(true);
    try {
      for (const categoria of categoriasSeleccionadas) {
        const idVotado = Number(categoriaSelections[categoria]);
        if (!idVotado) {
          continue;
        }
        const response = await fetch(`/api/index.php?action=partido_votar_categoria`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_partido: detalleSeleccionado,
            id_usuario: userId,
            rol_global: globalRole,
            id_votado: idVotado,
            categoria,
          }),
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || `No se pudo registrar el voto de ${categoria}`);
        }
      }

      if (incluyeMvp) {
        const response = await fetch(`/api/index.php?action=partido_votar_mvp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_partido: detalleSeleccionado,
            id_usuario: userId,
            rol_global: globalRole,
            id_votado: Number(mvpSelection),
          }),
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || "No se pudo registrar el MVP");
        }
      }

      setMessage({ type: "success", text: "Votos registrados" });
      setCategoriaSelections({});
      setMvpSelection("");
      await refreshDetalle();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setVotacionSending(false);
    }
  };

  const handleManagerRatingChange = (idJugador, value) => {
    setManagerRatings((prev) => ({ ...prev, [idJugador]: value }));
  };

  const handleGuardarRatings = async () => {
    if (!detalleSeleccionado || !detalle?.jugadores?.length) {
      return;
    }
    const payload = [];
    for (const jugador of detalle.jugadores) {
      const id = jugadorId(jugador);
      if (id <= 0) {
        continue;
      }
      const parsed = normalizeRatingInput(managerRatings[id]);
      if (parsed === null || parsed < 1 || parsed > 10) {
        setMessage({ type: "error", text: "Debes asignar una nota entre 1 y 10 a todos los jugadores" });
        return;
      }
      payload.push({ id_jugador: id, rating: Number(parsed.toFixed(2)) });
    }
    if (!payload.length) {
      setMessage({ type: "error", text: "No hay jugadores para calificar" });
      return;
    }
    setManagerRatingsSending(true);
    try {
      const response = await fetch(`/api/index.php?action=partido_calificar_jugadores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_partido: detalleSeleccionado,
          id_usuario: userId,
          rol_global: globalRole,
          ratings: payload,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "No se pudieron guardar las notas");
      }
      setMessage({ type: "success", text: "Notas guardadas" });
      await refreshDetalle();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setManagerRatingsSending(false);
    }
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

  const jugadorActualInscrito = useMemo(() => {
    if (!detalle?.jugadores || !userId) return false;
    return detalle.jugadores.some((j) => jugadorId(j) === Number(userId));
  }, [detalle, userId]);

  const jugadoresDetalle = detalle?.jugadores ?? [];
  const perteneceEquipo = Boolean(currentTeam?.mi_rol);
  const votacionModo = detalle?.votacion_config?.[0]?.modo ?? "todos";
  const puedeVotar = Boolean(detalle?.partido?.votacion_habilitada) && Boolean(userId) && (isAdmin || canManagePartidos || (votacionModo !== "manager" && jugadorActualInscrito));
  const puedeParticiparChat = chatMeta.open && Boolean(userId) && (isAdmin || canManagePartidos || jugadorActualInscrito || perteneceEquipo);
  const puedeCalificarJugadores = Boolean(
    canManagePartidos &&
      detalle?.partido?.estado === "completado" &&
      detalle?.partido?.votacion_habilitada &&
      jugadoresDetalle.length
  );
  const managerRatingIssues = useMemo(() => {
    if (!puedeCalificarJugadores) {
      return jugadoresDetalle.length;
    }
    return jugadoresDetalle.reduce((acc, jugador) => {
      const id = jugadorId(jugador);
      if (id <= 0) {
        return acc + 1;
      }
      const parsed = normalizeRatingInput(managerRatings[id]);
      if (parsed === null || parsed < 1 || parsed > 10) {
        return acc + 1;
      }
      return acc;
    }, 0);
  }, [jugadoresDetalle, puedeCalificarJugadores, managerRatings]);

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
                  <th>Costo estimado</th>
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
                      <td>
                        {partido.costo_jugador !== null && partido.costo_jugador !== undefined ? (
                          <div>
                            <div className="fw-semibold">€{Number(partido.costo_jugador).toFixed(2)}</div>
                            <small className="text-muted text-capitalize">
                              {partido.tipo_partido === 'externo' ? 'Partido externo' : 'Partido interno'}
                            </small>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          {canManagePartidos && (
                            <button type="button" className="btn btn-outline-primary" onClick={() => handleEdit(partido)}>
                              Editar
                            </button>
                          )}
                          <button type="button" className="btn btn-outline-secondary" onClick={() => handleDetalle(partido)}>
                            {detalleSeleccionado === partido.id ? "Ocultar" : "Detalle"}
                          </button>
                          {canManagePartidos && (
                            <button type="button" className="btn btn-outline-danger" onClick={() => handleDelete(partido.id)}>
                              Eliminar
                            </button>
                          )}
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
                        {canManagePartidos && detalle.partido?.estado === 'completado' && !detalle.partido?.votacion_habilitada && (
                          <button type="button" className="btn btn-sm btn-warning" onClick={handleActivarVotacion}>
                            Habilitar votaciones
                          </button>
                        )}
                        <InscripcionesPanel
                          jugadores={detalle.jugadores}
                          roster={teamRoster}
                          costoJugador={detalle.costo_jugador}
                          maxJugadores={detalle.partido?.max_jugadores}
                          tipoPartido={detalle.partido?.tipo_partido}
                          loading={inscripcionLoading}
                          rosterLoading={rosterLoading}
                          onAdd={handleInscribirJugador}
                          onRemove={handleDesinscribirJugador}
                          canManage={canManagePartidos}
                          currentUserId={userId}
                        />
                        <ListaEsperaPanel espera={detalle.espera} />
                      </div>
                      <div className="col-12 col-xl-8">
                        <PartidoLineup detalle={detalle} onSave={canManagePartidos ? handleGuardarFormacion : null} canEdit={canManagePartidos} />
                      </div>
                    </div>
                    <div className="row g-4 mt-1">
                      <div className="col-12 col-xl-4">
                        <EventosPanel
                          eventos={detalle.eventos}
                          jugadores={detalle.jugadores}
                          onAdd={handleRegistrarEvento}
                          onDelete={handleEliminarEvento}
                          canManage={canManagePartidos}
                          estado={detalle.partido?.estado}
                        />
                      </div>
                      <div className="col-12 col-xl-4">
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
                      <div className="col-12 col-xl-4">
                        <RatingsOverview
                          ratings={detalle.ratings}
                          votosCategorias={detalle.votos_categorias}
                          votosMvp={detalle.votos_mvp}
                        />
                      </div>
                    </div>
                    <div className="row g-4 mt-1">
                      <div className="col-12 col-xl-6">
                        <PartidoChatPanel
                          messages={chatMessages}
                          loading={chatLoading}
                          chatOpen={chatMeta.open}
                          chatClose={chatMeta.close}
                          input={chatInput}
                          sending={chatSending}
                          onInputChange={setChatInput}
                          onSend={handleSendChat}
                          canSend={puedeParticiparChat}
                        />
                      </div>
                      <div className="col-12 col-xl-6 d-flex flex-column gap-3">
                        <VotacionPanel
                          jugadores={detalle.jugadores}
                          enabled={Boolean(detalle.partido?.votacion_habilitada)}
                          modo={votacionModo}
                          puedeVotar={puedeVotar}
                          selections={categoriaSelections}
                          onSelectionChange={setCategoriaSelections}
                          mvpSelection={mvpSelection}
                          onMvpSelectionChange={setMvpSelection}
                          onEnviarVotos={handleEnviarVotos}
                          votacionSending={votacionSending}
                          votosCategorias={detalle.votos_categorias}
                          votosMvp={detalle.votos_mvp}
                        />
                        {puedeCalificarJugadores && (
                          <ManagerRatingsPanel
                            jugadores={detalle.jugadores}
                            ratings={managerRatings}
                            onRatingChange={handleManagerRatingChange}
                            onGuardar={handleGuardarRatings}
                            submitting={managerRatingsSending}
                            pendientes={managerRatingIssues}
                          />
                        )}
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
  const costoDisponible = costo !== null && costo !== undefined;
  const costoDetalle = partido.tipo_partido === "externo" ? "Se reparte entre ambos equipos." : "Se reparte entre los inscritos.";
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
          {costoDisponible && (
            <div className="text-end">
              <div className="text-muted small">Costo estimado</div>
              <div className="fw-semibold">€{Number(costo).toFixed(2)} / jugador</div>
              <small className="text-muted">{costoDetalle}</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InscripcionesPanel({ jugadores, roster, costoJugador, maxJugadores, loading, rosterLoading, onAdd, onRemove, canManage, currentUserId, tipoPartido = "interno" }) {
  const [selected, setSelected] = useState("");
  const disponibles = useMemo(
    () => roster.filter((p) => !jugadores.some((j) => jugadorId(j) === Number(p.id))),
    [roster, jugadores]
  );
  const costoDisponible = costoJugador !== null && costoJugador !== undefined;
  const tipoDescripcion = tipoPartido === "externo" ? "Partido externo" : "Partido interno";
  const isSelfInscrito = currentUserId ? jugadores.some((j) => jugadorId(j) === Number(currentUserId)) : false;

  const handleSelfToggle = () => {
    if (!currentUserId) return;
    if (isSelfInscrito) {
      onRemove(currentUserId);
    } else {
      onAdd(currentUserId);
    }
  };

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
          {costoDisponible && (
            <small className="text-muted d-block">
              €{Number(costoJugador).toFixed(2)} por jugador · {tipoDescripcion}
            </small>
          )}
        </div>
      </div>
      <div className="card-body">
        {canManage ? (
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
        ) : (
          currentUserId && (
            <div className="d-flex gap-2 mb-3">
              <button
                className={`btn ${isSelfInscrito ? "btn-outline-danger" : "btn-primary"}`}
                type="button"
                onClick={handleSelfToggle}
                disabled={loading}
              >
                {isSelfInscrito ? "Salir del partido" : "Inscribirme"}
              </button>
            </div>
          )
        )}
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
                {(canManage || jugadorId(j) === Number(currentUserId)) && (
                  <button
                    className="btn btn-sm btn-outline-danger"
                    type="button"
                    onClick={() => onRemove(jugadorId(j))}
                    disabled={loading}
                  >
                    {jugadorId(j) === Number(currentUserId) ? "Salir" : "Quitar"}
                  </button>
                )}
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

function EventosPanel({ eventos = [], jugadores = [], onAdd, onDelete, canManage, estado }) {
  const [form, setForm] = useState(() => createEventoFormState());
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  const estadoPermiteEventos = ["en_curso", "completado"].includes(estado);
  const jugadorOptions = jugadores.map((j) => ({ value: jugadorId(j), label: j.apodo || j.nombre }));
  const selectOptions = [...jugadorOptions, { value: RIVAL_OPTION_VALUE, label: "Jugador rival" }];
  const rivalSeleccionado = Boolean(form.es_rival);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "id_jugador") {
      if (value === RIVAL_OPTION_VALUE) {
        setForm((prev) => ({ ...prev, id_jugador: value, es_rival: true, id_asistente: "" }));
      } else {
        setForm((prev) => ({ ...prev, id_jugador: value, es_rival: false }));
      }
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.es_rival && !form.id_jugador) {
      setLocalError("Selecciona un jugador");
      return;
    }
    setSubmitting(true);
    setLocalError("");
    try {
      const payload = {
        tipo: form.tipo,
        equipo: form.equipo,
        minuto: form.minuto ? Number(form.minuto) : null,
        id_asistente: !form.es_rival && form.id_asistente ? Number(form.id_asistente) : null,
        id_jugador: form.es_rival ? null : Number(form.id_jugador),
      };
      if (form.es_rival) {
        payload.es_rival = true;
      }
      await onAdd(payload);
      setForm(createEventoFormState());
    } catch (error) {
      setLocalError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await onDelete(id);
    } catch (error) {
      setLocalError(error.message);
    }
  };

  return (
    <div className="card panel-soft h-100">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span className="fw-semibold">Eventos</span>
        {estado && <small className="text-muted text-capitalize">Estado: {estado.replace("_", " ")}</small>}
      </div>
      <div className="card-body d-flex flex-column gap-3">
        {canManage && estadoPermiteEventos ? (
          <form className="row g-2" onSubmit={handleSubmit}>
            <div className="col-6">
              <label className="form-label small mb-1">Tipo</label>
              <select className="form-select" name="tipo" value={form.tipo} onChange={handleChange}>
                <option value="gol">Gol</option>
                <option value="autogol">Autogol</option>
                <option value="tarjeta_amarilla">Tarjeta amarilla</option>
                <option value="tarjeta_roja">Tarjeta roja</option>
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small mb-1">Equipo</label>
              <select className="form-select" name="equipo" value={form.equipo} onChange={handleChange}>
                <option value="A">Equipo A</option>
                <option value="B">Equipo B</option>
              </select>
            </div>
            <div className="col-12">
              <label className="form-label small mb-1">Jugador</label>
              <select className="form-select" name="id_jugador" value={form.id_jugador} onChange={handleChange}>
                <option value="">Selecciona jugador</option>
                {selectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <small className="text-muted">Usa "Jugador rival" si no conoces su nombre.</small>
            </div>
            <div className="col-12">
              <label className="form-label small mb-1">Asistente (opcional)</label>
              <select className="form-select" name="id_asistente" value={form.id_asistente} onChange={handleChange} disabled={rivalSeleccionado}>
                <option value="">Sin asistente</option>
                {jugadorOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {rivalSeleccionado && <small className="text-muted d-block">Los rivales no admiten asistente.</small>}
            </div>
            <div className="col-6">
              <label className="form-label small mb-1">Minuto</label>
              <input type="number" min="0" max="120" name="minuto" className="form-control" value={form.minuto} onChange={handleChange} />
            </div>
            <div className="col-6 d-flex align-items-end">
              <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
                {submitting ? "Guardando..." : "Registrar"}
              </button>
            </div>
            {localError && (
              <div className="col-12">
                <div className="alert alert-danger py-2 mb-0">{localError}</div>
              </div>
            )}
          </form>
        ) : (
          <div className="alert alert-light border mb-0">Los eventos solo pueden registrarse por el manager cuando el partido está en curso o finalizado.</div>
        )}
        <div className="detalle-list flex-grow-1 overflow-auto">
          {eventos.length ? (
            eventos.map((ev) => (
              <div key={ev.id} className="d-flex justify-content-between align-items-start py-2 border-bottom">
                <div>
                  <div className="fw-semibold text-capitalize">{ev.tipo} · Equipo {ev.equipo}</div>
                  <small className="text-muted">
                    {ev.jugador_nombre}
                    {ev.asistente_nombre && ` · asist. ${ev.asistente_nombre}`}
                    {ev.minuto && ` · ${ev.minuto}'`}
                  </small>
                </div>
                {canManage && (
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(ev.id)}>
                    Borrar
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="text-muted small">Sin eventos registrados.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function PartidoChatPanel({ messages, loading, chatOpen, chatClose, input, onInputChange, onSend, sending, canSend }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSend();
  };
  const cierreDate = chatClose ? new Date(chatClose) : null;
  const cierreTexto = cierreDate && !Number.isNaN(cierreDate.getTime()) ? cierreDate.toLocaleString() : null;

  return (
    <div className="card panel-soft h-100 chat-panel">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span className="fw-semibold">Chat del partido</span>
        {cierreTexto && <small className="text-muted">Cierra: {cierreTexto}</small>}
      </div>
      <div className="card-body d-flex flex-column gap-3">
        <div className="chat-messages flex-grow-1">
          {loading ? (
            <div className="text-muted small">Cargando chat...</div>
          ) : messages.length ? (
            messages.map((msg) => (
              <div key={msg.id} className="chat-message">
                <div className="fw-semibold">{msg.apodo || msg.nombre || "Jugador"}</div>
                <small className="text-muted">{new Date(msg.fecha_creacion).toLocaleString()}</small>
                <p className="mb-0">{msg.comentario}</p>
              </div>
            ))
          ) : (
            <div className="text-muted small">Aún no hay mensajes.</div>
          )}
        </div>
        {chatOpen ? (
          canSend ? (
            <form className="d-flex gap-2" onSubmit={handleSubmit}>
              <input
                type="text"
                className="form-control"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Escribe un mensaje"
                disabled={sending}
              />
              <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>
                {sending ? "Enviando..." : "Enviar"}
              </button>
            </form>
          ) : (
            <div className="alert alert-warning py-2 mb-0">No tienes permisos para escribir en este chat.</div>
          )
        ) : (
          <div className="alert alert-secondary py-2 mb-0">El chat está cerrado para este partido.</div>
        )}
      </div>
    </div>
  );
}

function RatingsOverview({ ratings = [], votosCategorias = [], votosMvp = [] }) {
  const totalRatings = ratings.length;
  const promedioRating = totalRatings
    ? ratings.reduce((acc, item) => acc + Number(item.rating || 0), 0) / totalRatings
    : null;

  const categoriaStats = VOTACION_CATEGORIAS.map((categoria) => {
    const votos = votosCategorias.filter((v) => v.categoria === categoria);
    const porJugador = {};
    votos.forEach((voto) => {
      const key = voto.id_votado;
      if (!porJugador[key]) {
        porJugador[key] = {
          id: key,
          nombre: voto.votado_apodo || voto.votado_nombre || "Jugador",
          count: 0,
        };
      }
      porJugador[key].count += 1;
    });
    const ranking = Object.values(porJugador)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const maxCount = ranking[0]?.count ?? 0;
    const enrichedRanking = ranking.map((entry) => ({
      ...entry,
      percent: maxCount ? Math.round((entry.count / maxCount) * 100) : 0,
    }));
    return { categoria, total: votos.length, ranking: enrichedRanking };
  });

  const mvpRankingMap = {};
  votosMvp.forEach((voto) => {
    const key = voto.id_votado;
    if (!mvpRankingMap[key]) {
      mvpRankingMap[key] = {
        id: key,
        nombre: voto.votado_apodo || voto.votado_nombre || "Jugador",
        count: 0,
      };
    }
    mvpRankingMap[key].count += 1;
  });
  const mvpRankingBase = Object.values(mvpRankingMap).sort((a, b) => b.count - a.count).slice(0, 3);
  const mvpMax = mvpRankingBase[0]?.count ?? 0;
  const mvpRanking = mvpRankingBase.map((entry) => ({
    ...entry,
    percent: mvpMax ? Math.round((entry.count / mvpMax) * 100) : 0,
  }));

  const resumenCards = [
    { label: "Promedio rating", value: promedioRating !== null ? promedioRating.toFixed(1) : "—" },
    { label: "Ratings", value: totalRatings },
    { label: "Votos categorías", value: votosCategorias.length },
    { label: "Votos MVP", value: votosMvp.length },
  ];

  const ratingHistory = ratings.slice(0, 5);

  return (
    <div className="card panel-soft h-100">
      <div className="card-header fw-semibold">Rendimiento & votos</div>
      <div className="card-body d-flex flex-column gap-3">
        <div className="row g-2">
          {resumenCards.map((card) => (
            <div key={card.label} className="col-6">
              <div className="p-3 bg-light rounded-3 border h-100">
                <div className="text-muted small text-uppercase">{card.label}</div>
                <div className="fw-semibold fs-5">{card.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <h6 className="small text-uppercase text-muted mb-2">Votos por categoría</h6>
          {votosCategorias.length ? (
            categoriaStats.map((stat) => (
              <div key={`cat-${stat.categoria}`} className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-capitalize fw-semibold">{stat.categoria}</span>
                  <small className="text-muted">{stat.total} voto(s)</small>
                </div>
                {stat.ranking.length ? (
                  stat.ranking.map((entry) => (
                    <div key={`cat-${stat.categoria}-${entry.id}`} className="mb-1">
                      <div className="d-flex justify-content-between small">
                        <span>{entry.nombre}</span>
                        <span className="fw-semibold">{entry.count}</span>
                      </div>
                      <div className="progress bg-body-secondary" style={{ height: 6 }}>
                        <div className="progress-bar" role="progressbar" style={{ width: `${entry.percent}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted small">Sin votos registrados.</div>
                )}
              </div>
            ))
          ) : (
            <div className="text-muted small">Cuando lleguen votos se mostrarán los líderes de cada categoría.</div>
          )}
        </div>

        <div>
          <h6 className="small text-uppercase text-muted mb-2">MVP</h6>
          {votosMvp.length ? (
            mvpRanking.map((entry) => (
              <div key={`mvp-${entry.id}`} className="mb-2">
                <div className="d-flex justify-content-between small">
                  <span>{entry.nombre}</span>
                  <span className="fw-semibold">{entry.count}</span>
                </div>
                <div className="progress bg-body-secondary" style={{ height: 6 }}>
                  <div className="progress-bar bg-success" role="progressbar" style={{ width: `${entry.percent}%` }} />
                </div>
              </div>
            ))
          ) : (
            <div className="text-muted small">Sin votos MVP registrados.</div>
          )}
        </div>

        <div>
          <h6 className="small text-uppercase text-muted mb-2">Ratings recientes</h6>
          {ratingHistory.length ? (
            <ul className="detalle-list mb-0">
              {ratingHistory.map((item) => (
                <li key={`rating-${item.id}`} className="d-flex justify-content-between align-items-center gap-2">
                  <div>
                    <div className="fw-semibold">{item.evaluado_nombre}</div>
                    <small className="text-muted">
                      {item.evaluador_nombre} · {new Date(item.fecha_rating).toLocaleString()}
                    </small>
                  </div>
                  <span className="badge text-bg-primary">{Number(item.rating || 0).toFixed(1)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-muted small">Sin ratings registrados aún.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function VotacionPanel({
  jugadores = [],
  enabled,
  modo,
  puedeVotar,
  selections,
  onSelectionChange,
  mvpSelection,
  onMvpSelectionChange,
  onEnviarVotos,
  votacionSending,
  votosCategorias = [],
  votosMvp = [],
}) {
  const categorias = VOTACION_CATEGORIAS;
  const jugadorOptions = jugadores.map((j) => ({ value: jugadorId(j), label: j.apodo || j.nombre }));
  const resumenVotos = votosCategorias.reduce((acc, voto) => {
    acc[voto.categoria] = (acc[voto.categoria] || 0) + 1;
    return acc;
  }, {});
  const tieneSelecciones = categorias.some((categoria) => selections[categoria]) || Boolean(mvpSelection);

  const handleCategoriaChange = (categoria, value) => {
    onSelectionChange((prev) => ({ ...prev, [categoria]: value }));
  };

  return (
    <div className="card panel-soft h-100 votacion-panel">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span className="fw-semibold">Votaciones</span>
        <small className="text-muted">Modo: {modo === "manager" ? "Solo manager" : "Todos los jugadores"}</small>
      </div>
      <div className="card-body d-flex flex-column gap-3">
        {!enabled && <div className="alert alert-light border mb-0">Las votaciones se habilitarán una vez el manager las active.</div>}
        {enabled && (
          puedeVotar ? (
            <div className="d-flex flex-column gap-3">
              {categorias.map((categoria) => (
                <div key={categoria}>
                  <label className="form-label small mb-1 text-capitalize">{categoria}</label>
                  <select
                    className="form-select"
                    value={selections[categoria] ?? ""}
                    onChange={(e) => handleCategoriaChange(categoria, e.target.value)}
                    disabled={votacionSending}
                  >
                    <option value="">Selecciona jugador</option>
                    {jugadorOptions.map((opt) => (
                      <option key={`${categoria}-${opt.value}`} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div>
                <label className="form-label small mb-1">MVP</label>
                <select
                  className="form-select"
                  value={mvpSelection}
                  onChange={(e) => onMvpSelectionChange(e.target.value)}
                  disabled={votacionSending}
                >
                  <option value="">Selecciona jugador</option>
                  {jugadorOptions.map((opt) => (
                    <option key={`mvp-${opt.value}`} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!tieneSelecciones || votacionSending}
                  onClick={onEnviarVotos}
                >
                  {votacionSending ? "Enviando..." : "Enviar votos"}
                </button>
              </div>
            </div>
          ) : (
            <div className="alert alert-warning mb-0">No tienes permisos para votar en este partido.</div>
          )
        )}
        <div>
          <h6 className="small text-uppercase text-muted mb-2">Resumen</h6>
          {enabled ? (
            <ul className="detalle-list mb-0">
              {categorias.map((categoria) => (
                <li key={`res-${categoria}`} className="d-flex justify-content-between">
                  <span className="text-capitalize">{categoria}</span>
                  <span className="fw-semibold">{resumenVotos[categoria] ?? 0}</span>
                </li>
              ))}
              <li className="d-flex justify-content-between">
                <span>MVP</span>
                <span className="fw-semibold">{votosMvp.length}</span>
              </li>
            </ul>
          ) : (
            <div className="text-muted small">Aún no hay votos.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ManagerRatingsPanel({ jugadores = [], ratings = {}, onRatingChange, onGuardar, submitting, pendientes = 0 }) {
  return (
    <div className="card panel-soft h-100">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span className="fw-semibold">Notas del manager</span>
        <small className="text-muted">Escala 1 - 10</small>
      </div>
      <div className="card-body d-flex flex-column gap-3">
        {jugadores.length ? (
          <div className="d-flex flex-column gap-2">
            {jugadores.map((jugador) => {
              const id = jugadorId(jugador);
              const value = ratings[id] ?? "";
              return (
                <div key={`manager-rating-${id}`} className="d-flex align-items-center gap-2">
                  <div className="flex-grow-1">
                    <div className="fw-semibold">{jugador.apodo || jugador.nombre}</div>
                    <small className="text-muted">Equipo {jugador.equipo || "-"}</small>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    className="form-control w-auto"
                    value={value}
                    onChange={(e) => onRatingChange(id, e.target.value)}
                    disabled={submitting}
                    aria-label={`Nota para ${jugador.apodo || jugador.nombre}`}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-muted small">Sin jugadores para calificar.</div>
        )}
        {jugadores.length > 0 && (
          <div className="d-flex flex-column flex-md-row justify-content-between gap-2 align-items-md-center">
            <small className={pendientes ? "text-danger" : "text-muted"}>
              {pendientes ? `${pendientes} jugador(es) sin nota válida` : "Todos los jugadores tienen nota"}
            </small>
            <button type="button" className="btn btn-success" onClick={onGuardar} disabled={submitting || pendientes > 0}>
              {submitting ? "Guardando..." : "Guardar notas"}
            </button>
          </div>
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

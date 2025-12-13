import { useEffect, useMemo, useState } from "react";
import "../css/pages/Plantilla.css";

const FORMATIONS = {
  "11": [
    { value: "4-3-3", lines: [4, 3, 3] },
    { value: "4-4-2", lines: [4, 4, 2] },
    // { value: "5-3-2", lines: [5, 3, 2] },
  ],
  "7": [
    { value: "2-3-1", lines: [2, 3, 1] },
    { value: "3-2-1", lines: [3, 2, 1] },
    { value: "2-2-2", lines: [2, 2, 2] },
  ],
  "5": [
    { value: "2-2", lines: [2, 2] },
    { value: "3-1", lines: [3, 1] },
    { value: "1-2-1", lines: [1, 2, 1] },
  ],
};

const SET_PIECES = [
  { key: "penales", label: "Penales" },
  { key: "faltas", label: "Tiros libres" },
  { key: "corner_izq", label: "Córners Izq" },
  { key: "corner_der", label: "Córners Der" },
];

function shortName(p) {
  if (!p) return "";
  const name = p.apodo || p.nombre || "Jugador";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 10);
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

function Plantilla({ user, currentTeam }) {
  const teamId = currentTeam?.id || "sin-equipo";

  const [mode, setMode] = useState("11"); // "11" | "7" | "5"
  const [formation, setFormation] = useState(FORMATIONS["11"][0].value);
  const [players, setPlayers] = useState([]); // lista completa disponible
  const [assignments, setAssignments] = useState({}); // slotId -> playerId
  const [setPieces, setSetPieces] = useState({ penales: null, faltas: null, corner_izq: null, corner_der: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveMsg, setSaveMsg] = useState({ type: null, text: "" });

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(""), 4500);
    return () => clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if (!saveMsg?.text) return;
    const timeout = setTimeout(() => setSaveMsg({ type: null, text: "" }), 4000);
    return () => clearTimeout(timeout);
  }, [saveMsg]);

  // Cargar jugadores del equipo actual y estado guardado
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        if (currentTeam?.id) {
          const res = await fetch(`/api/index.php?action=jugadores_equipo&id_equipo=${currentTeam.id}`);
          const data = await res.json();
          if (!ignore) {
            if (data.success && Array.isArray(data.jugadores)) {
              setPlayers(
                data.jugadores.map((d) => ({
                  id: d.id,
                  nombre: d.nombre,
                  apodo: d.apodo,
                  rating: d.rating_habilidad,
                  dorsal: d.dorsal,
                  rol_en_equipo: d.rol_en_equipo,
                }))
              );
            } else {
              setPlayers([]);
            }
          }
        } else {
          // Sin equipo seleccionado
          if (!ignore) setPlayers([]);
        }
      } catch (e) {
        if (!ignore) setError("No se pudo cargar jugadores del equipo");
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();

    return () => (ignore = true);
  }, [currentTeam?.id]);

  // Cargar formación y balón parado desde backend (fallback a localStorage si no hay)
  useEffect(() => {
    const load = async () => {
      // Fallback local
      const key = `furbo_formacion_${teamId}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved.mode) setMode(saved.mode);
          if (saved.formation) setFormation(saved.formation);
          if (saved.assignments) setAssignments(saved.assignments);
          if (saved.setPieces) setSetPieces(saved.setPieces);
        } catch (_) {}
      }

      // Backend: formación
      if (currentTeam?.id) {
        try {
          const r1 = await fetch(`/api/index.php?action=get_plantilla_equipo&id_equipo=${currentTeam.id}`);
          const d1 = await r1.json();
          if (d1.success && d1.plantilla) {
            if (d1.plantilla.mode) setMode(d1.plantilla.mode);
            if (d1.plantilla.formation) setFormation(d1.plantilla.formation);
            if (d1.plantilla.assignments) setAssignments(d1.plantilla.assignments);
          }
        } catch (_) {}

        // Backend: balón parado desde datos del equipo
        try {
          const r2 = await fetch(`/api/index.php?action=get_equipo&id=${currentTeam.id}`);
          const d2 = await r2.json();
          if (d2.success && d2.equipo) {
            setSetPieces(prev => ({
              ...prev,
              penales: d2.equipo.id_lanzador_penalti || null,
              faltas: d2.equipo.id_lanzador_falta_lejana || null,
              corner_izq: d2.equipo.id_lanzador_corner_izq || null,
              corner_der: d2.equipo.id_lanzador_corner_der || null,
            }));
          }
        } catch (_) {}
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, currentTeam?.id]);

  const lines = useMemo(() => {
    const item = FORMATIONS[mode].find((f) => f.value === formation) || FORMATIONS[mode][0];
    return item.lines;
  }, [mode, formation]);

  // slots construidos: siempre 1 portero + líneas según formación
  const slots = useMemo(() => {
    const result = [{ id: "GK", label: "POR" }];
    lines.forEach((count, idx) => {
      for (let i = 0; i < count; i++) {
        const lineIndex = idx + 1; // 1-based after GK
        const id = `L${lineIndex}-${i + 1}`;
        result.push({ id, label: `L${lineIndex}` });
      }
    });
    return result;
  }, [lines]);

  const assignedPlayerIds = useMemo(() => new Set(Object.values(assignments).filter(Boolean)), [assignments]);

  const bench = useMemo(() => players.filter((p) => !assignedPlayerIds.has(p.id)), [players, assignedPlayerIds]);

  const assignedPlayersOrdered = useMemo(() => {
    const map = {};
    slots.forEach((s) => {
      const pid = assignments[s.id];
      if (pid) map[s.id] = players.find((p) => p.id === pid) || null;
      else map[s.id] = null;
    });
    return map;
  }, [slots, assignments, players]);

  const handleDragStart = (e, playerId) => {
    e.dataTransfer.setData("text/plain", String(playerId));
    e.dataTransfer.effectAllowed = "move";
  };

  const dropOnSlot = (slotId, playerId) => {
    setAssignments((prev) => {
      const next = { ...prev };
      // Si el jugador ya estaba en otro slot, lo liberamos
      const fromSlot = Object.keys(prev).find((k) => prev[k] === playerId);
      if (fromSlot) next[fromSlot] = null;

      // Si el slot tenía otro jugador, lo quitamos (se va a banquillo implícitamente)
      next[slotId] = playerId;
      return next;
    });
  };

  const handleDropOnSlot = (e, slotId) => {
    e.preventDefault();
    const playerId = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!playerId) return;
    dropOnSlot(slotId, playerId);
  };

  const allowDrop = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnBench = (e) => {
    e.preventDefault();
    const playerId = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!playerId) return;
    // Quitar de cualquier slot
    setAssignments((prev) => {
      const next = { ...prev };
      const fromSlot = Object.keys(prev).find((k) => prev[k] === playerId);
      if (fromSlot) next[fromSlot] = null;
      return next;
    });
  };

  const handleChangeMode = (e) => {
    const newMode = e.target.value;
    setMode(newMode);
    const defaultFormation = FORMATIONS[newMode][0].value;
    setFormation(defaultFormation);
    // Limpiamos asignaciones porque cambia la estructura de slots
    setAssignments({});
  };

  const handleChangeFormation = (e) => {
    setFormation(e.target.value);
    setAssignments({});
  };

  const handleSave = async () => {
    setSaveMsg({ type: null, text: "" });
    const key = `furbo_formacion_${teamId}`;
    const payload = { mode, formation, assignments, setPieces };
    localStorage.setItem(key, JSON.stringify(payload));

    // Si hay equipo y usuario, intentamos guardar los lanzadores en backend
    if (currentTeam?.id && user?.id) {
      let successCount = 0;
      let errorMsg = "";

      // Guardar balón parado
      try {
        const form = new FormData();
        form.append('id_equipo', String(currentTeam.id));
        form.append('id_usuario', String(user.id));
        form.append('rol_global', user.rol || 'usuario');
        form.append('id_lanzador_penalti', setPieces.penales ? String(setPieces.penales) : '');
        form.append('id_lanzador_falta_lejana', setPieces.faltas ? String(setPieces.faltas) : '');
        form.append('id_lanzador_corner_izq', setPieces.corner_izq ? String(setPieces.corner_izq) : '');
        form.append('id_lanzador_corner_der', setPieces.corner_der ? String(setPieces.corner_der) : '');

        const resp1 = await fetch('/api/index.php?action=update_equipo', { method: 'POST', body: form });
        const data1 = await resp1.json();
        if (data1.success) {
          successCount++;
        } else {
          errorMsg += "Error en balón parado: " + (data1.error || "Desconocido") + ". ";
        }
      } catch (e) {
        errorMsg += "Error de conexión en balón parado. ";
      }

      // Guardar formación/posiciones
      try {
        const form2 = new FormData();
        form2.append('id_equipo', String(currentTeam.id));
        form2.append('id_usuario', String(user.id));
        form2.append('rol_global', user.rol || 'usuario');
        form2.append('mode', mode);
        form2.append('formation', formation);
        form2.append('assignments', JSON.stringify(assignments || {}));

        const resp2 = await fetch('/api/index.php?action=save_plantilla_equipo', { method: 'POST', body: form2 });
        const data2 = await resp2.json();
        if (data2.success) {
          successCount++;
        } else {
          errorMsg += "Error en formación: " + (data2.error || "Desconocido") + ". ";
        }
      } catch (e) {
        errorMsg += "Error de conexión en formación. ";
      }

      if (successCount > 0) {
        setSaveMsg({ type: 'success', text: 'Guardado correctamente.' });
      } else {
        setSaveMsg({ type: 'error', text: errorMsg || 'No se pudo guardar.' });
      }
    } else {
      setSaveMsg({ type: 'success', text: 'Guardado localmente.' });
    }
  };

  const handleReset = () => {
    setAssignments({});
    setSetPieces({ penales: null, faltas: null, corner_izq: null, corner_der: null });
  };

  const selectablePlayersForSetPieces = useMemo(() => {
    const onPitch = slots.map((s) => assignments[s.id]).filter(Boolean);
    const candidates = players.filter((p) => onPitch.includes(p.id));
    return candidates.length ? candidates : players;
  }, [players, slots, assignments]);

  const handleSetPieceChange = (key, value) => {
    setSetPieces((prev) => ({ ...prev, [key]: value ? parseInt(value, 10) : null }));
  };

  return (
    <div className="container-fluid page-shell plantilla-page">
      <div className="row g-3">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-body d-flex flex-wrap gap-3 align-items-end">
              <div>
                <label className="form-label mb-1 p-2">Modalidad</label>
                <select className="form-select px-5" value={mode} onChange={handleChangeMode}>
                  <option value="11">Fútbol 11</option>
                  <option value="7">Fútbol 7</option>
                  <option value="5">Fútbol 5</option>
                </select>
              </div>

              <div>
                <label className="form-label mb-1 p-2">Formación</label>
                <select className="form-select" value={formation} onChange={handleChangeFormation}>
                  {FORMATIONS[mode].map((f) => (
                    <option key={f.value} value={f.value}>{f.value}</option>
                  ))}
                </select>
              </div>

              <div className="ms-auto d-flex gap-2">
                <button className="btn btn-outline-secondary" onClick={handleReset}>Reiniciar</button>
                <button className="btn btn-primarypp" onClick={handleSave}>Guardar</button>
              </div>
            </div>
            {saveMsg.text && (
              <div className={`alert alert-${saveMsg.type === 'success' ? 'success' : 'danger'} mt-2`}>
                {saveMsg.text}
              </div>
            )}
          </div>
        </div>

        <div className="col-12 col-lg-8">
          <div className="card shadow-sm h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div className="fw-semibold">Campo y posiciones</div>
              <div className="small text-muted">Arrastra jugadores a los slots</div>
            </div>
            <div className="card-body">
              <Pitch
                lines={lines}
                slots={slots}
                assignments={assignments}
                playersMap={assignedPlayersOrdered}
                onDropSlot={handleDropOnSlot}
                onAllowDrop={allowDrop}
                mode={mode}
              />
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4 d-flex flex-column gap-3">
          <div className="card shadow-sm flex-grow-1">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div className="fw-semibold">Plantilla</div>
              {currentTeam?.nombre && <div className="small text-muted">{currentTeam.nombre}</div>}
            </div>
            <div className="card-body">
              {loading && <div className="text-muted">Cargando jugadores...</div>}
              {error && <div className="text-danger small">{error}</div>}

              <div
                className="bench-zone custom-scroll"
                onDrop={handleDropOnBench}
                onDragOver={allowDrop}
                title="Arrastra aquí para enviar a banquillo"
              >
                {bench.length === 0 ? (
                  <div className="text-muted small">Sin jugadores libres</div>
                ) : (
                  bench.map((p) => (
                    <div
                      key={p.id}
                      className="player-chip"
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id)}
                    >
                      <div className="chip-name">{shortName(p)}</div>
                      <div className="chip-meta">⭐ {Number(p.rating || 0).toFixed(1)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-header fw-semibold">Balón parado</div>
            <div className="card-body d-grid gap-3">
              {SET_PIECES.map((sp) => (
                <div key={sp.key}>
                  <label className="form-label mb-1">{sp.label}</label>
                  <select
                    className="form-select"
                    value={setPieces[sp.key] || ""}
                    onChange={(e) => handleSetPieceChange(sp.key, e.target.value)}
                  >
                    <option value="">— Sin asignar —</option>
                    {selectablePlayersForSetPieces.map((p) => (
                      <option key={p.id} value={p.id}>{shortName(p)}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pitch({ lines, slots, assignments, playersMap, onDropSlot, onAllowDrop, mode }) {
  // gridRows = 1 (portero) + número de líneas
  const rows = 1 + lines.length;
  const templateRows = `repeat(${rows}, 1fr)`;

  // Construimos filas: primera es GK con una sola columna centrada, siguientes dependen de count
  let slotIndex = 0;
  const rowsRender = [];

  // Fila GK
  rowsRender.push(
    <div key="row-gk" className="pitch-row">
      <Slot
        slot={slots[slotIndex++]}
        player={playersMap["GK"]}
        onDrop={onDropSlot}
        onAllowDrop={onAllowDrop}
      />
    </div>
  );

  // Resto de filas
  lines.forEach((count, li) => {
    const rowSlots = [];
    for (let i = 0; i < count; i++) {
      const s = slots[slotIndex++];
      rowSlots.push(
        <Slot key={s.id} slot={s} player={playersMap[s.id]} onDrop={onDropSlot} onAllowDrop={onAllowDrop} />
      );
    }
    rowsRender.push(
      <div key={`row-${li + 1}`} className="pitch-row" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
        {rowSlots}
      </div>
    );
  });

  return (
    <div className={`pitch pitch-${mode}`} style={{ gridTemplateRows: templateRows }}>
      {rowsRender}
    </div>
  );
}

function Slot({ slot, player, onDrop, onAllowDrop }) {
  const onDragStart = (e) => {
    if (!player) return;
    e.dataTransfer.setData("text/plain", String(player.id));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className={`slot ${player ? "filled" : "empty"}`} onDrop={(e) => onDrop(e, slot.id)} onDragOver={onAllowDrop}>
      <div className="slot-inner" draggable={!!player} onDragStart={onDragStart}>
        <div className="slot-label">{slot.label}</div>
        {player ? (
          <>
            <div className="slot-player-name">{shortName(player)}</div>
            <div className="slot-player-meta">⭐ {Number(player.rating || 0).toFixed(1)}</div>
          </>
        ) : (
          <div className="slot-placeholder">Arrastra aquí</div>
        )}
      </div>
    </div>
  );
}

export default Plantilla;

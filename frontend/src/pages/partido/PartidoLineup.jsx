import { useEffect, useMemo, useState } from "react";
import "./PartidoLineup.css";

const FORMATIONS = {
  "11": [
    { value: "4-3-3", lines: [4, 3, 3] },
    { value: "4-4-2", lines: [4, 4, 2] },
    { value: "3-5-2", lines: [3, 5, 2] },
    { value: "4-2-3-1", lines: [4, 2, 3, 1] },
    { value: "5-3-2", lines: [5, 3, 2] },
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

const MODE_BY_MODALIDAD = { f11: "11", f7: "7", f5: "5" };
const MODALIDAD_BY_MODE = { "11": "f11", "7": "f7", "5": "f5" };

const shortName = (player) => {
  if (!player) return "";
  const base = player.apodo || player.nombre || "Jugador";
  const parts = base.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 12);
  return `${parts[0]} ${parts[1][0]}.`;
};

const ratingValue = (player) => Number(player?.rating_habilidad ?? player?.rating ?? 0);

const jugadorId = (player) => Number(player?.jugadorId ?? player?.id_jugador ?? player?.id ?? 0);

const buildSlots = (mode, formation) => {
  const catalog = FORMATIONS[mode] ?? FORMATIONS["7"];
  const selected = catalog.find((f) => f.value === formation) ?? catalog[0];
  const slots = [{ id: "GK", label: "POR", fila: 0, columna: 0 }];
  selected.lines.forEach((count, idx) => {
    for (let i = 0; i < count; i += 1) {
      const fila = idx + 1;
      slots.push({ id: `L${fila}-${i + 1}`, label: `L${fila}`, fila, columna: i });
    }
  });
  return { slots, lines: selected.lines };
};

const buildAssignmentsFromRows = (rows, mode, formation) => {
  const { slots } = buildSlots(mode, formation);
  const grid = {};
  rows.forEach((row) => {
    const key = `${row.fila}-${row.columna}`;
    grid[key] = Number(row.id_jugador);
  });
  const assignments = {};
  slots.forEach((slot) => {
    const key = `${slot.fila}-${slot.columna}`;
    if (grid[key]) {
      assignments[slot.id] = grid[key];
    }
  });
  return assignments;
};

function PartidoLineup({ detalle, onSave, canEdit }) {
  const jugadores = useMemo(
    () => (detalle?.jugadores ?? []).map((j) => ({ ...j, jugadorId: jugadorId(j) })),
    [detalle]
  );
  const formacionesDb = detalle?.formaciones ?? [];
  const configDb = detalle?.formacion_config ?? [];
  const partido = detalle?.partido ?? null;
  const readOnly = !canEdit;

  const [selectedTeam, setSelectedTeam] = useState("A");
  const [mode, setMode] = useState("7");
  const [formationByTeam, setFormationByTeam] = useState({
    A: FORMATIONS["7"][0].value,
    B: FORMATIONS["7"][0].value,
  });
  const [assignments, setAssignments] = useState({ A: {}, B: {} });
  const [statusMsg, setStatusMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!partido) {
      setAssignments({ A: {}, B: {} });
      return;
    }
    const modalKey = typeof partido.modalidad_juego === "string" ? partido.modalidad_juego.toLowerCase() : "";
    const baseMode = MODE_BY_MODALIDAD[modalKey] || "7";
    const defaultFormation = FORMATIONS[baseMode]?.[0]?.value ?? FORMATIONS["7"][0].value;
    const nextFormation = { A: defaultFormation, B: defaultFormation };

    if (Array.isArray(configDb)) {
      configDb.forEach((cfg) => {
        const team = cfg?.equipo?.toUpperCase();
        if (team === "A" || team === "B") {
          const cfgMode = MODE_BY_MODALIDAD[(cfg.modalidad || "").toLowerCase()] || baseMode;
          if (FORMATIONS[cfgMode]?.some((f) => f.value === cfg.sistema)) {
            nextFormation[team] = cfg.sistema;
          }
        }
      });
    }

    const grouped = { A: [], B: [] };
    formacionesDb.forEach((row) => {
      const team = row?.equipo?.toUpperCase();
      if (team === "A" || team === "B") {
        grouped[team].push(row);
      }
    });

    const nextAssignments = {
      A: buildAssignmentsFromRows(grouped.A, baseMode, nextFormation.A),
      B: buildAssignmentsFromRows(grouped.B, baseMode, nextFormation.B),
    };

    setMode(baseMode);
    setFormationByTeam(nextFormation);
    setAssignments(nextAssignments);
    setSelectedTeam("A");
    setStatusMsg(null);
  }, [detalle, partido, formacionesDb, configDb]);

  useEffect(() => {
    if (!statusMsg) return undefined;
    const t = setTimeout(() => setStatusMsg(null), 3500);
    return () => clearTimeout(t);
  }, [statusMsg]);

  const { slots, lines } = useMemo(() => buildSlots(mode, formationByTeam[selectedTeam]), [mode, formationByTeam, selectedTeam]);

  const jugadoresById = useMemo(() => {
    const map = new Map();
    jugadores.forEach((j) => map.set(j.jugadorId, j));
    return map;
  }, [jugadores]);

  const usedPlayers = useMemo(() => {
    const set = new Set();
    ["A", "B"].forEach((team) => {
      Object.values(assignments[team] || {}).forEach((pid) => {
        if (pid) set.add(pid);
      });
    });
    return set;
  }, [assignments]);

  const benchPlayers = useMemo(
    () => jugadores.filter((j) => !usedPlayers.has(j.jugadorId)),
    [jugadores, usedPlayers]
  );

  const playersMap = useMemo(() => {
    const map = {};
    slots.forEach((slot) => {
      const pid = assignments[selectedTeam]?.[slot.id];
      map[slot.id] = pid ? jugadoresById.get(pid) || null : null;
    });
    return map;
  }, [slots, assignments, selectedTeam, jugadoresById]);

  const removePlayerEverywhere = (state, playerId) => {
    const next = {
      A: { ...state.A },
      B: { ...state.B },
    };
    ["A", "B"].forEach((team) => {
      const current = next[team];
      Object.keys(current).forEach((slotId) => {
        if (current[slotId] === playerId) {
          current[slotId] = null;
        }
      });
    });
    return next;
  };

  const handleDropOnSlot = (e, slotId) => {
    if (readOnly) return;
    e.preventDefault();
    const playerId = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!playerId) return;
    setAssignments((prev) => {
      const cleaned = removePlayerEverywhere(prev, playerId);
      return {
        ...cleaned,
        [selectedTeam]: { ...cleaned[selectedTeam], [slotId]: playerId },
      };
    });
  };

  const handleDropOnBench = (e) => {
    if (readOnly) return;
    e.preventDefault();
    const playerId = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!playerId) return;
    setAssignments((prev) => removePlayerEverywhere(prev, playerId));
  };

  const allowDrop = (e) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleChangeMode = (e) => {
    if (readOnly) return;
    const newMode = e.target.value;
    const defaultFormation = FORMATIONS[newMode][0].value;
    setMode(newMode);
    setFormationByTeam({ A: defaultFormation, B: defaultFormation });
    setAssignments({ A: {}, B: {} });
  };

  const handleChangeFormation = (e) => {
    if (readOnly) return;
    const value = e.target.value;
    setFormationByTeam((prev) => ({ ...prev, [selectedTeam]: value }));
    setAssignments((prev) => ({ ...prev, [selectedTeam]: {} }));
  };

  const handleSave = async () => {
    if (!onSave || readOnly) return;
    const grid = [];
    slots.forEach((slot) => {
      const playerId = assignments[selectedTeam]?.[slot.id];
      if (playerId) {
        grid.push({ fila: slot.fila, columna: slot.columna, id_jugador: playerId });
      }
    });

    setSaving(true);
    try {
      await onSave({
        equipo: selectedTeam,
        modalidad: MODALIDAD_BY_MODE[mode] || 'f7',
        sistema: formationByTeam[selectedTeam],
        grid,
      });
      setStatusMsg({ type: 'success', text: 'Formación guardada correctamente' });
    } catch (error) {
      setStatusMsg({ type: 'error', text: error.message || 'No se pudo guardar' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="match-lineup">
      <div className="card shadow-sm">
        <div className="card-body gap-3 d-flex flex-wrap align-items-end">
          <div>
            <label className="form-label mb-1">Modalidad</label>
            <select className="form-select" value={mode} onChange={handleChangeMode} disabled={readOnly}>
              <option value="11">Fútbol 11</option>
              <option value="7">Fútbol 7</option>
              <option value="5">Fútbol Sala</option>
            </select>
          </div>
          <div>
            <label className="form-label mb-1">Formación</label>
            <select className="form-select" value={formationByTeam[selectedTeam]} onChange={handleChangeFormation} disabled={readOnly}>
              {FORMATIONS[mode].map((f) => (
                <option key={f.value} value={f.value}>{f.value}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label mb-1">Equipo</label>
            <div className="btn-group" role="group">
              <input type="radio" className="btn-check" name="teamLineup" id="teamA" autoComplete="off" checked={selectedTeam === 'A'} onChange={() => !readOnly && setSelectedTeam('A')} disabled={readOnly} />
              <label className="btn btn-outline-primary" htmlFor="teamA">Equipo A</label>
              <input type="radio" className="btn-check" name="teamLineup" id="teamB" autoComplete="off" checked={selectedTeam === 'B'} onChange={() => !readOnly && setSelectedTeam('B')} disabled={readOnly} />
              <label className="btn btn-outline-primary" htmlFor="teamB">Equipo B</label>
            </div>
          </div>
          <div className="ms-auto d-flex gap-2">
            <button className="btn btn-outline-secondary" type="button" onClick={() => setAssignments((prev) => ({ ...prev, [selectedTeam]: {} }))} disabled={readOnly}>Vaciar</button>
            <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving || readOnly}>{saving ? 'Guardando...' : 'Guardar formación'}</button>
          </div>
        </div>
        {statusMsg && (
          <div className={`alert alert-${statusMsg.type === 'error' ? 'danger' : 'success'} mb-0`}>{statusMsg.text}</div>
        )}
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <div className="card shadow-sm h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div className="fw-semibold">Campo</div>
              <small className="text-muted">Arrastra jugadores disponibles a los slots</small>
            </div>
            <div className="card-body">
              <Pitch
                lines={lines}
                slots={slots}
                playersMap={playersMap}
                onDropSlot={handleDropOnSlot}
                onAllowDrop={allowDrop}
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-5">
          <div className="card shadow-sm h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div className="fw-semibold">Disponibles</div>
              <small className="text-muted">{benchPlayers.length} jugadores</small>
            </div>
            <div className="card-body">
              <div
                className="bench-zone custom-scroll"
                onDrop={handleDropOnBench}
                onDragOver={allowDrop}
              >
                {benchPlayers.length === 0 ? (
                  <div className="text-muted small">Sin jugadores libres</div>
                ) : (
                  benchPlayers.map((p) => (
                    <div
                      key={p.jugadorId}
                      className="player-chip"
                      draggable={!readOnly}
                      onDragStart={(e) => {
                        if (readOnly) return;
                        e.dataTransfer.setData("text/plain", String(p.jugadorId));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <div>
                        <div className="chip-name">{shortName(p)}</div>
                        <div className="chip-meta">⭐ {ratingValue(p).toFixed(1)}</div>
                      </div>
                      {p.equipo && <span className="badge text-bg-light">{p.equipo}</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pitch({ lines, slots, playersMap, onDropSlot, onAllowDrop, readOnly }) {
  const rows = 1 + (lines?.length || 0);
  const templateRows = `repeat(${rows}, 1fr)`;
  let slotIndex = 0;
  const renderedRows = [];

  renderedRows.push(
    <div key="row-gk" className="pitch-row">
      <Slot slot={slots[slotIndex++]} player={playersMap.GK} onDrop={onDropSlot} onAllowDrop={onAllowDrop} readOnly={readOnly} />
    </div>
  );

  lines.forEach((count, idx) => {
    const rowSlots = [];
    for (let i = 0; i < count; i += 1) {
      const slot = slots[slotIndex++];
      rowSlots.push(
        <Slot
          key={slot.id}
          slot={slot}
          player={playersMap[slot.id]}
          onDrop={onDropSlot}
          onAllowDrop={onAllowDrop}
          readOnly={readOnly}
        />
      );
    }
    renderedRows.push(
      <div key={`row-${idx + 1}`} className="pitch-row" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
        {rowSlots}
      </div>
    );
  });

  return (
    <div className="pitch" style={{ gridTemplateRows: templateRows }}>
      {renderedRows}
    </div>
  );
}

function Slot({ slot, player, onDrop, onAllowDrop, readOnly }) {
  const onDragStart = (e) => {
    if (!player || readOnly) return;
    e.dataTransfer.setData("text/plain", String(player.jugadorId));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className={`slot ${player ? "filled" : "empty"}`} onDrop={(e) => onDrop && onDrop(e, slot.id)} onDragOver={onAllowDrop}>
      <div className="slot-inner" draggable={!!player && !readOnly} onDragStart={onDragStart}>
        <div className="slot-label">{slot.label}</div>
        {player ? (
          <>
            <div className="slot-player-name">{shortName(player)}</div>
            <div className="slot-player-meta">⭐ {ratingValue(player).toFixed(1)}</div>
          </>
        ) : (
          <div className="slot-placeholder">Arrastra aquí</div>
        )}
      </div>
    </div>
  );
}

export default PartidoLineup;

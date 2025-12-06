import { useEffect, useMemo, useState } from "react";
import "./Bus.css";

const MINUTES_PER_STOP = 1.5;
const DAY_TYPES = [
  { id: "L-V", label: "Lunes a viernes" },
  { id: "VIE", label: "Viernes (especial)" },
  { id: "SAB", label: "Sábado" },
  { id: "DOM", label: "Domingo / festivo" },
];

const deriveDayTypeFromDate = (date) => {
  const day = date.getDay();
  if (day === 6) return "SAB";
  if (day === 0) return "DOM";
  if (day === 5) return "VIE";
  return "L-V";
};

const formatTime = (date) =>
  date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

const createDateFromSchedule = (referenceDate, timeString) => {
  const [hours, minutes] = timeString.split(":").map((value) => parseInt(value, 10));
  const result = new Date(referenceDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

const ensureTerminalOrder = (stops) => {
  const normalizeName = (value) => (value || "").trim().toLowerCase();
  const ordered = [...stops];

  const startIndex = ordered.findIndex((stop) => normalizeName(stop.name) === "abate renfe");
  if (startIndex > 0) {
    const [terminal] = ordered.splice(startIndex, 1);
    ordered.unshift(terminal);
  }

  const endIndex = ordered.findIndex((stop) => normalizeName(stop.name) === "abate renfe fin");
  if (endIndex !== -1 && endIndex !== ordered.length - 1) {
    const [terminal] = ordered.splice(endIndex, 1);
    ordered.push(terminal);
  }

  return ordered;
};

const normalizeLine = (line) => ({
  id: String(line.id),
  name: line.nombre,
  color: line.color || "#2563eb",
  stops: ensureTerminalOrder(
    (line.stops ?? [])
      .map((stop) => ({
        id: String(stop.id),
        name: stop.nombre,
        address: stop.direccion || "",
        order: Number(stop.orden ?? 0),
        lat: Number(stop.latitud ?? stop.lat ?? 0),
        lng: Number(stop.longitud ?? stop.lng ?? 0),
      }))
      .sort((a, b) => a.order - b.order)
  ),
});

const kmDistance = (origin, target) => {
  const deg2rad = (deg) => deg * (Math.PI / 180);
  const R = 6371;
  const dLat = deg2rad(target.lat - origin.lat);
  const dLon = deg2rad(target.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(origin.lat)) *
      Math.cos(deg2rad(target.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function Bus() {
  const [lines, setLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(true);
  const [linesError, setLinesError] = useState("");

  const [selectedLineId, setSelectedLineId] = useState("");
  const [selectedDayType, setSelectedDayType] = useState(deriveDayTypeFromDate(new Date()));
  const [lineSchedules, setLineSchedules] = useState([]);
  const [scheduleFetchLoading, setScheduleFetchLoading] = useState(false);
  const [scheduleFetchError, setScheduleFetchError] = useState("");

  const [geoStatus, setGeoStatus] = useState({ state: "idle", message: "" });
  const [nearbyStops, setNearbyStops] = useState([]);
  const [startStopId, setStartStopId] = useState("");
  const [endStopId, setEndStopId] = useState("");
  const [travelDateTime, setTravelDateTime] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleResult, setScheduleResult] = useState(null);

  const [manualCoords, setManualCoords] = useState({ lat: "", lng: "" });
  const [originStopId, setOriginStopId] = useState("");
  const [manualNearest, setManualNearest] = useState(null);
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    let aborted = false;
    setLinesLoading(true);
    setLinesError("");
    fetch("/api/index.php?action=bus_lineas")
      .then((response) => response.json())
      .then((data) => {
        if (aborted) return;
        if (!data.success) {
          setLinesError(data.error || "No se pudieron cargar las lineas");
          setLines([]);
          return;
        }
        const normalized = (data.lineas ?? []).map(normalizeLine);
        setLines(normalized);
        if (normalized.length > 0) {
          setSelectedLineId((prev) => prev || String(normalized[0].id));
        }
      })
      .catch(() => {
        if (aborted) return;
        setLinesError("No se pudo comunicar con el servidor de transporte");
        setLines([]);
      })
      .finally(() => {
        if (!aborted) {
          setLinesLoading(false);
        }
      });

    return () => {
      aborted = true;
    };
  }, []);

  const activeLine = useMemo(
    () => lines.find((line) => line.id === String(selectedLineId)) || null,
    [lines, selectedLineId]
  );
  const activeStops = activeLine?.stops ?? [];

  useEffect(() => {
    if (!activeLine) {
      setStartStopId("");
      setEndStopId("");
      return;
    }
    if (!startStopId || !activeStops.find((stop) => stop.id === startStopId)) {
      setStartStopId(activeStops[0]?.id ?? "");
    }
    if (!endStopId || !activeStops.find((stop) => stop.id === endStopId)) {
      setEndStopId(activeStops[activeStops.length - 1]?.id ?? "");
    }
  }, [activeLine, activeStops, startStopId, endStopId]);

  useEffect(() => {
    if (!selectedLineId) {
      setLineSchedules([]);
      return;
    }
    let aborted = false;
    setScheduleFetchLoading(true);
    setScheduleFetchError("");

    const params = new URLSearchParams({
      action: "bus_horarios",
      linea_id: selectedLineId,
    });
    if (selectedDayType) {
      params.append("tipo_dia", selectedDayType);
    }

    fetch(`/api/index.php?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (aborted) return;
        if (!data.success) {
          setScheduleFetchError(data.error || "No se pudieron obtener los horarios");
          setLineSchedules([]);
          return;
        }
        const normalized = (data.horarios ?? [])
          .map((item) => ({
            id: String(item.id),
            hora: item.hora,
            tipoDia: item.tipo_dia,
            trayecto: item.trayecto,
          }))
          .sort((a, b) => a.hora.localeCompare(b.hora));
        setLineSchedules(normalized);
      })
      .catch(() => {
        if (aborted) return;
        setScheduleFetchError("No fue posible descargar los horarios");
        setLineSchedules([]);
      })
      .finally(() => {
        if (!aborted) {
          setScheduleFetchLoading(false);
        }
      });

    return () => {
      aborted = true;
    };
  }, [selectedLineId, selectedDayType]);

  const allStops = useMemo(() => {
    const list = [];
    lines.forEach((line) => {
      (line.stops || []).forEach((stop) => {
        list.push({
          ...stop,
          lineId: line.id,
          lineName: line.name,
        });
      });
    });
    return list;
  }, [lines]);

  const uniqueStopOptions = useMemo(() => {
    const registry = new Map();
    allStops.forEach((stop) => {
      if (!registry.has(stop.id)) {
        registry.set(stop.id, {
          id: stop.id,
          name: stop.name,
          lineName: stop.lineName,
        });
      }
    });
    return Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allStops]);

  const linesByStop = useMemo(() => {
    const map = new Map();
    lines.forEach((line) => {
      (line.stops || []).forEach((stop) => {
        if (!map.has(stop.id)) {
          map.set(stop.id, new Set());
        }
        map.get(stop.id).add(line.name);
      });
    });
    return map;
  }, [lines]);

  const getLineNamesForStop = (stopId) => Array.from(linesByStop.get(stopId) ?? []);

  useEffect(() => {
    if (!originStopId && uniqueStopOptions.length > 0) {
      setOriginStopId(uniqueStopOptions[0].id);
    }
  }, [originStopId, uniqueStopOptions]);

  const handleLocate = () => {
    if (linesLoading) {
      setGeoStatus({ state: "error", message: "Espera a que carguemos las lineas" });
      return;
    }
    if (linesError) {
      setGeoStatus({ state: "error", message: "No podemos localizar paradas sin datos" });
      return;
    }
    if (!navigator.geolocation) {
      setGeoStatus({ state: "error", message: "Tu navegador no soporta geolocalizacion" });
      return;
    }
    if (allStops.length === 0) {
      setGeoStatus({ state: "error", message: "Aún no hay paradas disponibles" });
      return;
    }

    setGeoStatus({ state: "loading", message: "Solicitando ubicacion..." });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const sorted = [...allStops]
          .map((stop) => ({
            stop,
            distance: kmDistance(coords, { lat: stop.lat, lng: stop.lng }),
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 3);
        setNearbyStops(sorted);
        setGeoStatus({ state: "success", message: "Paradas encontradas" });
      },
      (error) => {
        setGeoStatus({ state: "error", message: "No pudimos obtener tu ubicacion" });
        console.error("Geolocation error", error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleManualSubmit = (event) => {
    event.preventDefault();
    if (allStops.length === 0) {
      setManualError("No hay paradas registradas");
      setManualNearest(null);
      return;
    }

    const lat = Number(String(manualCoords.lat).replace(",", "."));
    const lng = Number(String(manualCoords.lng).replace(",", "."));
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setManualError("Introduce coordenadas válidas (latitud y longitud)");
      setManualNearest(null);
      return;
    }

    const basePoint = { lat, lng };
    const stopsWithDistance = allStops
      .map((stop) => ({
        ...stop,
        distance: kmDistance(basePoint, { lat: stop.lat, lng: stop.lng }),
      }))
      .sort((a, b) => a.distance - b.distance);

    if (stopsWithDistance.length === 0) {
      setManualError("No hay paradas disponibles");
      setManualNearest(null);
      return;
    }

    const topStops = stopsWithDistance.slice(0, 3);
    const destinationStop = topStops[0];

    let sharedLines = [];
    let originStopInfo = null;
    if (originStopId) {
      const selectedOrigin = allStops.find((stop) => stop.id === originStopId) || null;
      if (selectedOrigin) {
        originStopInfo = {
          ...selectedOrigin,
          distance: kmDistance(basePoint, { lat: selectedOrigin.lat, lng: selectedOrigin.lng }),
        };
      }
      if (originStopInfo && destinationStop) {
        sharedLines = lines
          .filter((line) => {
            const hasOrigin = line.stops?.some((stop) => stop.id === originStopId);
            const hasDestination = line.stops?.some((stop) => stop.id === destinationStop.id);
            return hasOrigin && hasDestination;
          })
          .map((line) => {
            const originIndex = line.stops.findIndex((stop) => stop.id === originStopId);
            const destinationIndex = line.stops.findIndex((stop) => stop.id === destinationStop.id);
            const forward = originIndex <= destinationIndex;
            return {
              lineId: line.id,
              lineName: line.name,
              direction: forward
                ? `${line.stops[originIndex]?.name} → ${line.stops[destinationIndex]?.name}`
                : `${line.stops[destinationIndex]?.name} ← ${line.stops[originIndex]?.name}`,
              stopsBetween: Math.abs(destinationIndex - originIndex),
            };
          })
          .sort((a, b) => a.stopsBetween - b.stopsBetween);
      }
    }

    setManualNearest({
      coordinates: basePoint,
      topStops,
      destinationStop,
      originStop: originStopInfo,
      sharedLines,
    });
    setManualError("");
  };

  const handleDateChange = (value) => {
    setTravelDateTime(value);
    if (!value) return;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      setSelectedDayType(deriveDayTypeFromDate(parsed));
    }
  };

  const handleScheduleSubmit = (event) => {
    event.preventDefault();
    if (!activeLine) {
      setScheduleError("Selecciona una linea valida");
      return;
    }
    if (!travelDateTime) {
      setScheduleError("Indica la fecha y hora de salida");
      return;
    }
    if (lineSchedules.length === 0) {
      setScheduleError("No hay horarios para esta linea en el tipo de dia elegido");
      return;
    }

    const startIndex = activeStops.findIndex((stop) => stop.id === startStopId);
    const endIndex = activeStops.findIndex((stop) => stop.id === endStopId);

    if (startIndex === -1 || endIndex === -1) {
      setScheduleError("Selecciona paradas validas");
      return;
    }
    if (startIndex >= endIndex) {
      setScheduleError("La parada de destino debe ir despues de la de origen");
      return;
    }

    const baseTime = new Date(travelDateTime);
    if (Number.isNaN(baseTime.getTime())) {
      setScheduleError("La fecha seleccionada no es valida");
      return;
    }

    const scheduleDates = lineSchedules
      .map((slot) => ({
        ...slot,
        date: createDateFromSchedule(baseTime, slot.hora),
      }))
      .sort((a, b) => a.date - b.date);

    let nextSlot = scheduleDates.find((slot) => slot.date >= baseTime);
    if (!nextSlot && scheduleDates.length > 0) {
      const tomorrow = new Date(baseTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      nextSlot = {
        ...scheduleDates[0],
        date: createDateFromSchedule(tomorrow, scheduleDates[0].hora),
      };
    }

    if (!nextSlot) {
      setScheduleError("No encontramos horarios disponibles");
      return;
    }

    setScheduleError("");
    const minutesToStart = startIndex * MINUTES_PER_STOP;
    const minutesToEnd = endIndex * MINUTES_PER_STOP;
    const arrivalOrigin = new Date(nextSlot.date.getTime() + minutesToStart * 60000);
    const arrivalDestination = new Date(nextSlot.date.getTime() + minutesToEnd * 60000);
    const totalMinutes = (endIndex - startIndex) * MINUTES_PER_STOP;

    setScheduleResult({
      lineName: activeLine.name,
      origin: activeStops[startIndex].name,
      destination: activeStops[endIndex].name,
      startEta: arrivalOrigin,
      endEta: arrivalDestination,
      totalMinutes,
      departure: nextSlot.date,
      trayecto: nextSlot.trayecto,
      dayType: selectedDayType,
    });
  };

  const selectedDayLabel = DAY_TYPES.find((item) => item.id === selectedDayType)?.label || selectedDayType;

  return (
    <div className="bus-page">
      <header className="bus-hero">
        <div>
          <p className="eyebrow">Movilidad Urbana</p>
          <h1>Planifica tu viaje en bus</h1>
          <p>Encuentra paradas cercanas, calcula horarios y explora el mapa de lineas oficiales.</p>
        </div>
      </header>

      <section className="bus-section">
        <div className="section-header">
          <span className="section-number">01</span>
          <div>
            <h2>Buscar paradas cercanas</h2>
            <p>Te pediremos ubicacion para mostrar las tres paradas mas proximas.</p>
          </div>
          <button onClick={handleLocate} className="primary-btn" disabled={linesLoading || !!linesError}>
            Compartir ubicacion
          </button>
        </div>
        <div className="section-body">
          {linesLoading && <p>Cargando lineas y paradas...</p>}
          {linesError && <p className="error-text">{linesError}</p>}
          {!linesLoading && !linesError && (
            <>
              {geoStatus.state === "idle" && <p>Presiona el boton para localizarte.</p>}
              {geoStatus.state === "loading" && <p>Cargando ubicacion...</p>}
              {geoStatus.state === "error" && <p className="error-text">{geoStatus.message}</p>}
              {geoStatus.state === "success" && nearbyStops.length === 0 && <p>No encontramos paradas.</p>}
              {nearbyStops.length > 0 && (
                <div className="stop-grid">
                  {nearbyStops.map(({ stop, distance }) => (
                    <article key={`${stop.lineId}-${stop.id}`} className="stop-card">
                      <h3>{stop.name}</h3>
                      <p>{stop.lineName}</p>
                      <span>{distance.toFixed(2)} km</span>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="bus-section">
        <div className="section-header">
          <span className="section-number">02</span>
          <div>
            <h2>Buscar horario</h2>
            <p>Filtra por linea, selecciona paradas y obtendras las horas estimadas.</p>
          </div>
        </div>

        <form className="schedule-form" onSubmit={handleScheduleSubmit}>
          <label>
            Linea
            <select value={selectedLineId} onChange={(e) => setSelectedLineId(e.target.value)} disabled={!lines.length}>
              {lines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Tipo de dia
            <select value={selectedDayType} onChange={(e) => setSelectedDayType(e.target.value)}>
              {DAY_TYPES.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Salida
            <select value={startStopId} onChange={(e) => setStartStopId(e.target.value)} disabled={!activeStops.length}>
              {activeStops.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Destino
            <select value={endStopId} onChange={(e) => setEndStopId(e.target.value)} disabled={!activeStops.length}>
              {activeStops.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Fecha y hora
            <input type="datetime-local" value={travelDateTime} onChange={(e) => handleDateChange(e.target.value)} />
          </label>

          <button type="submit" className="primary-btn" disabled={!lines.length}>
            Calcular llegada
          </button>
        </form>

        {scheduleFetchLoading && <p>Cargando horarios oficiales...</p>}
        {scheduleFetchError && <p className="error-text">{scheduleFetchError}</p>}
        {!scheduleFetchLoading && !scheduleFetchError && lineSchedules.length === 0 && selectedLineId && (
          <p className="muted-text">No hay horarios registrados para este tipo de día.</p>
        )}
        {!scheduleFetchLoading && lineSchedules.length > 0 && (
          <div className="schedule-times">
            <p>
              Próximos servicios ({selectedDayLabel}):
            </p>
            <div className="time-chip-group">
              {lineSchedules.slice(0, 8).map((slot) => (
                <span key={slot.id} className="time-chip">
                  {slot.hora}
                </span>
              ))}
            </div>
          </div>
        )}

        {scheduleError && <p className="error-text">{scheduleError}</p>}
        {scheduleResult && (
          <div className="schedule-summary">
            <p>
              Linea <strong>{scheduleResult.lineName}</strong> · {selectedDayLabel}
            </p>
            <p>
              Próximo bus ({scheduleResult.trayecto || "Normal"}) sale a las <strong>{formatTime(scheduleResult.departure)}</strong>
            </p>
            <p>
              Llegará a <strong>{scheduleResult.origin}</strong> a las {formatTime(scheduleResult.startEta)}
            </p>
            <p>
              Llegada a destino <strong>{scheduleResult.destination}</strong> a las {formatTime(scheduleResult.endEta)}
            </p>
            <p>Duracion estimada: {scheduleResult.totalMinutes.toFixed(1)} min</p>
          </div>
        )}
      </section>

      <section className="bus-section">
        <div className="section-header">
          <span className="section-number">03</span>
          <div>
            <h2>Calcular parada por coordenadas</h2>
            <p>Introduce latitud y longitud manualmente (ej: 37.1879, -5.7855) para ver la parada y línea más cercanas.</p>
          </div>
        </div>

        <form className="coordinate-form" onSubmit={handleManualSubmit}>
          <label>
            Latitud
            <input
              type="text"
              placeholder="37.187915"
              value={manualCoords.lat}
              onChange={(event) => setManualCoords((prev) => ({ ...prev, lat: event.target.value }))}
              required
            />
          </label>
          <label>
            Longitud
            <input
              type="text"
              placeholder="-5.785558"
              value={manualCoords.lng}
              onChange={(event) => setManualCoords((prev) => ({ ...prev, lng: event.target.value }))}
              required
            />
          </label>
          <label>
            Tu ubicación (parada de origen)
            <select value={originStopId} onChange={(event) => setOriginStopId(event.target.value)}>
              {uniqueStopOptions.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.name} · {stop.lineName}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="primary-btn coordinate-submit">
            Analizar coordenadas
          </button>
        </form>

        {manualError && <p className="error-text">{manualError}</p>}

        {manualNearest && (
          <div className="coordinate-results">
            <div className="coordinate-column">
              <article className="result-card">
                <h3>Parada más cercana a tu destino</h3>
                <p className="result-name">{manualNearest.destinationStop?.name}</p>
                <p className="muted-text">
                  {manualNearest.destinationStop?.distance?.toFixed(2)} km · Líneas
                  {" "}
                  {getLineNamesForStop(manualNearest.destinationStop?.id).join(", ") ||
                    manualNearest.destinationStop?.lineName}
                </p>
              </article>

              <div className="top-stops-list">
                {manualNearest.topStops.map((stop) => (
                  <div key={`${stop.lineId}-${stop.id}`} className="top-stop-item">
                    <strong>{stop.name}</strong>
                    <span>{stop.distance.toFixed(2)} km</span>
                    <small>{getLineNamesForStop(stop.id).join(", ") || stop.lineName}</small>
                  </div>
                ))}
              </div>
            </div>

            {manualNearest.originStop && (
              <div className="coordinate-column">
                <article className="result-card destination-card">
                  <h3>Desde tu ubicación</h3>
                  <p>
                    Partida en <strong>{manualNearest.originStop.name}</strong>
                    {manualNearest.originStop.distance
                      ? ` · ${manualNearest.originStop.distance.toFixed(2)} km`
                      : ""}
                  </p>
                  {manualNearest.sharedLines.length > 0 ? (
                    <ul className="shared-lines-list">
                      {manualNearest.sharedLines.map((line) => (
                        <li key={line.lineId}>
                          <strong>{line.lineName}</strong> · {line.direction}
                          <small>{line.stopsBetween} paradas</small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted-text">
                      Ninguna línea va directa desde tu ubicación hasta la parada más cercana al destino.
                    </p>
                  )}
                </article>
              </div>
            )}
          </div>
        )}
      </section>

      {/* <section className="bus-section">
        <div className="section-header">
          <span className="section-number">03</span>
          <div>
            <h2>Mapa de lineas</h2>
            <p>Proximamente integraremos un mapa interactivo. De momento veras la referencia visual.</p>
          </div>
        </div>
        <div className="map-placeholder">Imagen</div>
      </section> */}
    </div>
  );
}

export default Bus;

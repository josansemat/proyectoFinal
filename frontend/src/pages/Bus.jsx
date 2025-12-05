import { useEffect, useMemo, useState } from "react";
import "./Bus.css";

const MINUTES_PER_STOP = 1.5;

const BUS_LINES = [
	{
		id: "L1",
		name: "Linea Centro",
		color: "#3c71ff",
		stops: [
			{ id: "l1-1", name: "Estacion Central", lat: 40.4192, lng: -3.7007 },
			{ id: "l1-2", name: "Plaza Norte", lat: 40.4297, lng: -3.7076 },
			{ id: "l1-3", name: "Mercado Viejo", lat: 40.426, lng: -3.691 },
			{ id: "l1-4", name: "Parque del Rio", lat: 40.4154, lng: -3.6834 },
			{ id: "l1-5", name: "Campus Sur", lat: 40.4046, lng: -3.6881 },
		],
	},
	{
		id: "L2",
		name: "Linea Verde",
		color: "#00a884",
		stops: [
			{ id: "l2-1", name: "Rotonda Oeste", lat: 40.409, lng: -3.7121 },
			{ id: "l2-2", name: "Barrio Jardin", lat: 40.4019, lng: -3.7032 },
			{ id: "l2-3", name: "Museo Abierto", lat: 40.3973, lng: -3.6889 },
			{ id: "l2-4", name: "Puente Dorado", lat: 40.3928, lng: -3.6772 },
			{ id: "l2-5", name: "Estadio Sur", lat: 40.3871, lng: -3.6694 },
			{ id: "l2-6", name: "Hospital Nuevo", lat: 40.3817, lng: -3.661 },
		],
	},
	{
		id: "L3",
		name: "Linea Norte",
		color: "#ff8d3c",
		stops: [
			{ id: "l3-1", name: "Terminal Norte", lat: 40.4431, lng: -3.6938 },
			{ id: "l3-2", name: "Centro Empresarial", lat: 40.4362, lng: -3.6815 },
			{ id: "l3-3", name: "Plaza Aurora", lat: 40.4305, lng: -3.6701 },
			{ id: "l3-4", name: "Distrito Creativo", lat: 40.4234, lng: -3.6622 },
			{ id: "l3-5", name: "Ciudad Deportiva", lat: 40.4177, lng: -3.6523 },
		],
	},
];

const kmDistance = (origin, target) => {
	const deg2rad = (deg) => deg * (Math.PI / 180);
	const R = 6371; // Earth radius in km
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
	const [geoStatus, setGeoStatus] = useState({ state: "idle", message: "" });
	const [nearbyStops, setNearbyStops] = useState([]);
	const [selectedLineId, setSelectedLineId] = useState(BUS_LINES[0]?.id ?? "");
	const [startStopId, setStartStopId] = useState("");
	const [endStopId, setEndStopId] = useState("");
	const [travelDateTime, setTravelDateTime] = useState("");
	const [scheduleError, setScheduleError] = useState("");
	const [scheduleResult, setScheduleResult] = useState(null);

	const allStops = useMemo(() => {
		const list = [];
		BUS_LINES.forEach((line) => {
			line.stops.forEach((stop, idx) => {
				list.push({ ...stop, lineId: line.id, lineName: line.name, order: idx });
			});
		});
		return list;
	}, []);

	const activeLine = useMemo(
		() => BUS_LINES.find((line) => line.id === selectedLineId) || null,
		[selectedLineId]
	);
	const activeStops = activeLine?.stops ?? [];

	useEffect(() => {
		const stops = activeLine?.stops ?? [];
		if (!activeLine) {
			setStartStopId("");
			setEndStopId("");
			return;
		}
		if (!startStopId || !stops.find((stop) => stop.id === startStopId)) {
			setStartStopId(stops[0]?.id ?? "");
		}
		if (!endStopId || !stops.find((stop) => stop.id === endStopId)) {
			setEndStopId(stops[stops.length - 1]?.id ?? "");
		}
	}, [activeLine, startStopId, endStopId]);

	const handleLocate = () => {
		if (!navigator.geolocation) {
			setGeoStatus({ state: "error", message: "Tu navegador no soporta geolocalizacion" });
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

		const startIndex = activeLine.stops.findIndex((stop) => stop.id === startStopId);
		const endIndex = activeLine.stops.findIndex((stop) => stop.id === endStopId);

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

		setScheduleError("");
		const minutesToStart = startIndex * MINUTES_PER_STOP;
		const minutesToEnd = endIndex * MINUTES_PER_STOP;
		const arrivalOrigin = new Date(baseTime.getTime() + minutesToStart * 60000);
		const arrivalDestination = new Date(baseTime.getTime() + minutesToEnd * 60000);
		const totalMinutes = (endIndex - startIndex) * MINUTES_PER_STOP;

		setScheduleResult({
			lineName: activeLine.name,
			origin: activeLine.stops[startIndex].name,
			destination: activeLine.stops[endIndex].name,
			startEta: arrivalOrigin,
			endEta: arrivalDestination,
			totalMinutes,
		});
	};

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
					<button onClick={handleLocate} className="primary-btn">
						Compartir ubicacion
					</button>
				</div>
				<div className="section-body">
					{geoStatus.state === "idle" && <p>Presiona el boton para localizarte.</p>}
					{geoStatus.state === "loading" && <p>Cargando ubicacion...</p>}
					{geoStatus.state === "error" && <p className="error-text">{geoStatus.message}</p>}
					{geoStatus.state === "success" && nearbyStops.length === 0 && <p>No encontramos paradas.</p>}
					{nearbyStops.length > 0 && (
						<div className="stop-grid">
							{nearbyStops.map(({ stop, distance }) => (
								<article key={stop.id} className="stop-card">
									<h3>{stop.name}</h3>
									<p>{stop.lineName}</p>
									<span>{distance.toFixed(2)} km</span>
								</article>
							))}
						</div>
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
						<select value={selectedLineId} onChange={(e) => setSelectedLineId(e.target.value)}>
							{BUS_LINES.map((line) => (
								<option key={line.id} value={line.id}>
									{line.name}
								</option>
							))}
						</select>
					</label>

					<label>
						Salida
						<select value={startStopId} onChange={(e) => setStartStopId(e.target.value)}>
							{activeStops.map((stop) => (
								<option key={stop.id} value={stop.id}>
									{stop.name}
								</option>
							))}
						</select>
					</label>

					<label>
						Destino
						<select value={endStopId} onChange={(e) => setEndStopId(e.target.value)}>
							{activeStops.map((stop) => (
								<option key={stop.id} value={stop.id}>
									{stop.name}
								</option>
							))}
						</select>
					</label>

					<label>
						Fecha y hora
						<input type="datetime-local" value={travelDateTime} onChange={(e) => setTravelDateTime(e.target.value)} />
					</label>

					<button type="submit" className="primary-btn">
						Calcular llegada
					</button>
				</form>
				{scheduleError && <p className="error-text">{scheduleError}</p>}
				{scheduleResult && (
					<div className="schedule-summary">
						<p>
							Linea <strong>{scheduleResult.lineName}</strong>
						</p>
						<p>
							El bus llega a <strong>{scheduleResult.origin}</strong> a las {scheduleResult.startEta.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
						</p>
						<p>
							Llegada a destino <strong>{scheduleResult.destination}</strong> a las {scheduleResult.endEta.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
						</p>
						<p>Duracion estimada: {scheduleResult.totalMinutes.toFixed(1)} min</p>
					</div>
				)}
			</section>

			<section className="bus-section">
				<div className="section-header">
					<span className="section-number">03</span>
					<div>
						<h2>Mapa de lineas</h2>
						<p>Proximamente integraremos un mapa interactivo. De momento veras la referencia visual.</p>
					</div>
				</div>
				<div className="map-placeholder">Imagen</div>
			</section>
		</div>
	);
}

export default Bus;

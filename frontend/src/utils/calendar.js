const DEFAULT_DURATION_MIN = 90;

const pad = (value) => String(value).padStart(2, "0");

const formatCalendarDate = (date) => {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

const escapeICS = (text) => {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
};

const buildIcsContent = (event) => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Furbo Genuine//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatCalendarDate(new Date())}`,
    `DTSTART:${formatCalendarDate(event.start)}`,
    `DTEND:${formatCalendarDate(event.end)}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description)}`,
    `LOCATION:${escapeICS(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
};

export const buildCalendarPayload = (match, teamName = "Mi equipo") => {
  if (!match?.fecha_hora) return null;
  const start = new Date(match.fecha_hora);
  if (Number.isNaN(start.getTime())) return null;
  const durationMinutes = Number(match.duracion_minutos) > 0 ? Number(match.duracion_minutos) : DEFAULT_DURATION_MIN;
  const end = new Date(start.getTime() + durationMinutes * 60000);

  const opponent = match.rival || match.rival_nombre || match.nombre_rival;
  const titleParts = ["Partido", "de", teamName || "mi equipo"];
  if (opponent) {
    titleParts.push("vs", opponent);
  }
  const title = titleParts.join(" ");

  const descriptionPieces = [];
  if (match.descripcion) descriptionPieces.push(match.descripcion);
  if (match.lugar_enlace_maps) descriptionPieces.push(`Mapa: ${match.lugar_enlace_maps}`);
  descriptionPieces.push("Evento generado desde Furbo Genuine.");
  const description = descriptionPieces.join("\n\n");

  const location = match.lugar_nombre || "Por confirmar";
  const dates = `${formatCalendarDate(start)}/${formatCalendarDate(end)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates,
    details: description,
    location,
    sf: "true",
    output: "xml",
  });

  const event = {
    uid: `furbo-${match.id || start.getTime()}@proyectofinal`,
    title,
    description,
    location,
    start,
    end,
  };

  return {
    ...event,
    googleUrl: `https://www.google.com/calendar/render?${params.toString()}`,
    icsContent: buildIcsContent(event),
    icsFilename: `partido-${match.id || start.getTime()}.ics`,
  };
};

export const downloadIcsFile = (icsContent, filename = "partido-furbo.ics") => {
  if (!icsContent) return;
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

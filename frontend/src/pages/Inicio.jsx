// src/pages/Inicio.jsx
import { useEffect, useState } from "react";

const hexToRgb = (hex) => {
  if (!hex) return { r: 33, g: 37, b: 41 };
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const bigint = parseInt(hex, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
};

const getContrastTextColor = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  // Calculamos luminancia relativa (WCAG) para decidir blanco/negro
  const [R, G, B] = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  return L > 0.179 ? "#000" : "#fff";
};

const Inicio = ({ user, team: currentTeamProp, userTeams: userTeamsProp }) => {
  const [teams, setTeams] = useState(userTeamsProp || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Si no tenemos equipos en props, los pedimos al backend
    if ((!teams || teams.length === 0) && user?.id) {
      setLoading(true);
      fetch(`/api/index.php?action=mis_equipos&id_jugador=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setTeams(data.equipos || []);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [user]);

  const teamToShow = currentTeamProp || (teams && teams.length ? teams[0] : null);

  return (
    <div>
      <h1>Hola {user?.nombre || "usuario"}</h1>
      <p>Bienvenido al panel de fútbol. {user?.rol} </p>

      {loading && <p>Cargando equipo...</p>}

      {teamToShow ? (
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 20,
              backgroundColor: teamToShow.color_principal || "#212529",
              color: getContrastTextColor(teamToShow.color_principal || "#212529"),
              border: "2px solid rgba(0,0,0,0.08)",
            }}
            title={teamToShow.nombre}
          >
            {teamToShow.nombre ? teamToShow.nombre.charAt(0).toUpperCase() : "?"}
          </div>

          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{teamToShow.nombre}</div>
            {teamToShow.descripcion && <div className="small text-muted">{teamToShow.descripcion}</div>}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 20 }}>
          <p className="text-muted">No estás asignado a ningún equipo todavía.</p>
        </div>
      )}
    </div>
  );
};

export default Inicio;



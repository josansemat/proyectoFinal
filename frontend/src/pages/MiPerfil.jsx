import { useMemo, useState, useEffect } from "react";
import "./MiPerfil.css";

export default function MiPerfil({ user, currentTeam, onTeamChange }) {
  const initials = useMemo(() => {
    const name = user?.nombre || "?";
    const parts = name.trim().split(" ");
    const first = parts[0]?.[0] || "?";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
    return (first + last).toUpperCase();
  }, [user]);

  const [activeTab, setActiveTab] = useState("datos");
  const [misEquipos, setMisEquipos] = useState([]);
  const [loadingEquipos, setLoadingEquipos] = useState(false);
  const [errorEquipos, setErrorEquipos] = useState("");
  const [partidosTotal, setPartidosTotal] = useState(null);
  const [pwdMsg, setPwdMsg] = useState({ type: null, text: "" });
  const [abandonMsg, setAbandonMsg] = useState({ type: null, text: "" });
  const [confirmAbandonId, setConfirmAbandonId] = useState(null);
  const [abandonLoading, setAbandonLoading] = useState(false);

  // Relación con el equipo actual (para rol y dorsal)
  const relacionEquipoActual = useMemo(() => {
    if (!currentTeam || !misEquipos?.length) return null;
    return misEquipos.find(e => e.id === currentTeam.id) || null;
  }, [misEquipos, currentTeam]);

  // Cargar mis equipos para poder abandonar desde Seguridad
  useEffect(() => {
    const loadEquipos = async () => {
      if (!user?.id) return;
      setLoadingEquipos(true); setErrorEquipos("");
      try {
        const resp = await fetch(`/api/index.php?action=mis_equipos&id_jugador=${user.id}`);
        const data = await resp.json();
        if (data.success) {
          setMisEquipos(data.equipos || []);
        } else {
          setErrorEquipos(data.error || "No se pudieron cargar tus equipos");
        }
      } catch (e) {
        setErrorEquipos("Error de conexión");
      } finally {
        setLoadingEquipos(false);
      }
    };
    loadEquipos();
  }, [user?.id]);

  // Cargar total de partidos jugados (completados)
  useEffect(() => {
    const loadPartidos = async () => {
      if (!user?.id) return;
      try {
        const resp = await fetch(`/api/index.php?action=partidos_jugados&id_jugador=${user.id}`);
        const data = await resp.json();
        if (data.success) setPartidosTotal(data.total);
        else setPartidosTotal(0);
      } catch {
        setPartidosTotal(0);
      }
    };
    loadPartidos();
  }, [user?.id]);

  const abandonarEquipo = async (equipoId) => {
    if (!equipoId) return;
    setAbandonMsg({ type: null, text: "" });
    setAbandonLoading(true);
    try {
      const resp = await fetch('/api/index.php?action=salir_equipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_jugador: user.id, id_equipo: equipoId })
      });
      const data = await resp.json();
      if (data.success) {
        const nueva = misEquipos.filter(e => e.id !== equipoId);
        setMisEquipos(nueva);
        if (currentTeam?.id === equipoId) {
          onTeamChange?.(nueva[0] || null);
          if (!nueva[0]) localStorage.removeItem('equipo_actual_furbo');
        }
        setAbandonMsg({ type: 'success', text: 'Has abandonado el equipo.' });
        setConfirmAbandonId(null);
      } else {
        setAbandonMsg({ type: 'error', text: data.error || 'No fue posible abandonar el equipo.' });
      }
    } catch (e) {
      setAbandonMsg({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setAbandonLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const actual = form.querySelector('input[type="password"][name="pwd_actual"]').value;
    const nueva = form.querySelector('input[type="password"][name="pwd_nueva"]').value;
    const confirma = form.querySelector('input[type="password"][name="pwd_confirma"]').value;
    if (nueva !== confirma) {
      alert('La nueva contraseña y la confirmación no coinciden');
      return;
    }
    try {
      const resp = await fetch('/api/index.php?action=cambiar_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_jugador: user.id, password_actual: actual, password_nueva: nueva })
      });
      const data = await resp.json();
      if (data.success) setPwdMsg({ type: 'success', text: 'Contraseña actualizada.' });
      else setPwdMsg({ type: 'error', text: data.error || 'No se pudo cambiar la contraseña.' });
    } catch (e) {
      setPwdMsg({ type: 'error', text: 'Error de conexión.' });
    }
  };

  return (
    <div className="perfil-page">
      {/* Fondo ilustración */}
      <div className="perfil-bg" aria-hidden="true" />

      {/* Banner de título */}
      <div className="perfil-banner">
        <h1>Mi Perfil</h1>
      </div>

      {/* Layout dos columnas */}
      <div className="perfil-grid">
        {/* Panel Izquierdo: Ficha del Jugador */}
        <section className="panel panel-left">
          <div className="panel-header">Ficha del Jugador</div>

          {/* Avatar */}
          <div className="avatar">
            <span className="avatar-text">{initials}</span>
          </div>

          {/* Nombre y apodo */}
          <div className="identity">
            <div className="name">{user?.nombre || "Jugador"}</div>
            <div className="nickname">{user?.apodo || "Sin apodo"}</div>
          </div>

          {/* Valoración */}
          <div className="rating-block">
            <div className="stars" aria-label="5 estrellas">
              <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
            </div>
            <div className="rating-value">{Number(user?.rating || 5).toFixed(2)} Rating</div>
            <div className="rating-label">Rating</div>
          </div>

          {/* Lista de atributos */}
          <ul className="attributes">
            <li>
              <span className="attr-label">Rol en el equipo</span>
              <span className="attr-value">{relacionEquipoActual?.mi_rol || '—'}</span>
            </li>
            <li>
              <span className="attr-label">Dorsal en el equipo</span>
              <span className="attr-value">{relacionEquipoActual?.dorsal ?? '—'}</span>
            </li>
            <li>
              <span className="attr-label">Apodo</span>
              <span className="attr-value">{user?.apodo || '—'}</span>
            </li>
            <li>
              <span className="attr-label">Partidos Jugados</span>
              <span className="attr-value">{partidosTotal ?? '—'}</span>
            </li>
          </ul>
        </section>

        {/* Panel Derecho: Ajustes y Datos */}
        <section className="panel panel-right">
          <div className="panel-header">Ajustes y Datos</div>

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === "datos" ? "active" : ""}`}
              onClick={() => setActiveTab("datos")}
            >
              Mis Datos
            </button>
            <button
              className={`tab ${activeTab === "seguridad" ? "active" : ""}`}
              onClick={() => setActiveTab("seguridad")}
            >
              Seguridad
            </button>
            <button
              className={`tab ${activeTab === "notificaciones" ? "active" : ""}`}
              onClick={() => setActiveTab("notificaciones")}
            >
              Notificaciones
            </button>
          </div>

          {/* Contenido de pestañas */}
          {activeTab === "datos" && (
            <div className="form">
              <label>Nombre Completo:</label>
              <input type="text" defaultValue={user?.nombre || "----"} />

              <label>Apodo:</label>
              <input type="text" defaultValue={user?.apodo || "----"} />

              <label>Correo electrónico:</label>
              <input type="email" defaultValue={user?.email || "----"} />

              <label>Teléfono:</label>
              <input type="tel" defaultValue={user?.telefono || "----"} />

              <button className="save-btn">Guardar Cambios</button>
            </div>
          )}

          {activeTab === "seguridad" && (
            <div className="seguridad">
              <form className="password-form" onSubmit={handleChangePassword}>
                <label>Contraseña actual</label>
                <input type="password" name="pwd_actual" placeholder="••••••••" required />

                <label>Nueva contraseña</label>
                <input type="password" name="pwd_nueva" placeholder="Nueva contraseña" required />

                <label>Confirmar nueva contraseña</label>
                <input type="password" name="pwd_confirma" placeholder="Repite la contraseña" required />

                <button className="save-btn" type="submit">Guardar Cambios</button>
              </form>

              {pwdMsg.text && (
                <div className={pwdMsg.type === 'success' ? 'success' : 'error'} style={{ marginTop: 8 }}>
                  {pwdMsg.text}
                </div>
              )}

              <div className="abandonar">
                <div className="abandonar-title">Abandonar equipo</div>
                {abandonMsg.text && (
                  <div className={abandonMsg.type === 'success' ? 'success' : 'error'} style={{ marginBottom: 8 }}>
                    {abandonMsg.text}
                  </div>
                )}
                {loadingEquipos && <div className="muted">Cargando equipos...</div>}
                {errorEquipos && <div className="error">{errorEquipos}</div>}
                {!loadingEquipos && misEquipos.length === 0 && (
                  <div className="muted">No perteneces a ningún equipo.</div>
                )}
                {!loadingEquipos && misEquipos.length > 0 && (
                  <div className="abandonar-list">
                    {misEquipos.map(eq => (
                      <div key={eq.id} className="abandonar-item">
                        <span className="eq-name">{eq.nombre}</span>
                        {confirmAbandonId === eq.id ? (
                          <div className="d-flex gap-2">
                            <button
                              className="btn-abandonar"
                              disabled={abandonLoading}
                              onClick={() => abandonarEquipo(eq.id)}
                            >
                              {abandonLoading ? 'Abandonando…' : 'Confirmar'}
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => setConfirmAbandonId(null)}
                              style={{ background: 'transparent', color: 'var(--text)' }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button className="btn-abandonar" onClick={() => setConfirmAbandonId(eq.id)}>
                            Abandonar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === "notificaciones" && (
            <div className="tab-placeholder">Preferencias de notificaciones próximamente.</div>
          )}
        </section>
      </div>
    </div>
  );
}

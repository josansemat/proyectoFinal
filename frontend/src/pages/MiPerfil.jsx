import { useMemo, useState, useEffect } from "react";
import "./MiPerfil.css";

// Iconos simples SVG
const UserIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const ShieldIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const BellIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;

export default function MiPerfil({ user, currentTeam, onTeamChange, onUserUpdate }) {
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
  const [saveMsg, setSaveMsg] = useState({ type: null, text: "" });
  const [formData, setFormData] = useState({
    nombre: user?.nombre || "",
    apodo: user?.apodo || "",
    email: user?.email || "",
    telefono: user?.telefono || "",
  });

  useEffect(() => {
    setFormData({
      nombre: user?.nombre || "",
      apodo: user?.apodo || "",
      email: user?.email || "",
      telefono: user?.telefono || "",
    });
  }, [user]);

  const relacionEquipoActual = useMemo(() => {
    if (!currentTeam || !misEquipos?.length) return null;
    return misEquipos.find(e => e.id === currentTeam.id) || null;
  }, [misEquipos, currentTeam]);

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
          setErrorEquipos(data.error || "Error al cargar equipos");
        }
      } catch (e) {
        setErrorEquipos("Error de conexión");
      } finally {
        setLoadingEquipos(false);
      }
    };
    loadEquipos();
  }, [user?.id]);

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

  const handleSaveDatos = async (e) => {
    e.preventDefault();
    setSaveMsg({ type: null, text: "" });
    const payload = {
      id_jugador: user.id,
      nombre: formData.nombre,
      apodo: formData.apodo || null,
      email: formData.email,
      telefono: formData.telefono || null,
    };
    try {
      const resp = await fetch('/api/index.php?action=actualizar_datos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (data.success) {
        const updatedUser = { ...user, ...payload };
        delete updatedUser.id_jugador;
        localStorage.setItem('usuario_furbo', JSON.stringify(updatedUser));
        if (typeof onUserUpdate === 'function') {
          onUserUpdate(updatedUser);
        }
        setSaveMsg({ type: 'success', text: 'Datos guardados correctamente.' });
      } else {
        setSaveMsg({ type: 'error', text: data.error || 'Error al guardar.' });
      }
    } catch (e) {
      setSaveMsg({ type: 'error', text: 'Error de conexión.' });
    }
  };

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
        setAbandonMsg({ type: 'success', text: 'Equipo abandonado.' });
        setConfirmAbandonId(null);
      } else {
        setAbandonMsg({ type: 'error', text: data.error || 'Error al salir.' });
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
    const actual = form.querySelector('input[name="pwd_actual"]').value;
    const nueva = form.querySelector('input[name="pwd_nueva"]').value;
    const confirma = form.querySelector('input[name="pwd_confirma"]').value;
    if (nueva !== confirma) {
      setPwdMsg({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }
    try {
      const resp = await fetch('/api/index.php?action=cambiar_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_jugador: user.id, password_actual: actual, password_nueva: nueva })
      });
      const data = await resp.json();
      if (data.success) {
        setPwdMsg({ type: 'success', text: 'Contraseña actualizada.' });
        form.reset();
      } else setPwdMsg({ type: 'error', text: data.error || 'Error al cambiar contraseña.' });
    } catch (e) {
      setPwdMsg({ type: 'error', text: 'Error de conexión.' });
    }
  };

  return (
    <div className="perfil-page">
      <header className="perfil-header">
        <h1>Mi Perfil</h1>
      </header>

      <div className="perfil-grid">
        {/* Panel Izquierdo: Ficha Estilo "Carta de Jugador" */}
        <aside className="profile-card">
          <div className="profile-card__header">
            <div className="avatar-container">
              <div className="avatar">{initials}</div>
              <div className="avatar-ring"></div>
            </div>
            <h2 className="profile-name">{user?.nombre || "Jugador"}</h2>
            <p className="profile-nickname">{user?.apodo || "Sin apodo"}</p>
          </div>

          <div className="profile-stats">
            <div className="stat-box">
              <div className="stat-label">Rating</div>
              <div className="stat-value text-accent">{Number(user?.rating || 5).toFixed(1)}</div>
              <div className="stat-stars">★★★★★</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Partidos</div>
              <div className="stat-value">{partidosTotal ?? '-'}</div>
              <div className="stat-sub">Jugados</div>
            </div>
          </div>

          <div className="profile-details">
            <div className="detail-row">
              <span>Equipo actual</span>
              <strong>{currentTeam?.nombre || "Sin equipo"}</strong>
            </div>
            <div className="detail-row">
              <span>Rol</span>
              <span className="badge badge-role">{relacionEquipoActual?.mi_rol || "Agente libre"}</span>
            </div>
            <div className="detail-row">
              <span>Dorsal</span>
              <span className="badge badge-number">{relacionEquipoActual?.dorsal ?? "#"}</span>
            </div>
          </div>
        </aside>

        {/* Panel Derecho: Tabs y Formularios */}
        <main className="settings-panel">
          <div className="settings-tabs">
            <button
              className={`tab-btn ${activeTab === "datos" ? "active" : ""}`}
              onClick={() => setActiveTab("datos")}
            >
              <UserIcon /> Datos
            </button>
            <button
              className={`tab-btn ${activeTab === "seguridad" ? "active" : ""}`}
              onClick={() => setActiveTab("seguridad")}
            >
              <ShieldIcon /> Seguridad
            </button>
            <button
              className={`tab-btn ${activeTab === "notificaciones" ? "active" : ""}`}
              onClick={() => setActiveTab("notificaciones")}
            >
              <BellIcon /> Alertas
            </button>
          </div>

          <div className="settings-content">
            {activeTab === "datos" && (
              <form className="settings-form" onSubmit={handleSaveDatos}>
                <div className="form-group">
                  <label>Nombre Completo</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Apodo (Nombre en camiseta)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.apodo}
                    onChange={(e) => setFormData({ ...formData, apodo: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Correo Electrónico</label>
                  <input
                    type="email"
                    className="form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>

                {saveMsg.text && (
                  <div className={`alert-msg ${saveMsg.type}`}>
                    {saveMsg.text}
                  </div>
                )}

                <div className="form-actions">
                  <button className="btn-primary" type="submit">Guardar Cambios</button>
                </div>
              </form>
            )}

            {activeTab === "seguridad" && (
              <div className="security-section">
                <form className="settings-form mb-4" onSubmit={handleChangePassword}>
                  <h3 className="section-title">Cambiar Contraseña</h3>
                  <div className="form-group">
                    <label>Contraseña Actual</label>
                    <input type="password" name="pwd_actual" className="form-input" placeholder="••••••••" required />
                  </div>
                  <div className="row-2-col">
                    <div className="form-group">
                      <label>Nueva Contraseña</label>
                      <input type="password" name="pwd_nueva" className="form-input" required />
                    </div>
                    <div className="form-group">
                      <label>Confirmar</label>
                      <input type="password" name="pwd_confirma" className="form-input" required />
                    </div>
                  </div>
                  
                  {pwdMsg.text && (
                    <div className={`alert-msg ${pwdMsg.type}`}>
                      {pwdMsg.text}
                    </div>
                  )}
                  
                  <div className="form-actions">
                    <button className="btn-primary" type="submit">Actualizar Password</button>
                  </div>
                </form>

                <div className="danger-zone">
                  <h3 className="section-title text-danger">Zona de Peligro</h3>
                  <p className="text-muted small mb-3">Gestiona tu salida de los equipos a los que perteneces.</p>
                  
                  {abandonMsg.text && (
                    <div className={`alert-msg ${abandonMsg.type} mb-3`}>
                      {abandonMsg.text}
                    </div>
                  )}

                  {loadingEquipos ? (
                    <div className="text-muted small">Cargando equipos...</div>
                  ) : misEquipos.length > 0 ? (
                    <div className="teams-list">
                      {misEquipos.map(eq => (
                        <div key={eq.id} className="team-item">
                          <span className="team-name">{eq.nombre}</span>
                          {confirmAbandonId === eq.id ? (
                            <div className="confirm-actions">
                              <button
                                className="btn-danger btn-sm"
                                disabled={abandonLoading}
                                onClick={() => abandonarEquipo(eq.id)}
                              >
                                {abandonLoading ? '...' : 'Confirmar'}
                              </button>
                              <button
                                className="btn-text btn-sm"
                                onClick={() => setConfirmAbandonId(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button className="btn-outline-danger btn-sm" onClick={() => setConfirmAbandonId(eq.id)}>
                              Abandonar
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted small italic">No perteneces a ningún equipo actualmente.</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "notificaciones" && (
              <div className="empty-state">
                <div className="empty-icon">🔕</div>
                <p>Las preferencias de notificaciones estarán disponibles en la próxima versión.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
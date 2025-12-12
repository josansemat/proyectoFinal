import { useState } from "react";
import '../css/pages/Register.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';


export default function Login({ onLoginSuccess, switchToRegister }) {
    const [form, setForm] = useState({
        email: "",
        password: ""
    });
    const [error, setError] = useState("");
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const response = await fetch("/api/index.php?action=login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(form)
            });

            const data = await response.json();

            if (data.success) {
                // Pasamos los datos del usuario al componente padre (App)
                onLoginSuccess(data.user);
            } else {
                setError(data.error || "Error al iniciar sesión");
            }
        } catch (err) {
            setError("Error de conexión con el servidor");
        }
    };

    const handleForgotPassword = async (e) => {
      e.preventDefault();
      setForgotMessage("");
      setForgotError("");
      setForgotLoading(true);

      try {
        const response = await fetch("/api/index.php?action=forgot_password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: forgotEmail })
        });

        const data = await response.json();

        if (data.success) {
          setForgotMessage("Si el email existe, te acabamos de enviar un enlace de recuperación.");
          setForgotEmail("");
        } else {
          setForgotError(data.error || "No se pudo enviar el correo. Inténtalo más tarde.");
        }
      } catch (err) {
        setForgotError("Error de conexión con el servidor");
      } finally {
        setForgotLoading(false);
      }
    };

   return (
    <div className="register-page">
      <section className="illustration-section">
        <img
          src="login.svg"
          alt="Login illustration"
          className="illustration-image"
        />
      </section>

      <section className="form-section">
        <div className="form-container">
          <h2>Iniciar sesión</h2>
          <p className="subtitle">
            Accede a tu cuenta con tu correo y contraseña.
          </p>
          <div className="form-title-underline"></div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="visually-hidden" htmlFor="login-email">
                Correo electrónico
              </label>
              <span className="input-icon">
                <i className="bi bi-envelope"></i>
              </span>
              <input
                type="email"
                id="login-email"
                name="email"
                placeholder="Correo electrónico"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="input-group">
              <label className="visually-hidden" htmlFor="login-password">
                Contraseña
              </label>
              <span className="input-icon">
                <i className="bi bi-lock"></i>
              </span>
              <input
                type="password"
                id="login-password"
                name="password"
                placeholder="Contraseña"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="forgot-password">
              <button
                type="button"
                className="btn-link"
                onClick={() => setShowForgotPassword(true)}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <div className="button-group">
              <button type="submit" className="btn-primary">
                Entrar
              </button>
            </div>

            <div className="divider">
              <hr />
              <span className="divider-text">¿Eres nuevo por aquí?</span>
              <hr />
            </div>

            <div className="register-link">
              <button
                type="button"
                className="btn-secondary"
                onClick={switchToRegister}
              >
                Crear una cuenta
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="modal-overlay" onClick={() => setShowForgotPassword(false)}>
          <div className="modal-card forgot-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>¿Olvidaste tu contraseña?</h3>
              <button className="icon-btn" type="button" onClick={() => setShowForgotPassword(false)}>
                <i className="bi bi-x"></i>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-text">
                Te enviaremos un enlace temporal al correo asociado a tu cuenta.
              </p>
              <form className="modal-form" onSubmit={handleForgotPassword}>
                <label className="modal-label" htmlFor="forgot-email">Correo electrónico</label>
                <input
                  id="forgot-email"
                  type="email"
                  name="email"
                  placeholder="tu@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
                {forgotError && <div className="error-message small">{forgotError}</div>}
                {forgotMessage && <div className="success-message small">{forgotMessage}</div>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={forgotLoading}>
                    {forgotLoading ? "Enviando..." : "Enviar enlace"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
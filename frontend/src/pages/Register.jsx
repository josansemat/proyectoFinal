import { useState } from "react";
import '../css/pages/Register.css'; // Asegúrate de que este archivo CSS existe

export default function Register({ switchToLogin }) {
    // 1. Añadido el campo 'apodo' al estado inicial
    const [form, setForm] = useState({
        nombre: "",
        apodo: "", // <-- NUEVO
        email: "",
        telefono: "",
        password: "",
    });
    const [feedback, setFeedback] = useState("");
    const [privacyChecked, setPrivacyChecked] = useState(false);
    const [loading, setLoading] = useState(false); // Para desactivar el botón mientras carga

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!privacyChecked) {
            setFeedback("Debes aceptar la política de privacidad para continuar.");
            return;
        }

        setFeedback("Registrando...");
        setLoading(true); // Activar estado de carga

        try {
            const response = await fetch("/api/index.php?action=crear", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(form) // Ahora 'form' incluye el apodo
            });

            const data = await response.json();

            if (data.success) {
                setFeedback("¡Registro exitoso! Redirigiendo al inicio de sesión...");
                // Esperar un poco antes de cambiar de pantalla para que el usuario lea el mensaje
                setTimeout(() => {
                    switchToLogin();
                }, 2000);
            } else {
                setFeedback(data.error || "Error al registrar. Inténtalo de nuevo.");
            }
        } catch (err) {
            console.error("Error de registro:", err);
            setFeedback("Error de conexión con el servidor.");
        } finally {
            setLoading(false); // Desactivar estado de carga
        }
    };

    return (
    <div className="register-page">
      <section className="illustration-section">
        <img
          src="futbol_papa.svg"
          alt="Register illustration"
          className="illustration-image"
        />
      </section>

      <section className="form-section">
        <div className="form-container">
          <h2>Crea una cuenta</h2>
          <p className="subtitle">¡Bienvenido a la familia!</p>
          <div className="form-title-underline"></div>

          {feedback && <div className={`feedback-message ${feedback.includes('exitoso') ? 'success' : 'error'}`}>{feedback}</div>}

          <form onSubmit={handleSubmit}>
            {/* Nombre Completo */}
            <div className="input-group">
              <label className="visually-hidden" htmlFor="register-nombre">
                Nombre completo
              </label>
              <span className="input-icon">
                <i className="bi bi-person"></i>
              </span>
              <input
                type="text"
                id="register-nombre"
                name="nombre"
                placeholder="Nombre completo"
                value={form.nombre}
                onChange={handleChange}
                required
              />
            </div>

            {/* 2. NUEVO INPUT: Apodo (Opcional) */}
            <div className="input-group">
              <label className="visually-hidden" htmlFor="register-apodo">
                Apodo (opcional)
              </label>
              <span className="input-icon">
                <i className="bi bi-star"></i> {/* Icono de estrella para apodo */}
              </span>
              <input
                type="text"
                id="register-apodo"
                name="apodo"
                placeholder="Apodo (opcional)"
                value={form.apodo}
                onChange={handleChange}
              />
            </div>

            {/* Correo Electrónico */}
            <div className="input-group">
              <label className="visually-hidden" htmlFor="register-email">
                Correo electrónico
              </label>
              <span className="input-icon">
                <i className="bi bi-envelope"></i>
              </span>
              <input
                type="email"
                id="register-email"
                name="email"
                placeholder="Correo electrónico"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            {/* Teléfono */}
            <div className="input-group">
              <label className="visually-hidden" htmlFor="register-telefono">
                Teléfono
              </label>
              <span className="input-icon">
                <i className="bi bi-telephone"></i>
              </span>
              <input
                type="tel" // Cambiado a type="tel" para mejor teclado en móviles
                id="register-telefono"
                name="telefono"
                placeholder="Teléfono (9 dígitos)"
                value={form.telefono}
                onChange={handleChange}
                pattern="[0-9]{9}" // Patrón para validar 9 dígitos
                title="El teléfono debe tener exactamente 9 dígitos numéricos"
              />
            </div>

            {/* Contraseña */}
            <div className="input-group">
              <label className="visually-hidden" htmlFor="register-password">
                Contraseña
              </label>
              <span className="input-icon">
                <i className="bi bi-lock"></i>
              </span>
              <input
                type="password"
                id="register-password"
                name="password"
                placeholder="Contraseña"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6} // Mínimo de seguridad básico
              />
            </div>

            {/* Checkbox de Privacidad */}
            <div className="privacy-check" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <input
                type="checkbox"
                id="privacy"
                name="privacy"
                checked={privacyChecked}
                onChange={(e) => setPrivacyChecked(e.target.checked)}
                style={{ width: 'auto', margin: 0 }} // Ajuste de estilo rápido
                />
              <label htmlFor="privacy" style={{ margin: 0, cursor: 'pointer' }}>
                He leído y acepto la{" "}
                <a href="/politica-privacidad.pdf" target="_blank" rel="noopener noreferrer" style={{textDecoration: 'underline'}}>
                  política de privacidad
                </a>
                .
              </label>
            </div>

            <div className="button-group">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Procesando..." : "Crear una cuenta"}
              </button>
            </div>

            <div className="divider">
              <hr />
              <span className="divider-text">¿Ya tienes cuenta?</span>
              <hr />
            </div>

            <div className="login-link">
              <button
                type="button"
                className="btn-secondary"
                onClick={switchToLogin}
              >
                Iniciar sesión
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
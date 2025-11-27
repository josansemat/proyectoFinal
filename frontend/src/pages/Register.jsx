import { useState } from "react";
import './Register.css';

export default function Register({ switchToLogin }) {
    const [form, setForm] = useState({
        nombre: "",
        email: "",
        telefono: "",
        password: "",
        // rating y rol se manejan por defecto en backend para usuarios nuevos
    });
    const [feedback, setFeedback] = useState("");
    const [privacyChecked, setPrivacyChecked] = useState(false);
    const handlePrivacyChange = (e) => {
        setPrivacyChecked(e.target.checked);
    };
    



    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!privacyChecked) {
            setFeedback("Debes aceptar la política de privacidad.");
            return;
        }
        setFeedback("Registrando...");

        try {
            const response = await fetch("/api/index.php?action=crear", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(form)
            });

            const data = await response.json();

            if (data.success) {
                switchToLogin(); // Mandar al usuario al login
            } else {
                setFeedback(data.error || "Error al registrar");
            }
        } catch (err) {
            setFeedback("Error de conexión");
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

          {feedback && <div className="feedback-message">{feedback}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <span className="input-icon">
                <i className="bi bi-person"></i>
              </span>
              <input
                type="text"
                name="nombre"
                placeholder="Nombre completo"
                value={form.nombre}
                onChange={handleChange}
                required
              />
            </div>

            <div className="input-group">
              <span className="input-icon">
                <i className="bi bi-envelope"></i>
              </span>
              <input
                type="email"
                name="email"
                placeholder="Correo electrónico"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="input-group">
              <span className="input-icon">
                <i className="bi bi-telephone"></i>
              </span>
              <input
                type="text"
                name="telefono"
                placeholder="Teléfono"
                value={form.telefono}
                onChange={handleChange}
                pattern="\d{9}"
                title="El teléfono debe tener exactamente 9 números"
              />
            </div>

            <div className="input-group">
              <span className="input-icon">
                <i className="bi bi-lock"></i>
              </span>
              <input
                type="password"
                name="password"
                placeholder="Contraseña"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="privacy-check">
               <input
                type="checkbox"
                id="privacy"
                checked={privacyChecked}
                onChange={(e) => setPrivacyChecked(e.target.checked)}
                />
              <label htmlFor="privacy">
                He leído y acepto la{" "}
                <a href="#" target="_blank" rel="noreferrer">
                  política de privacidad
                </a>
                .
              </label>
            </div>

            <div className="button-group">
              <button type="submit" className="btn-primary">
                Crear una cuenta
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
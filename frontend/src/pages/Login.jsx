import { useState } from "react";
import './Register.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';


export default function Login({ onLoginSuccess, switchToRegister }) {
    const [form, setForm] = useState({
        email: "",
        password: ""
    });
    const [error, setError] = useState("");

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
    </div>
  );
}
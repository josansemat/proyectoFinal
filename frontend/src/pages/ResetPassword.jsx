import { useState } from "react";
import './Register.css';

export default function ResetPassword({ token, switchToLogin }) {
    const [form, setForm] = useState({
        password: "",
        confirmPassword: ""
    });
    const [message, setMessage] = useState("");
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
        setMessage("");

        if (form.password !== form.confirmPassword) {
            setError("Las contraseñas no coinciden");
            return;
        }

        if (form.password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        try {
            const response = await fetch("/api/index.php?action=reset_password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ token, password: form.password })
            });

            const data = await response.json();

            if (data.success) {
                setMessage("Contraseña actualizada correctamente. Puedes iniciar sesión ahora.");
            } else {
                setError(data.error || "Error al actualizar la contraseña");
            }
        } catch (err) {
            setError("Error de conexión con el servidor");
        }
    };

    const goToLogin = () => {
        if (typeof switchToLogin === "function") {
            switchToLogin();
        } else {
            window.location.href = "/";
        }
    };

    return (
        <div className="register-page">
            <section className="illustration-section">
                <img
                    src="login.svg"
                    alt="Reset password illustration"
                    className="illustration-image"
                />
            </section>

            <section className="form-section">
                <div className="form-container">
                    <h2>Restablecer contraseña</h2>
                    <p className="subtitle">
                        Ingresa tu nueva contraseña.
                    </p>
                    <div className="form-title-underline"></div>

                    {error && <div className="error-message">{error}</div>}
                    {message && (
                        <div className="success-message">
                            <p>{message}</p>
                            <div className="success-actions">
                                <button type="button" className="btn-secondary" onClick={goToLogin}>
                                    Volver a iniciar sesión
                                </button>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <span className="input-icon">
                                <i className="bi bi-lock"></i>
                            </span>
                            <input
                                type="password"
                                name="password"
                                placeholder="Nueva contraseña"
                                value={form.password}
                                onChange={handleChange}
                                minLength={6}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <span className="input-icon">
                                <i className="bi bi-lock"></i>
                            </span>
                            <input
                                type="password"
                                name="confirmPassword"
                                placeholder="Confirmar contraseña"
                                value={form.confirmPassword}
                                onChange={handleChange}
                                minLength={6}
                                required
                            />
                        </div>

                        <div className="button-group">
                            <button type="submit" className="btn-primary">
                                Actualizar contraseña
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </div>
    );
}
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

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
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
                alert("¡Registro exitoso! Ahora puedes iniciar sesión.");
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
            {/* Sección Izquierda: Ilustración */}
            <div className="illustration-section">
                <img src="/futbol_papa.svg" alt="Ilustración de seguridad" className="illustration-image" />
            </div>

            {/* Sección Derecha: Formulario */}
            <div className="form-section">
                <div className="form-container">
                    <h2>¡Bienvenido!</h2>
                    {feedback && <p className="feedback-message">{feedback}</p>}

                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <span className="input-icon"><i className="bi bi-person"></i></span> {/* Icono de usuario */}
                            <input type="text" name="nombre" placeholder="Tú nombre" onChange={handleChange} required />
                        </div>
                        <div className="input-group">
                            <span className="input-icon"><i className="bi bi-envelope"></i></span> {/* Icono de email */}
                            <input type="email" name="email" placeholder="Tú correo electrónico" onChange={handleChange} required />
                        </div>
                        {/* Campo de teléfono (opcional, no está en el diseño original) */}
                        <div className="input-group">
                            <span className="input-icon"><i className="bi bi-telephone"></i></span> 
                            <input type="text" name="telefono" placeholder="Teléfono (opcional)" onChange={handleChange} />
                        </div>
                        <div className="input-group">
                            <span className="input-icon"><i className="bi bi-lock"></i></span> {/* Icono de contraseña */}
                            <input type="password" name="password" placeholder="Crea una contraseña" onChange={handleChange} required />
                        </div>
                        
                        <div className="button-group">
                            <button type="submit" className="btn-primary">Crear cuenta</button>
                            <button type="button" className="btn-secondary" onClick={switchToLogin}>Iniciar sesión</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
import { useState } from "react";

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
        <div className="auth-container">
            <h2>Registro de Jugador</h2>
            {feedback && <p>{feedback}</p>}

            <form onSubmit={handleSubmit}>
                <input type="text" name="nombre" placeholder="Nombre completo" onChange={handleChange} required />
                <input type="email" name="email" placeholder="Email" onChange={handleChange} required />
                <input type="text" name="telefono" placeholder="Teléfono" onChange={handleChange} />
                <input type="password" name="password" placeholder="Contraseña" onChange={handleChange} required />
                
                <button type="submit">Fichar Jugador</button>
            </form>

            <p>
                ¿Ya tienes cuenta? <button onClick={switchToLogin}>Inicia Sesión</button>
            </p>
        </div>
    );
}
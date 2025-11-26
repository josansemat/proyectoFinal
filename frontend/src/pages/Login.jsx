import { useState } from "react";

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
        <div className="auth-container">
            <h2>Iniciar Sesión</h2>
            {error && <p style={{ color: "red" }}>{error}</p>}
            
            <form onSubmit={handleSubmit}>
                <div>
                    <input 
                        type="email" 
                        name="email" 
                        placeholder="Correo Electrónico" 
                        onChange={handleChange} 
                        required 
                    />
                </div>
                <div>
                    <input 
                        type="password" 
                        name="password" 
                        placeholder="Contraseña" 
                        onChange={handleChange} 
                        required 
                    />
                </div>
                <button type="submit">Entrar al Campo</button>
            </form>
            
            <p>
                ¿No tienes ficha? <button onClick={switchToRegister}>Regístrate aquí</button>
            </p>
        </div>
    );
}
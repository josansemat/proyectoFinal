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
        // Usamos la misma clase 'register-page' para aprovechar el CSS que ya creamos
        <div className="register-page">
            
            {/* Sección Izquierda: Ilustración */}
            <div className="illustration-section">
                <img src="/login.svg" alt="Login Illustration" className="illustration-image" />
            </div>

            {/* Sección Derecha: Formulario */}
            <div className="form-section">
                <div className="form-container">
                    <h2>¡Bienvenido de nuevo!</h2>
                    
                    {error && <p className="feedback-message" style={{background: 'rgba(255,0,0,0.2)'}}>{error}</p>}
            
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <span className="input-icon"><i className="bi bi-envelope"></i></span>
                            <input 
                                type="email" 
                                name="email" 
                                placeholder="Tú correo electrónico" 
                                onChange={handleChange} 
                                required 
                            />
                        </div>
                        
                        <div className="input-group">
                            <span className="input-icon"><i className="bi bi-lock"></i></span>
                            <input 
                                type="password" 
                                name="password" 
                                placeholder="Contraseña" 
                                onChange={handleChange} 
                                required 
                            />
                        </div>

                        <div className="button-group">
                            {/* Botón Principal: Login */}
                            <button type="submit" className="btn-primary">Iniciar sesión</button>
                            
                            {/* Botón Secundario: Ir al registro */}
                            <button type="button" className="btn-secondary" onClick={switchToRegister}>
                                Crear una cuenta
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
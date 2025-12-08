import { useState } from "react";
import "../css/pages/CreateJugador.css";

const INITIAL_FORM = {
    nombre: "",
    email: "",
    telefono: "",
    password: "",
    rating_habilidad: 5,
    rol: "usuario",
    activo: 1,
};

export default function CreateJugador() {
    const [form, setForm] = useState({ ...INITIAL_FORM });

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({
            ...prev,
            [name]: name === "rating_habilidad" ? parseFloat(value || 0) : name === "activo" ? Number(value) : value,
        }));
    };

    const handleReset = () => setForm({ ...INITIAL_FORM });

    const handleSubmit = async (event) => {
        event.preventDefault();

        const response = await fetch("/api/index.php?action=crear", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(form),
        });

        const data = await response.json();
        console.log("Respuesta:", data);
        alert(data.message || data.error);
    };

    return (
        <div className="container-fluid page-shell create-jugador-page">
            <div className="row justify-content-center">
                <div className="col-12 col-md-10 col-lg-7">
                    <div className="card shadow-sm">
                        <div className="card-header bg-transparent border-0 pb-0">
                            <p className="text-uppercase small text-muted mb-1">Gestión rápida</p>
                            <h2 className="h4 mb-0">Crear jugador</h2>
                        </div>

                        <div className="card-body">
                            <form className="create-jugador-form" onSubmit={handleSubmit}>
                                <div>
                                    <label htmlFor="nombre">Nombre completo</label>
                                    <input
                                        id="nombre"
                                        name="nombre"
                                        type="text"
                                        className="form-control"
                                        placeholder="Ej. Juan Pérez"
                                        value={form.nombre}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="email">Correo electrónico</label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        className="form-control"
                                        placeholder="nombre@ejemplo.com"
                                        value={form.email}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="telefono">Teléfono</label>
                                    <input
                                        id="telefono"
                                        name="telefono"
                                        type="tel"
                                        className="form-control"
                                        placeholder="Opcional"
                                        value={form.telefono}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="password">Contraseña provisoria</label>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        className="form-control"
                                        placeholder="********"
                                        value={form.password}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="rating_habilidad">Rating de habilidad</label>
                                    <input
                                        id="rating_habilidad"
                                        name="rating_habilidad"
                                        type="number"
                                        className="form-control"
                                        step="0.1"
                                        min="0"
                                        max="10"
                                        value={form.rating_habilidad}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="row g-3">
                                    <div className="col-12 col-md-6">
                                        <label htmlFor="rol">Rol</label>
                                        <select
                                            id="rol"
                                            name="rol"
                                            className="form-select"
                                            value={form.rol}
                                            onChange={handleChange}
                                        >
                                            <option value="usuario">Usuario</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <label htmlFor="activo">Estado</label>
                                        <select
                                            id="activo"
                                            name="activo"
                                            className="form-select"
                                            value={form.activo}
                                            onChange={handleChange}
                                        >
                                            <option value={1}>Activo</option>
                                            <option value={0}>Inactivo</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="create-jugador-actions">
                                    <button type="button" className="btn btn-outline-secondary" onClick={handleReset}>
                                        Limpiar
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        Crear jugador
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

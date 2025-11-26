import { useState } from "react";

export default function CreateJugador() {
    const [form, setForm] = useState({
        nombre: "",
        email: "",
        telefono: "",
        password: "",
        rating_habilidad: 5.00,
        rol: "usuario",
        activo: 1
    });

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const response = await fetch("api/index.php?action=crear", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(form)
        });

        const data = await response.json();
        console.log("Respuesta:", data);

        alert(data.message || data.error);
    };

    return (
        <div style={{ maxWidth: "400px", margin: "20px auto" }}>
            <h2>Crear Jugador</h2>

            <form onSubmit={handleSubmit}>
                <input type="text" name="nombre" placeholder="Nombre" onChange={handleChange} required />

                <input type="email" name="email" placeholder="Email" onChange={handleChange} required />

                <input type="text" name="telefono" placeholder="Teléfono" onChange={handleChange} />

                <input type="password" name="password" placeholder="Contraseña" onChange={handleChange} required />

                <input
                    type="number"
                    name="rating_habilidad"
                    step="0.01"
                    min="0"
                    max="10"
                    defaultValue={5}
                    onChange={handleChange}
                />

                <select name="rol" onChange={handleChange}>
                    <option value="usuario">Usuario</option>
                    <option value="admin">Admin</option>
                </select>

                <select name="activo" onChange={handleChange}>
                    <option value="1">Activo</option>
                    <option value="0">Inactivo</option>
                </select>

                <button type="submit">Crear Jugador</button>
            </form>
        </div>
    );
}

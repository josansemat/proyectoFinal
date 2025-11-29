// src/pages/EditarClub.jsx
import React, { useState, useEffect } from 'react';

const EditarClub = ({ user, currentTeam, onTeamUpdate }) => {
  // Estado inicial limpio
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    color_principal: '#000000'
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Cargar datos al entrar
  useEffect(() => {
    if (currentTeam?.id) {
        cargarDatosEquipo();
    }
  }, [currentTeam]);

  const cargarDatosEquipo = async () => {
    setLoading(true);
    try {
        const response = await fetch(`/api/index.php?action=get_equipo&id=${currentTeam.id}`);
        const data = await response.json();

        if (data.success) {
            const eq = data.equipo;
            // Rellenamos el formulario con lo que hay en la BD
            setFormData({
                nombre: eq.nombre,
                descripcion: eq.descripcion || '',
                color_principal: eq.color_principal || '#000000'
            });
        }
    } catch (error) {
        console.error("Error", error);
    } finally {
        setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
        ...formData,
        [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: 'Guardando...', type: 'info' });

    try {
        const response = await fetch('/api/index.php?action=update_equipo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_equipo: currentTeam.id,
                id_usuario: user.id,
                rol_global: user.rol,
                ...formData // Enviamos los datos del formulario
            })
        });

        const data = await response.json();

        if (data.success) {
            setMessage({ text: '¡Cambios guardados!', type: 'success' });
            
            // Actualizamos la App globalmente mezclando los datos viejos con los nuevos
            if (onTeamUpdate) {
                onTeamUpdate({
                    ...currentTeam, // Mantenemos ID, rol, etc.
                    nombre: data.nuevo_nombre, // Actualizamos nombre si cambió
                    color_principal: data.nuevo_color // Actualizamos color si cambió
                });
            }
        } else {
            setMessage({ text: data.error || 'Error al guardar', type: 'error' });
        }
    } catch (error) {
        setMessage({ text: 'Error de conexión', type: 'error' });
    }
  };

  if (!currentTeam) return <div className="p-4">Selecciona un equipo primero.</div>;
  if (loading) return <div className="p-4">Cargando...</div>;

  return (
    <div className="p-4 container" style={{ maxWidth: '600px' }}>
      <h2 className="mb-4">Personalizar Club</h2>
      
      {message.text && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : message.type} mb-3`}>
            {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-4 shadow-sm border-0" style={{backgroundColor: 'var(--bg-light)', color: '#000'}}>
        
        <div className="mb-3">
            <label className="form-label fw-bold">Nombre del Equipo</label>
            <input 
                type="text" 
                className="form-control" 
                name="nombre" 
                value={formData.nombre} 
                onChange={handleChange} 
                // Ya no es 'required' estricto en HTML, pero el backend lo validará si lo envías vacío
                placeholder="Nombre del club"
            />
        </div>

        <div className="mb-3">
            <label className="form-label fw-bold">Color Principal</label>
            <div className="d-flex align-items-center gap-3">
                <input 
                    type="color" 
                    className="form-control form-control-color" 
                    name="color_principal" 
                    value={formData.color_principal} 
                    onChange={handleChange} 
                />
                <span className="text-muted">{formData.color_principal}</span>
            </div>
        </div>

        <div className="mb-3">
            <label className="form-label fw-bold">Descripción</label>
            <textarea 
                className="form-control" 
                name="descripcion" 
                rows="2" 
                value={formData.descripcion} 
                onChange={handleChange}
            ></textarea>
        </div>

        <button type="submit" className="btn btn-primary w-100 fw-bold"
            style={{ 
                backgroundColor: formData.color_principal, 
                borderColor: formData.color_principal,
                filter: 'brightness(0.9)',
                color: '#fff' 
            }}>
            Guardar Cambios
        </button>

      </form>
    </div>
  );
};

export default EditarClub;
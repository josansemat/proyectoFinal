// frontend/src/pages/EditarClub.jsx
import React, { useState, useEffect } from 'react';

// (Se han eliminado las constantes de URL base externas)

const EditarClub = ({ user, currentTeam, onTeamUpdate }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    color_principal: '#000000'
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

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
            setFormData({
                nombre: eq.nombre,
                descripcion: eq.descripcion || '',
                color_principal: eq.color_principal || '#000000'
            });
        } else {
            console.error("Error del servidor:", data.error);
        }
    } catch (error) {
        console.error("Error cargando equipo", error);
    } finally {
        setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
      if (e.target.files && e.target.files[0]) {
          setSelectedFile(e.target.files[0]);
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: 'Subiendo datos...', type: 'info' });

    try {
        const dataToSend = new FormData();
        dataToSend.append('id_equipo', currentTeam.id);
        dataToSend.append('id_usuario', user.id);
        dataToSend.append('rol_global', user.rol);
        dataToSend.append('nombre_actual', currentTeam.nombre); 
        
        if (formData.nombre) dataToSend.append('nombre', formData.nombre);
        if (formData.descripcion) dataToSend.append('descripcion', formData.descripcion);
        if (formData.color_principal) dataToSend.append('color_principal', formData.color_principal);
        
        if (selectedFile) {
            dataToSend.append('imagen_fondo', selectedFile);
        }

        const response = await fetch('/api/index.php?action=update_equipo', {
            method: 'POST',
            body: dataToSend 
        });

        const data = await response.json();

        if (data.success) {
            setMessage({ text: '¡Cambios guardados con éxito!', type: 'success' });
            setSelectedFile(null); 
            e.target.reset();
            
            if (onTeamUpdate) {
                onTeamUpdate({
                    ...currentTeam,
                    nombre: data.nuevo_nombre,
                    color_principal: data.nuevo_color,
                    fondo_imagen: data.nuevo_fondo || currentTeam.fondo_imagen
                });
            }
        } else {
            setMessage({ text: data.error || 'Error al guardar', type: 'error' });
        }
    } catch (error) {
        setMessage({ text: 'Error de conexión', type: 'error' });
        console.error(error);
    }
  };

  if (!currentTeam) return <div className="p-4">Selecciona un equipo primero.</div>;
  if (loading) return <div className="p-4">Cargando datos...</div>;

  const isButtonLight = ['#ffffff', '#f0f0f0', '#ffff00', '#f8f9fa'].includes(formData.color_principal.toLowerCase());

  return (
    <div className="p-4 container" style={{ maxWidth: '600px' }}>
      <h2 className="mb-4">Personalizar Club</h2>
      
      {message.text && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : message.type} mb-3`}>
            {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-4 shadow-sm border-0">
        
        <div className="mb-3">
            <label className="form-label fw-bold">Nombre del Equipo</label>
            <input type="text" className="form-control" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre del club"/>
        </div>

        <div className="mb-3">
            <label className="form-label fw-bold">Color Principal</label>
            <div className="d-flex align-items-center gap-3">
                <input type="color" className="form-control form-control-color" name="color_principal" value={formData.color_principal} onChange={handleChange} />
                <span className="text-muted">{formData.color_principal}</span>
            </div>
        </div>

        {/* --- CAMPO: IMAGEN DE FONDO --- */}
        <div className="mb-4 p-3 bg-light rounded border">
            <label className="form-label fw-bold mb-2">Imagen de Fondo del Equipo</label>
            
            <input 
                type="file" 
                className="form-control mb-2" 
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
            />
            <div className="form-text small text-muted mb-2">
                Formatos: JPG, PNG, WEBP. <span className="text-danger fw-bold">Máximo 2MB.</span>
            </div>
            <div className="form-text small text-muted mb-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => window.location.reload()}>
                    Si no cambia el fondo ¡pulsame!
                </button>
            </div>

            {/* Vista previa del fondo ACTUAL */}
            {currentTeam.fondo_imagen && !selectedFile && (
                 <div className="mt-3">
                    <p className="fw-bold small mb-1">Fondo actual:</p>
                    <img 
                        // CAMBIO CRÍTICO: Ruta directa a la carpeta public del frontend
                        src={`/fondos/${currentTeam.fondo_imagen}`}
                        alt="Fondo actual" 
                        className="img-fluid rounded shadow-sm border" 
                        style={{maxHeight: '150px', objectFit: 'cover', width: '100%'}} 
                        // Fallback SVG
                        onError={(e) => { 
                            e.target.onerror = null; 
                            e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='150' viewBox='0 0 400 150'%3E%3Crect width='400' height='150' fill='%23f8f9fa'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%236c757d'%3EImagen no disponible%3C/text%3E%3C/svg%3E"; 
                        }}
                    />
                 </div>
            )}
             
             {/* Vista previa del NUEVO archivo */}
             {selectedFile && (
                 <div className="mt-3 p-2 bg-white border rounded text-success d-flex align-items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-check-circle-fill me-2" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>
                    <div>
                        <strong>Archivo listo para subir:</strong><br/>
                        <small>{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</small>
                    </div>
                 </div>
            )}
        </div>
        {/* ------------------------------------ */}

        <div className="mb-3">
            <label className="form-label fw-bold">Descripción</label>
            <textarea className="form-control" name="descripcion" rows="2" value={formData.descripcion} onChange={handleChange}></textarea>
        </div>

        <button type="submit" className="btn btn-primary w-100 fw-bold py-2" 
            style={{ 
                backgroundColor: formData.color_principal, 
                borderColor: formData.color_principal,
                color: isButtonLight ? '#000' : '#fff' 
            }}>
            {selectedFile ? 'Subir Imagen y Guardar Cambios' : 'Guardar Cambios'}
        </button>

      </form>
    </div>
  );
};

export default EditarClub;
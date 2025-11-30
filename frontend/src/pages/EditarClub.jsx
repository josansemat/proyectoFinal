import React, { useState, useEffect } from 'react';
// IMPORTANTE: Asegúrate de importar el nuevo archivo CSS
import './EditarClub.css';

const EditarClub = ({ user, currentTeam, onTeamUpdate }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    color_principal: '#000000',
    fondo_imagen: '' 
  });
  
  const [listaFondos, setListaFondos] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    if (currentTeam?.id) {
        Promise.all([
            cargarDatosEquipo(),
            cargarListaFondos()
        ]).finally(() => setLoading(false));
    }
  }, [currentTeam]);

  const cargarListaFondos = async () => {
      try {
          const response = await fetch('/api/index.php?action=get_fondos');
          const data = await response.json();
          if (data.success) {
              setListaFondos(data.fondos);
          }
      } catch (error) {
          console.error("Error cargando lista de fondos", error);
      }
  };

  const cargarDatosEquipo = async () => {
    try {
        const response = await fetch(`/api/index.php?action=get_equipo&id=${currentTeam.id}`);
        const data = await response.json();

        if (data.success) {
            const eq = data.equipo;
            setFormData(prev => ({
                ...prev,
                nombre: eq.nombre,
                descripcion: eq.descripcion || '',
                color_principal: eq.color_principal || '#000000',
                fondo_imagen: eq.fondo_imagen || ''
            }));
        } else {
            console.error("Error del servidor:", data.error);
        }
    } catch (error) {
        console.error("Error cargando equipo", error);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: 'Guardando...', type: 'info' });

    try {
        const dataToSend = new FormData();
        dataToSend.append('id_equipo', currentTeam.id);
        dataToSend.append('id_usuario', user.id);
        dataToSend.append('rol_global', user.rol);
        dataToSend.append('nombre_actual', currentTeam.nombre); 
        
        if (formData.nombre) dataToSend.append('nombre', formData.nombre);
        if (formData.descripcion) dataToSend.append('descripcion', formData.descripcion);
        if (formData.color_principal) dataToSend.append('color_principal', formData.color_principal);
        
        if (formData.fondo_imagen) {
            dataToSend.append('fondo_imagen', formData.fondo_imagen);
        }

        const response = await fetch('/api/index.php?action=update_equipo', {
            method: 'POST',
            body: dataToSend 
        });

        const data = await response.json();

        if (data.success) {
            setMessage({ text: '¡Cambios guardados con éxito!', type: 'success' });
            
            if (onTeamUpdate) {
                onTeamUpdate({
                    ...currentTeam,
                    nombre: data.nuevo_nombre,
                    color_principal: data.nuevo_color,
                    fondo_imagen: data.nuevo_fondo
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

  if (!currentTeam) return <div className="p-4 text-white">Selecciona un equipo primero.</div>;
  if (loading) return <div className="p-4 text-white">Cargando datos...</div>;

  const isButtonLight = ['#ffffff', '#f0f0f0', '#ffff00', '#f8f9fa'].includes(formData.color_principal.toLowerCase());

  return (
    /* Eliminado maxWidth para que ocupe más espacio en escritorio */
    <div className="container py-5 editar-club-wrapper">
      
      {/* Banner del título */}
      <div className="club-title-banner shadow-sm">
        <h2 className="text-center m-0">Personalizar Club</h2>
      </div>
      
      {message.text && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : message.type} my-3`}>
            {message.text}
        </div>
      )}

      {/* Formulario card */}
      <form onSubmit={handleSubmit} className="card club-form-card p-4 shadow-lg border-0">
        <div className="row g-4"> {/* 'g-4' añade espacio entre columnas */}
            
            {/* COLUMNA IZQUIERDA: Inputs de texto */}
            <div className="col-lg-6 d-flex flex-column gap-3">
                <div>
                    <label className="form-label fw-bold fs-5">Nombre del Equipo</label>
                    <input type="text" className="form-control form-control-lg" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre del club"/>
                </div>

                <div>
                    <label className="form-label fw-bold fs-5">Color Principal</label>
                    <div className="d-flex align-items-center gap-3 p-2 border rounded bg-light">
                        <input type="color" className="form-control form-control-color" name="color_principal" value={formData.color_principal} onChange={handleChange} title="Elige el color" />
                        <span className="text-muted fw-bold">{formData.color_principal}</span>
                    </div>
                </div>

                <div className="flex-grow-1 d-flex flex-column">
                    <label className="form-label fw-bold fs-5">Descripción</label>
                    {/* Hacemos que el textarea ocupe el alto disponible */}
                    <textarea className="form-control flex-grow-1" name="descripcion" rows="5" value={formData.descripcion} onChange={handleChange} style={{resize: 'none'}}></textarea>
                </div>
            </div>

            {/* COLUMNA DERECHA: Selector de imagen y Preview */}
            <div className="col-lg-6">
                <div className="p-4 bg-light rounded border h-100 d-flex flex-column">
                    <label className="form-label fw-bold mb-3 fs-5">Imagen de Fondo</label>
                    
                    <select 
                        className="form-select form-select-lg mb-4" 
                        name="fondo_imagen" 
                        value={formData.fondo_imagen} 
                        onChange={handleChange}
                    >
                        <option value="">-- Sin fondo / Por defecto --</option>
                        {listaFondos.map((fondo, index) => (
                            <option key={index} value={fondo}>
                                {fondo}
                            </option>
                        ))}
                    </select>

                    <div className="mt-auto text-center">
                        <p className="fw-bold mb-2 fs-5">Vista Previa:</p>
                        {/* Contenedor de preview mucho más grande */}
                        <div className="preview-container shadow-sm mx-auto">
                            {formData.fondo_imagen ? (
                                <img 
                                    src={`/fondos/${formData.fondo_imagen}`}
                                    alt="Vista previa" 
                                    className="preview-image"
                                    onError={(e) => {
                                        e.target.onerror = null; 
                                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='150' viewBox='0 0 400 150'%3E%3Crect width='400' height='150' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23aaa'%3EError imagen%3C/text%3E%3C/svg%3E";
                                    }}
                                />
                            ) : (
                                <div className="d-flex align-items-center justify-content-center h-100 text-muted bg-white">
                                    <span>Sin imagen seleccionada</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Botón de guardar (ocupa todo el ancho abajo) */}
            <div className="col-12 mt-4">
                <button type="submit" className="btn btn-primary w-100 fw-bold py-3 fs-5 btn-guardar shadow-sm" 
                    style={{ 
                        backgroundColor: formData.color_principal, 
                        borderColor: formData.color_principal,
                        color: isButtonLight ? '#000' : '#fff' 
                    }}>
                    Guardar Cambios
                </button>
            </div>
        </div>
      </form>
    </div>
  );
};

export default EditarClub;
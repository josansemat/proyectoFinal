// src/components/TeamSelection.jsx
import React from 'react';

const TeamSelection = ({ teams, onSelectTeam }) => {
  // Estilos en línea para un prototipo rápido
  const containerStyle = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100vh', backgroundColor: '#f8f9fa', padding: '20px'
  };
  const cardStyle = {
    backgroundColor: 'white', padding: '30px', borderRadius: '15px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px', width: '100%'
  };
  const teamButtonStyle = (color) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
    padding: '15px 20px', margin: '10px 0', border: `2px solid ${color || '#ccc'}`,
    borderRadius: '10px', backgroundColor: 'white', cursor: 'pointer',
    fontSize: '1.1rem', fontWeight: '600', transition: 'all 0.3s ease'
  });
  const teamColorStyle = (color) => ({
    width: '30px', height: '30px', borderRadius: '50%', backgroundColor: color,
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
  });

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>Elige tu Equipo</h2>
        <p style={{ marginBottom: '30px', color: '#666' }}>Selecciona el equipo con el que quieres acceder.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {teams.map((team) => (
            <button
              key={team.id}
              style={teamButtonStyle(team.color_principal)}
              onClick={() => onSelectTeam(team)}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              <span>{team.nombre}</span>
              <div style={teamColorStyle(team.color_principal)}></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamSelection;
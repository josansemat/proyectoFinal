// src/pages/Inicio.jsx
const Inicio = ({ user }) => {
  return (
    <div>
      <h1>Hola {user?.nombre || "usuario"}</h1>
      <p>Bienvenido al panel de fútbol. {user.rol}</p>
    </div>
  );
};

export default Inicio;



// src/pages/Inicio.jsx
import { useEffect, useState } from "react";
import "./Inicio.css"; // añadimos un CSS para estilos chulos

const Inicio = () => {
  const [displayText, setDisplayText] = useState("");
  const fullText = "🚧 Estamos en construcción 🚧";

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayText(fullText.slice(0, i + 1));
      i++;
      if (i === fullText.length) clearInterval(interval);
    }, 120); // velocidad del efecto
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="inicio-container">
      <h1 className="construction-text">{displayText}</h1>
      <p className="sub-text">Pronto tendrás novedades increíbles aquí...</p>
    </div>
  );
};

export default Inicio;

import "./ManualUso.css";

const steps = [
  {
    title: "Paso 1 - Preparar el rinconcito",
    description:
      "Busca un lugar tranquilo, con tu tablet o compu cargada y conexión a internet. Respira hondo y sonríe, porque Furbo es tu amiguito digital.",
    tips: [
      "Ten a mano tu usuario y tu contraseña. Si no los recuerdas, pide ayuda a un adulto.",
      "Si es de noche, baja el brillo para no cansar tus ojitos.",
    ],
  },
  {
    title: "Paso 2 - Entrar en Furbo",
    description:
      "Abre la app, toca 'Iniciar sesión' y escribe tus datos despacito. Cuando todo esté listo, pulsa el botón azul grande.",
    tips: [
      "Si ves un mensaje rojo, revisa que ninguna casilla esté vacía.",
      "¿Olvidaste la contraseña? Usa el botón de 'Recuperar' y sigue las instrucciones simples.",
    ],
  },
  {
    title: "Paso 3 - Elegir tu equipo",
    description:
      "En la esquina izquierda verás el escudo del equipo. Tócalo y elige el club con el que quieres jugar hoy.",
    tips: [
      "Los equipos se muestran en una lista. El que tiene un tick verde es el que está activo.",
      "Si solo tienes un equipo, no necesitas cambiar nada: Furbo ya lo eligió por ti.",
    ],
  },
  {
    title: "Paso 4 - Explorar el menú",
    description:
      "En la barra lateral hay muchos botones con dibujitos. Lee el nombre y tócalo para visitar cada pantalla.",
    tips: [
      "Plantilla te muestra a tus compañeros.",
      "Partidos abre el calendario y te deja crear nuevas convocatorias.",
      "Ranking enseña quién ha jugado más o ha marcado más goles.",
    ],
  },
  {
    title: "Paso 5 - Crear o apuntarte a un partido",
    description:
      "Dentro de Partidos, toca el botón 'Crear partido'. Completa la fecha, la hora y el lugar como si estuvieras contando una historia.",
    tips: [
      "No dejes campos vacíos, Furbo te avisará si falta algo.",
      "Cuando todo esté correcto, confirma y espera a que tus amigos se apunten.",
    ],
  },
  {
    title: "Paso 6 - Revisar tu perfil",
    description:
      "Ve a 'Mi perfil' para ver tus datos, tu posición y editar tu foto. Revisa que todo esté correcto.",
    tips: [
      "Si cambiaste de número o correo, actualízalo para que las notificaciones lleguen bien.",
      "Guarda los cambios antes de irte a otra pantalla.",
    ],
  },
  {
    title: "Paso 7 - Cerrar sesión con un hasta luego",
    description:
      "Cuando termines, pulsa 'Cerrar sesión' en la parte de abajo del menú. Así guardas todo y evitas sustos.",
    tips: [
      "Si compartes el dispositivo, cerrar sesión es súper importante.",
      "Para volver a entrar, repite los pasos 1 y 2. ¡Listo!",
    ],
  },
];

const newWords = [
  { word: "Convocatoria", meaning: "Lista de personas invitadas a un partido." },
  { word: "Manager", meaning: "La persona que organiza el equipo dentro de Furbo." },
  { word: "Ranking", meaning: "Una tabla con los logros y estadísticas de los jugadores." },
];

const ManualUso = () => {
  return (
    <div className="manual-page">
      <header className="manual-hero">
        <p className="manual-kicker">Guía fácil y tranquila</p>
        <h1>Manual de uso paso a paso</h1>
      </header>

      <section className="manual-steps">
        {steps.map((step) => (
          <article key={step.title} className="manual-card">
            <h2>{step.title}</h2>
            <p>{step.description}</p>
            <ul>
              {step.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="manual-glossary">
        <h2>Palabras nuevas</h2>
        <p>
          Si alguna palabra suena rara, mírala aquí. Las explicaciones son cortitas para que las entiendas
          de inmediato.
        </p>
        <div className="manual-glossary-grid">
          {newWords.map((item) => (
            <div key={item.word} className="manual-mini-card">
              <h3>{item.word}</h3>
              <p>{item.meaning}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="manual-help">
        <h2>¿Necesitas ayuda extra?</h2>
        <ol>
          <li>Lee el paso completo otra vez y hazlo con calma.</li>
          <li>Si algo no se mueve, revisa tu conexión a internet.</li>
          <li>Habla con un adulto o con tu manager para que revisen contigo.</li>
          <li>Escríbenos a <a href="mailto:info@laferiadepepe.es">info@laferiadepepe.es</a>. Cuéntanos qué botón no entiendes y te respondemos.</li>
        </ol>
        <p className="manual-closing">Recuerda: Furbo es un compañero paciente. Puedes intentar las veces que necesites.</p>
      </section>
    </div>
  );
};

export default ManualUso;

import "../css/pages/ManualUso.css";

const MANUAL_PDF_URL = "/Manual.pdf";

const ManualUso = () => {
  return (
    <div className="manual-page">
      <header className="manual-hero">
        <p className="manual-kicker">Guía fácil y tranquila</p>
        <h1>Manual de uso paso a paso</h1>
      </header>

      <section className="manual-pdf">
        <h2>Manual en PDF</h2>
        <p>
          Si no se ve dentro de la página, puedes abrirlo en otra pestaña: {" "}
          <a href={MANUAL_PDF_URL} target="_blank" rel="noreferrer">Abrir manual</a>.
        </p>
        <div className="manual-pdf-frame" aria-label="Visor del manual en PDF">
          <object data={MANUAL_PDF_URL} type="application/pdf" className="manual-pdf-object">
            <p>
              Tu navegador no puede mostrar el PDF aquí. {" "}
              <a href={MANUAL_PDF_URL} target="_blank" rel="noreferrer">Ábrelo en otra pestaña</a>.
            </p>
          </object>
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

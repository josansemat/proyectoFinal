import "./PoliticaPrivacidad.css";

const todayLabel = "5 de diciembre de 2025";

function PoliticaPrivacidad() {
  return (
    <div className="privacy-page">
      <header className="privacy-hero">
        <p className="privacy-kicker">Transparencia y confianza</p>
        <h1>Política de privacidad</h1>
        <p>
          Esta Política explica cómo Furbo Genuine ("Furbo", "nosotros") recoge, usa y protege los datos
          personales de quienes utilizan nuestra plataforma de gestión de equipos y partidos de fútbol amateur.
          Cumplimos con el Reglamento General de Protección de Datos (RGPD) y la normativa española aplicable.
        </p>
        <p className="privacy-meta">Última actualización: {todayLabel}</p>
      </header>

      <section className="privacy-section">
        <h2>1. ¿Qué datos recopilamos?</h2>
        <p>Recogemos únicamente la información necesaria para prestar y mejorar el servicio:</p>
        <ul>
          <li><strong>Identificación y contacto:</strong> nombre, apodo, correo electrónico, teléfono y fotografía opcional.</li>
          <li><strong>Datos deportivos:</strong> equipos a los que perteneces, posición, estadísticas, disponibilidad e histórico de partidos.</li>
          <li><strong>Datos transaccionales:</strong> registros de pagos de pista, recordatorios y confirmaciones asociados a cada partido.</li>
          <li><strong>Información técnica:</strong> identificadores de dispositivo, tokens de notificaciones push, logs de acceso y uso básico de la app.</li>
          <li><strong>Ubicación aproximada:</strong> solo cuando facilitas direcciones o enlazas ubicaciones en Google Maps para organizar partidos.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>2. ¿Para qué usamos los datos?</h2>
        <p>Tratamos los datos personales con finalidades legítimas y proporcionadas:</p>
        <ul>
          <li>Gestionar tu cuenta, tus equipos y los diferentes roles dentro del club.</li>
          <li>Organizar partidos, convocatorias, listas de espera, recordatorios de pago y votaciones internas.</li>
          <li>Enviar comunicaciones operativas (notificaciones push, correos y avisos dentro de la app).</li>
          <li>Mejorar la plataforma, elaborar métricas agregadas y detectar usos fraudulentos.</li>
          <li>Cumplir obligaciones legales, por ejemplo en materia contable o de seguridad de la información.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>3. Base legal del tratamiento</h2>
        <p>Según el RGPD, las principales bases jurídicas que utilizamos son:</p>
        <ul>
          <li><strong>Ejecución de un contrato:</strong> para darte acceso a Furbo y permitirte gestionar tus equipos.</li>
          <li><strong>Interés legítimo:</strong> para mantener la seguridad de la plataforma, prevenir abusos y ofrecer soporte.</li>
          <li><strong>Consentimiento:</strong> para enviar notificaciones push, newsletters o mostrar determinados datos en listados públicos.</li>
          <li><strong>Obligación legal:</strong> cuando debemos conservar información a efectos fiscales o atender requerimientos de autoridades.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>4. ¿Compartimos tus datos?</h2>
        <p>
          No vendemos tus datos. Solo los compartimos con proveedores que nos ayudan a prestar el servicio y siempre bajo
          contratos de encargo de tratamiento:
        </p>
        <ul>
          <li>Infraestructura cloud, alojamiento y bases de datos ubicados en la Unión Europea.</li>
          <li>Servicios de envío de correos y notificaciones push (por ejemplo, Firebase Cloud Messaging).</li>
          <li>Herramientas de soporte y analítica necesarias para detectar incidencias o medir el rendimiento.</li>
        </ul>
        <p>
          Si una transferencia exige sacar datos fuera del Espacio Económico Europeo, aplicamos cláusulas contractuales
          tipo u otras garantías reconocidas por la Comisión Europea.
        </p>
      </section>

      <section className="privacy-section">
        <h2>5. Conservación de los datos</h2>
        <p>
          Guardamos la información mientras mantengas tu cuenta activa. Tras solicitar la baja, bloqueamos los datos y los
          eliminamos una vez transcurridos los plazos legales (normalmente 5 años para documentación contractual o fiscal).
          Los registros técnicos y métricas anonimizadas pueden conservarse más tiempo para fines estadísticos.
        </p>
      </section>

      <section className="privacy-section">
        <h2>6. Tus derechos</h2>
        <p>Como titular de los datos puedes ejercer en cualquier momento:</p>
        <ul>
          <li>Acceso, rectificación o supresión de tus datos personales.</li>
          <li>Limitación u oposición al tratamiento en determinadas circunstancias.</li>
          <li>Portabilidad de los datos que nos facilitaste de forma estructurada.</li>
          <li>Retirada del consentimiento sin que ello afecte a la licitud previa del tratamiento.</li>
        </ul>
        <p>
          Escríbenos a <a href="mailto:info@laferiadepepe.es">info@laferiadepepe.es</a> indicando el derecho que quieres ejercer y adjuntando un documento que
          acredite tu identidad. Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia
          Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noreferrer noopener">www.aepd.es</a>).
        </p>
      </section>

      <section className="privacy-section">
        <h2>7. Seguridad</h2>
        <p>
          Aplicamos controles técnicos y organizativos para proteger tu información: conexiones cifradas (HTTPS), gestión
          segmentada de accesos, copias de seguridad y monitorización de incidentes. Revisamos periódicamente estas medidas
          para adaptarlas a nuevas amenazas.
        </p>
      </section>

      <section className="privacy-section">
        <h2>8. Cambios en la Política</h2>
        <p>
          Podemos actualizar esta política para reflejar mejoras del servicio, exigencias legales o nuevas funcionalidades.
          Cuando ocurra, lo indicaremos en la parte superior y podremos avisarte por correo o dentro de la app. Te recomendamos
          revisarla de forma periódica.
        </p>
      </section>

      <section className="privacy-section">
        <h2>9. Contacto</h2>
        <p>
          Si tienes dudas relacionadas con la protección de datos, ponte en contacto con nuestro equipo a través de
          <a href="mailto:info@laferiadepepe.es"> info@laferiadepepe.es</a>. También puedes escribirnos a través del centro de soporte disponible en la app.
        </p>
      </section>
    </div>
  );
}

export default PoliticaPrivacidad;

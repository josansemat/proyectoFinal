<?php
require_once 'cors.php';
require_once '../models/Partido.php';
require_once '../models/Equipo.php';
require_once '../models/FcmToken.php';
require_once '../services/FirebaseNotifier.php';

class PartidosController {
    private function assertManagerPermissions(array $data): void {
        $idEquipo = isset($data['id_equipo']) ? (int)$data['id_equipo'] : 0;
        $idUsuario = isset($data['id_usuario']) ? (int)$data['id_usuario'] : 0;
        $rolGlobal = $data['rol_global'] ?? 'usuario';

        if ($idEquipo <= 0) {
            throw new InvalidArgumentException('Falta el identificador del equipo');
        }
        if ($idUsuario <= 0) {
            throw new InvalidArgumentException('Falta el identificador del usuario');
        }

        if ($rolGlobal === 'admin') {
            return;
        }

        if (!Equipo::esManager($idUsuario, $idEquipo)) {
            throw new InvalidArgumentException('Solo los managers del equipo o administradores pueden gestionar partidos');
        }
    }

    private function assertManagerForPartido(array $partido, int $idUsuario, string $rolGlobal, string $errorMessage = 'Solo un manager o administrador puede realizar esta acción'): void {
        if ($rolGlobal === 'admin') {
            return;
        }

        $idEquipo = isset($partido['id_equipo']) ? (int)$partido['id_equipo'] : 0;
        if (!$idEquipo || !Equipo::esManager($idUsuario, $idEquipo)) {
            throw new InvalidArgumentException($errorMessage);
        }
    }

    private function formatearFechaHumana(?string $fecha): string {
        if (!$fecha) {
            return '';
        }
        try {
            $dt = new DateTimeImmutable($fecha);
            return $dt->format('d/m H:i');
        } catch (Exception $e) {
            return $fecha;
        }
    }

    private function enviarNotificacionPartido(array $partido, string $titulo, string $mensaje, array $extraData = []): void {
        $idEquipo = isset($partido['id_equipo']) ? (int)$partido['id_equipo'] : 0;
        $idPartido = isset($partido['id']) ? (int)$partido['id'] : 0;
        if ($idEquipo <= 0 || $idPartido <= 0) {
            return;
        }

        $tokens = FcmToken::listActiveTokensByEquipo($idEquipo);
        if (empty($tokens)) {
            return;
        }

        $data = array_merge([
            'type' => 'partido',
            'id_partido' => (string)$idPartido,
            'id_equipo' => (string)$idEquipo,
            'click_action' => '/partidos',
        ], $extraData);

        $notification = [
            'title' => $titulo,
            'body' => $mensaje,
        ];

        try {
            FirebaseNotifier::sendMulticast($tokens, $notification, $data);
        } catch (Throwable $e) {
            error_log('No se pudo enviar la notificación de partido: ' . $e->getMessage());
        }
    }

    private function notificarPartidoCreado(int $idPartido): void {
        $partido = Partido::getById($idPartido);
        if (!$partido) {
            return;
        }
        $fecha = $this->formatearFechaHumana($partido['fecha_hora'] ?? null);
        $lugar = trim((string)($partido['lugar_nombre'] ?? '')); 
        $mensajeBase = $fecha ? sprintf('%s · %s', $fecha, $lugar) : $lugar;
        $mensaje = trim($mensajeBase) ?: 'Revisa los detalles del próximo partido';
        $this->enviarNotificacionPartido($partido, 'Nuevo partido programado', $mensaje, [
            'event' => 'partido_creado',
        ]);
    }

    private function notificarVotacionHabilitada(array $partido): void {
        $fecha = $this->formatearFechaHumana($partido['fecha_hora'] ?? null);
        $this->enviarNotificacionPartido($partido, 'Votaciones disponibles', sprintf('Ya puedes votar el partido de %s', $fecha ?: 'tu equipo'), [
            'event' => 'partido_votaciones',
        ]);
    }

    public function listar() {
        $filters = [
            'search' => $_GET['search'] ?? null,
            'estado' => $_GET['estado'] ?? null,
            'page' => $_GET['page'] ?? 1,
            'limit' => $_GET['limit'] ?? 10,
            'includeDeleted' => ($_GET['include_deleted'] ?? '0') === '1',
            'id_equipo' => isset($_GET['id_equipo']) ? (int)$_GET['id_equipo'] : null,
        ];
        $withStats = ($_GET['with_stats'] ?? '0') === '1';

        try {
            $result = Partido::listar($filters);
            $response = [
                'success' => true,
                'partidos' => $result['items'],
                'page' => $result['page'],
                'limit' => $result['limit'],
                'total' => $result['total'],
                'totalPages' => $result['totalPages'],
            ];
            if ($withStats) {
                $response['stats'] = Partido::resumenDashboard($filters['id_equipo']);
            }
            echo json_encode($response);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error listar partidos: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudieron cargar los partidos']);
        }
    }

    public function crear() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $this->assertManagerPermissions($data);
            $id = Partido::create($data);
            if ($id) {
                $this->notificarPartidoCreado((int)$id);
            }
            echo json_encode(['success' => (bool)$id, 'id' => $id]);
        } catch (InvalidArgumentException $ex) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $ex->getMessage()]);
        } catch (Exception $e) {
            error_log('Error crear partido: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo crear el partido']);
        }
    }

    public function actualizar() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = isset($data['id']) ? (int)$data['id'] : 0;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID inválido']);
            return;
        }
        try {
            $this->assertManagerPermissions($data);
            $ok = Partido::update($id, $data);
            echo json_encode(['success' => (bool)$ok]);
        } catch (InvalidArgumentException $ex) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $ex->getMessage()]);
        } catch (Exception $e) {
            error_log('Error actualizar partido: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo actualizar el partido']);
        }
    }

    public function eliminar() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = isset($data['id']) ? (int)$data['id'] : (int)($_GET['id'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID inválido']);
            return;
        }
        if ($idUsuario <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Falta el usuario que elimina']);
            return;
        }
        try {
            $partido = Partido::getById($id);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            $esAdmin = $rolGlobal === 'admin';
            $esManager = Equipo::esManager($idUsuario, (int)$partido['id_equipo']);
            if (!$esAdmin && !$esManager) {
                throw new InvalidArgumentException('Solo un manager o administrador puede eliminar el partido');
            }
            $ok = Partido::softDelete($id);
            echo json_encode(['success' => (bool)$ok]);
        } catch (InvalidArgumentException $ex) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $ex->getMessage()]);
        } catch (Exception $e) {
            error_log('Error eliminar partido: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo eliminar el partido']);
        }
    }

    public function detalle() {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID inválido']);
            return;
        }
        try {
            $detalle = Partido::detalleCompleto($id);
            echo json_encode(['success' => true] + $detalle);
        } catch (InvalidArgumentException $e) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error detalle partido: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo obtener el detalle del partido']);
        }
    }

    public function inscribirJugador() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idPartido = (int)($data['id_partido'] ?? 0);
        $idJugador = (int)($data['id_jugador'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';
        if ($idPartido <= 0 || $idJugador <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Parámetros inválidos']);
            return;
        }
        if ($idUsuario <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Falta el usuario que realiza la acción']);
            return;
        }

        try {
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            $esAdmin = $rolGlobal === 'admin';
            $esManager = Equipo::esManager($idUsuario, (int)$partido['id_equipo']);
            $esMismoJugador = $idUsuario === $idJugador;
            if (!$esMismoJugador && !$esManager && !$esAdmin) {
                throw new InvalidArgumentException('Solo el manager o el propio jugador pueden inscribirse');
            }
            $result = Partido::inscribirJugador($idPartido, $idJugador, $data);
            echo json_encode(['success' => true] + $result);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error inscribir jugador: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo inscribir al jugador']);
        }
    }

    public function desinscribirJugador() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idPartido = (int)($data['id_partido'] ?? 0);
        $idJugador = (int)($data['id_jugador'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';
        if ($idPartido <= 0 || $idJugador <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Parámetros inválidos']);
            return;
        }
        if ($idUsuario <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Falta el usuario que realiza la acción']);
            return;
        }

        try {
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            $esAdmin = $rolGlobal === 'admin';
            $esManager = Equipo::esManager($idUsuario, (int)$partido['id_equipo']);
            $esMismoJugador = $idUsuario === $idJugador;
            if (!$esMismoJugador && !$esManager && !$esAdmin) {
                throw new InvalidArgumentException('Solo el manager o el propio jugador pueden salir del partido');
            }
            $result = Partido::desinscribirJugador($idPartido, $idJugador);
            echo json_encode(['success' => true] + $result);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error desinscribir jugador: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo quitar al jugador']);
        }
    }

    public function guardarFormacion() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $idPartido = (int)($data['id_partido'] ?? 0);
            $idUsuario = (int)($data['id_usuario'] ?? 0);
            $rolGlobal = $data['rol_global'] ?? 'usuario';
            if ($idPartido <= 0 || $idUsuario <= 0) {
                throw new InvalidArgumentException('Faltan datos para guardar la formación');
            }
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            $esAdmin = $rolGlobal === 'admin';
            $esManager = Equipo::esManager($idUsuario, (int)$partido['id_equipo']);
            if (!$esAdmin && !$esManager) {
                throw new InvalidArgumentException('Solo un manager puede modificar la formación');
            }
            $result = Partido::guardarFormacion($data);
            echo json_encode(['success' => true] + $result);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error guardar formación: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo guardar la formación']);
        }
    }

    public function listarChat() {
        $idPartido = isset($_GET['id_partido']) ? (int)$_GET['id_partido'] : 0;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
        if ($idPartido <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Parámetros inválidos']);
            return;
        }
        try {
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            $mensajes = Partido::listarChat($idPartido, $limit);
            echo json_encode([
                'success' => true,
                'messages' => $mensajes,
                'chat_open' => Partido::chatEstaAbierto($partido),
                'chat_close' => Partido::chatCierreIso($partido),
            ]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error listar chat: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo cargar el chat']);
        }
    }

    public function publicarChat() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idPartido = (int)($data['id_partido'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';
        $mensaje = trim((string)($data['mensaje'] ?? ''));
        if ($idPartido <= 0 || $idUsuario <= 0 || $mensaje === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos de chat inválidos']);
            return;
        }
        try {
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            if (!Partido::chatEstaAbierto($partido)) {
                throw new InvalidArgumentException('El chat está cerrado para este partido');
            }
            $esAdmin = $rolGlobal === 'admin';
            $esManager = Equipo::esManager($idUsuario, (int)$partido['id_equipo']);
            $puedeHablar = $esAdmin || $esManager || Partido::jugadorPuedeParticiparChat($partido, $idUsuario);
            if (!$puedeHablar) {
                throw new InvalidArgumentException('No puedes enviar mensajes en este chat');
            }
            $nuevo = Partido::agregarChatMensaje($partido, $idUsuario, $mensaje);
            echo json_encode([
                'success' => true,
                'message' => $nuevo,
                'chat_open' => true,
            ]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error publicar chat: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo enviar el mensaje']);
        }
    }

    public function activarVotacion() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idPartido = (int)($data['id_partido'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';
        if ($idPartido <= 0 || $idUsuario <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
            return;
        }
        try {
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            if (($partido['estado'] ?? '') !== 'completado') {
                throw new InvalidArgumentException('Las votaciones solo se habilitan al terminar el partido');
            }
            $esAdmin = $rolGlobal === 'admin';
            $esManager = Equipo::esManager($idUsuario, (int)$partido['id_equipo']);
            if (!$esAdmin && !$esManager) {
                throw new InvalidArgumentException('Solo un manager puede habilitar las votaciones');
            }
            $ok = Partido::activarVotacion($idPartido);
            if ($ok) {
                $this->notificarVotacionHabilitada($partido);
            }
            echo json_encode(['success' => (bool)$ok]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error activar votación: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo activar la votación']);
        }
    }

    public function recordarPago() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idPartido = (int)($data['id_partido'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';

        if ($idPartido <= 0 || $idUsuario <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos para el recordatorio']);
            return;
        }

        try {
            $metricas = Partido::metricasEconomicas($idPartido);
            $partido = $metricas['partido'];
            $this->assertManagerForPartido($partido, $idUsuario, $rolGlobal, 'Solo un manager o administrador puede enviar recordatorios de pago');

            $costo = $metricas['costo_jugador'];
            if ($costo === null) {
                throw new InvalidArgumentException('Configura el precio del partido antes de enviar recordatorios de pago');
            }

            $inscritos = (int)$metricas['total_inscritos'];
            $pagos = (int)$metricas['pagos_confirmados'];
            $body = sprintf('Pago pendiente: €%0.2f por jugador · Pagados %d/%d', $costo, $pagos, max($inscritos, 1));

            $this->enviarNotificacionPartido($partido, 'Recordatorio de pago', $body, [
                'event' => 'partido_recordatorio_pago',
                'costo_jugador' => (string)$costo,
                'total_inscritos' => (string)$inscritos,
                'pagos_confirmados' => (string)$pagos,
            ]);

            echo json_encode(['success' => true, 'message' => 'Recordatorio de pago enviado']);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error enviando recordatorio de pago: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo enviar el recordatorio']);
        }
    }

    public function recordarInicio() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idPartido = (int)($data['id_partido'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';

        if ($idPartido <= 0 || $idUsuario <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos para el recordatorio']);
            return;
        }

        try {
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            $this->assertManagerForPartido($partido, $idUsuario, $rolGlobal, 'Solo un manager o administrador puede enviar recordatorios');
            if (($partido['estado'] ?? '') !== 'programado') {
                throw new InvalidArgumentException('Solo puede recordarse partidos programados');
            }

            $fecha = $partido['fecha_hora'] ?? null;
            if (!$fecha) {
                throw new InvalidArgumentException('La fecha del partido no está configurada');
            }

            try {
                $fechaPartido = new DateTimeImmutable($fecha);
            } catch (Exception $e) {
                throw new InvalidArgumentException('Fecha del partido inválida');
            }
            $ahora = new DateTimeImmutable('now');
            $diffSegundos = $fechaPartido->getTimestamp() - $ahora->getTimestamp();
            if ($diffSegundos <= 0) {
                throw new InvalidArgumentException('El partido ya comenzó o finalizó');
            }

            $horas = $diffSegundos / 3600;
            if ($horas > 24) {
                throw new InvalidArgumentException('El recordatorio de 24h solo puede enviarse en el día previo');
            }

            $horasRestantes = max(1, (int)ceil($horas));
            $body = sprintf('Faltan %d h para el partido en %s. Revisa la convocatoria.', $horasRestantes, $partido['lugar_nombre'] ?? 'la pista');

            $this->enviarNotificacionPartido($partido, 'El partido es mañana', $body, [
                'event' => 'partido_recordatorio_24h',
                'hours_remaining' => (string)$horasRestantes,
            ]);

            echo json_encode(['success' => true, 'message' => 'Recordatorio enviado']);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error enviando recordatorio de partido: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo enviar el recordatorio']);
        }
    }

    public function actualizarPagoJugador() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idPartido = (int)($data['id_partido'] ?? 0);
        $idJugador = (int)($data['id_jugador'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';
        $pagado = !empty($data['pagado']);

        if ($idPartido <= 0 || $idJugador <= 0 || $idUsuario <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos para actualizar el pago']);
            return;
        }

        try {
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            $this->assertManagerForPartido($partido, $idUsuario, $rolGlobal, 'Solo un manager o administrador puede actualizar pagos');
            Partido::actualizarPagoJugador($idPartido, $idJugador, $pagado);
            echo json_encode(['success' => true, 'pagado' => $pagado]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error actualizando pago de jugador: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo actualizar el pago']);
        }
    }

    public function registrarEvento() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idPartido = (int)($data['id_partido'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';
        if ($idPartido <= 0 || $idUsuario <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
            return;
        }
        try {
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            if (!Partido::estadoPermiteEventos($partido['estado'] ?? '')) {
                throw new InvalidArgumentException('Los eventos solo pueden registrarse en curso o al finalizar el partido');
            }
            $esAdmin = $rolGlobal === 'admin';
            $esManager = Equipo::esManager($idUsuario, (int)$partido['id_equipo']);
            if (!$esAdmin && !$esManager) {
                throw new InvalidArgumentException('Solo un manager puede añadir eventos');
            }
            $evento = Partido::registrarEvento($partido, $data);
            echo json_encode(['success' => true, 'evento' => $evento]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error registrar evento: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo registrar el evento']);
        }
    }

    public function eliminarEvento() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idPartido = (int)($data['id_partido'] ?? 0);
        $idEvento = (int)($data['id_evento'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';
        if ($idPartido <= 0 || $idEvento <= 0 || $idUsuario <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
            return;
        }
        try {
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            $esAdmin = $rolGlobal === 'admin';
            $esManager = Equipo::esManager($idUsuario, (int)$partido['id_equipo']);
            if (!$esAdmin && !$esManager) {
                throw new InvalidArgumentException('Solo un manager puede eliminar eventos');
            }
            $ok = Partido::eliminarEvento($idPartido, $idEvento);
            echo json_encode(['success' => (bool)$ok]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error eliminar evento: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo eliminar el evento']);
        }
    }

    public function votarCategoria() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idPartido = (int)($data['id_partido'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $idVotado = (int)($data['id_votado'] ?? 0);
        $categoria = $data['categoria'] ?? '';
        $rolGlobal = $data['rol_global'] ?? 'usuario';
        if ($idPartido <= 0 || $idUsuario <= 0 || $idVotado <= 0 || $categoria === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos para votar']);
            return;
        }
        try {
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            if (empty($partido['votacion_habilitada']) || ($partido['estado'] ?? '') !== 'completado') {
                throw new InvalidArgumentException('Las votaciones no están disponibles para este partido');
            }
            $modo = Partido::obtenerModoVotacion($idPartido);
            $esAdmin = $rolGlobal === 'admin';
            $esManager = Equipo::esManager($idUsuario, (int)$partido['id_equipo']);
            $esParticipante = Partido::jugadorInscritoEnPartido($idPartido, $idUsuario);

            if ($modo === 'manager') {
                if (!$esAdmin && !$esManager) {
                    throw new InvalidArgumentException('Solo los managers pueden votar en este modo');
                }
            } else {
                if (!$esAdmin && !$esManager && !$esParticipante) {
                    throw new InvalidArgumentException('Debes haber jugado el partido para votar');
                }
            }

            if (!Partido::jugadorInscritoEnPartido($idPartido, $idVotado)) {
                throw new InvalidArgumentException('Solo puedes votar jugadores inscritos');
            }

            $permitirExcepcion = $modo === 'manager' && ($esAdmin || $esManager) && !$esParticipante;
            $voto = Partido::registrarVotoCategoria($partido, $idUsuario, $categoria, $idVotado, $permitirExcepcion);
            echo json_encode(['success' => true, 'voto' => $voto]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error votar categoria: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo registrar el voto']);
        }
    }

    public function votarMvp() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idPartido = (int)($data['id_partido'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $idVotado = (int)($data['id_votado'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';
        if ($idPartido <= 0 || $idUsuario <= 0 || $idVotado <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos para votar']);
            return;
        }
        try {
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            if (empty($partido['votacion_habilitada']) || ($partido['estado'] ?? '') !== 'completado') {
                throw new InvalidArgumentException('Las votaciones no están disponibles para este partido');
            }
            $modo = Partido::obtenerModoVotacion($idPartido);
            $esAdmin = $rolGlobal === 'admin';
            $esManager = Equipo::esManager($idUsuario, (int)$partido['id_equipo']);
            $esParticipante = Partido::jugadorInscritoEnPartido($idPartido, $idUsuario);

            if ($modo === 'manager') {
                if (!$esAdmin && !$esManager) {
                    throw new InvalidArgumentException('Solo los managers pueden votar en este modo');
                }
            } else {
                if (!$esAdmin && !$esManager && !$esParticipante) {
                    throw new InvalidArgumentException('Debes haber jugado el partido para votar');
                }
            }

            if (!Partido::jugadorInscritoEnPartido($idPartido, $idVotado)) {
                throw new InvalidArgumentException('Solo puedes votar jugadores inscritos');
            }

            $permitirExcepcion = $modo === 'manager' && ($esAdmin || $esManager) && !$esParticipante;
            $voto = Partido::registrarVotoMvp($partido, $idUsuario, $idVotado, $permitirExcepcion);
            echo json_encode(['success' => true, 'voto' => $voto]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error votar mvp: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo registrar el voto']);
        }
    }

    public function calificarJugadores() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idPartido = (int)($data['id_partido'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';
        $ratings = $data['ratings'] ?? null;

        if ($idPartido <= 0 || $idUsuario <= 0 || !is_array($ratings)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos para calificar']);
            return;
        }

        try {
            $partido = Partido::getById($idPartido);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            if (($partido['estado'] ?? '') !== 'completado') {
                throw new InvalidArgumentException('Solo se pueden calificar partidos completados');
            }
            $esAdmin = $rolGlobal === 'admin';
            $esManager = Equipo::esManager($idUsuario, (int)$partido['id_equipo']);
            if (!$esAdmin && !$esManager) {
                throw new InvalidArgumentException('Solo los managers pueden asignar notas');
            }
            if (empty($ratings)) {
                throw new InvalidArgumentException('Debes enviar las notas de los jugadores');
            }
            $result = Partido::registrarRatingsJugadores($partido, $idUsuario, $ratings);
            echo json_encode(['success' => true] + $result);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error calificar jugadores: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudieron guardar las calificaciones']);
        }
    }

    public function rankingEquipo() {
        $idEquipo = isset($_GET['id_equipo']) ? (int)$_GET['id_equipo'] : 0;
        $idUsuario = isset($_GET['id_usuario']) ? (int)$_GET['id_usuario'] : 0;
        $rolGlobal = $_GET['rol_global'] ?? 'usuario';
        if ($idEquipo <= 0 || $idUsuario <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Parámetros inválidos para ranking']);
            return;
        }
        try {
            $esAdmin = $rolGlobal === 'admin';
            $perteneceEquipo = Partido::jugadorPerteneceEquipo($idUsuario, $idEquipo);
            $esManager = Equipo::esManager($idUsuario, $idEquipo);
            if (!$esAdmin && !$perteneceEquipo && !$esManager) {
                throw new InvalidArgumentException('No tienes permisos para ver el ranking de este club');
            }
            $ranking = Partido::rankingEquipo($idEquipo);
            echo json_encode(['success' => true] + $ranking);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('Error ranking equipo: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo generar el ranking']);
        }
    }
}

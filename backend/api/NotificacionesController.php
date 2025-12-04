<?php
require_once 'cors.php';
require_once '../models/FcmToken.php';
require_once '../models/Equipo.php';
require_once '../services/FirebaseNotifier.php';

class NotificacionesController
{
    public function registrarToken(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idJugador = (int)($data['id_jugador'] ?? 0);
        $token = trim((string)($data['token'] ?? ''));
        $device = isset($data['device']) ? substr((string)$data['device'], 0, 500) : null;

        if ($idJugador <= 0 || $token === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Faltan datos para registrar el token']);
            return;
        }

        try {
            FcmToken::upsert($idJugador, $token, $device);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            error_log('Error registrando token FCM: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo registrar el token']);
        }
    }

    public function desactivarToken(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $token = trim((string)($data['token'] ?? ''));
        $idJugador = (int)($data['id_jugador'] ?? 0);

        if ($token === '' && $idJugador <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Falta token o id de jugador']);
            return;
        }

        try {
            if ($token !== '') {
                FcmToken::deactivateByToken($token);
            } else {
                FcmToken::deactivateAllForUser($idJugador);
            }
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            error_log('Error desactivando token FCM: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo desactivar el token']);
        }
    }

    public function notificarEquipo(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $idEquipo = (int)($data['id_equipo'] ?? 0);
        $idUsuario = (int)($data['id_usuario'] ?? 0);
        $rolGlobal = $data['rol_global'] ?? 'usuario';

        if ($idEquipo <= 0 || $idUsuario <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Falta el equipo o el usuario emisor']);
            return;
        }

        $esAdmin = $rolGlobal === 'admin';
        $esManager = Equipo::esManager($idUsuario, $idEquipo);
        if (!$esAdmin && !$esManager) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'No tienes permisos para enviar notificaciones a este equipo']);
            return;
        }

        $notification = [
            'title' => trim((string)($data['titulo'] ?? 'Furbo')), 
            'body' => trim((string)($data['mensaje'] ?? '')),
        ];
        if (!empty($data['icon'])) {
            $notification['icon'] = $data['icon'];
        }
        if (!empty($data['image'])) {
            $notification['image'] = $data['image'];
        }

        $payloadData = isset($data['data']) && is_array($data['data']) ? $data['data'] : [];
        if (!isset($payloadData['click_action']) && !empty($data['click_action'])) {
            $payloadData['click_action'] = $data['click_action'];
        }
        if (!isset($payloadData['type']) && !empty($data['tipo'])) {
            $payloadData['type'] = $data['tipo'];
        }
        $payloadData['id_equipo'] = (string)$idEquipo;

        try {
            $tokens = FcmToken::listActiveTokensByEquipo($idEquipo);
            if (empty($tokens)) {
                echo json_encode(['success' => true, 'message' => 'No hay tokens activos para este equipo']);
                return;
            }
            $result = FirebaseNotifier::sendMulticast($tokens, $notification, $payloadData);
            echo json_encode(['success' => true, 'enviados' => $result['success'], 'fallidos' => $result['failure']]);
        } catch (Exception $e) {
            error_log('Error enviando notificación: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo enviar la notificación', 'details' => $e->getMessage()]);
        }
    }

    public function notificarUsuarios(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $usuarios = isset($data['ids_jugadores']) && is_array($data['ids_jugadores']) ? $data['ids_jugadores'] : [];
        $rolGlobal = $data['rol_global'] ?? 'usuario';

        if ($rolGlobal !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Solo los administradores pueden usar este envío']);
            return;
        }

        if (empty($usuarios)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Debes indicar al menos un jugador']);
            return;
        }

        $notification = [
            'title' => trim((string)($data['titulo'] ?? 'Furbo')),
            'body' => trim((string)($data['mensaje'] ?? '')),
        ];
        $payloadData = isset($data['data']) && is_array($data['data']) ? $data['data'] : [];

        try {
            $tokens = FcmToken::listActiveTokensByUsers($usuarios);
            if (empty($tokens)) {
                echo json_encode(['success' => true, 'message' => 'Los usuarios no tienen tokens activos']);
                return;
            }
            $result = FirebaseNotifier::sendMulticast($tokens, $notification, $payloadData);
            echo json_encode(['success' => true, 'enviados' => $result['success'], 'fallidos' => $result['failure']]);
        } catch (Exception $e) {
            error_log('Error enviando notificación masiva: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudo enviar la notificación', 'details' => $e->getMessage()]);
        }
    }
}

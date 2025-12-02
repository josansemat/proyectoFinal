<?php
require_once 'cors.php';
require_once '../models/Partido.php';
require_once '../models/Equipo.php';

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
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID inválido']);
            return;
        }
        try {
            $ok = Partido::softDelete($id);
            echo json_encode(['success' => (bool)$ok]);
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
        if ($idPartido <= 0 || $idJugador <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Parámetros inválidos']);
            return;
        }

        try {
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
        if ($idPartido <= 0 || $idJugador <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Parámetros inválidos']);
            return;
        }

        try {
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
}

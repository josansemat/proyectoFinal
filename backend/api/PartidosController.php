<?php
require_once 'cors.php';
require_once '../models/Partido.php';

class PartidosController {
    public function listar() {
        $filters = [
            'search' => $_GET['search'] ?? null,
            'estado' => $_GET['estado'] ?? null,
            'page' => $_GET['page'] ?? 1,
            'limit' => $_GET['limit'] ?? 10,
            'includeDeleted' => ($_GET['include_deleted'] ?? '0') === '1',
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
                $response['stats'] = Partido::resumenDashboard();
            }
            echo json_encode($response);
        } catch (Exception $e) {
            error_log('Error listar partidos: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudieron cargar los partidos']);
        }
    }

    public function crear() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
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
}

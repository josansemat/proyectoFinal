<?php
require_once 'cors.php';
require_once '../models/Bus.php';

class BusController {
    public function lineas(): void {
        $lineaId = isset($_GET['linea_id']) ? (int)$_GET['linea_id'] : null;
        try {
            $lineas = Bus::listLineas($lineaId);
            echo json_encode(['success' => true, 'lineas' => $lineas]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('BusController::lineas error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudieron cargar las lineas']);
        }
    }

    public function paradas(): void {
        $search = $_GET['search'] ?? null;
        try {
            $paradas = Bus::listParadas($search);
            echo json_encode(['success' => true, 'paradas' => $paradas]);
        } catch (Exception $e) {
            error_log('BusController::paradas error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudieron cargar las paradas']);
        }
    }

    public function horarios(): void {
        $lineaId = isset($_GET['linea_id']) ? (int)$_GET['linea_id'] : 0;
        $tipoDia = $_GET['tipo_dia'] ?? null;
        if ($lineaId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'linea_id es obligatorio']);
            return;
        }
        try {
            $horarios = Bus::listHorarios($lineaId, $tipoDia);
            echo json_encode(['success' => true, 'horarios' => $horarios]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (Exception $e) {
            error_log('BusController::horarios error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'No se pudieron cargar los horarios']);
        }
    }
}

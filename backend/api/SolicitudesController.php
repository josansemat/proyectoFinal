<?php
require_once 'cors.php';
require_once '../models/Solicitud.php';
require_once '../models/Equipo.php'; // Necesario para verificar permisos si aplica

class SolicitudesController {

    // ACCIÓN 1: Jugador envía solicitud (POST)
    public function solicitarUnirse() {
        $data = json_decode(file_get_contents("php://input"), true);
        if (empty($data['id_jugador']) || empty($data['id_equipo'])) {
            echo json_encode(["success" => false, "error" => "Faltan datos"]); return;
        }
        try {
            Solicitud::crear($data['id_jugador'], $data['id_equipo']);
            echo json_encode(["success" => true, "message" => "Solicitud enviada correctamente"]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    }

    // ACCIÓN 2: Manager ve solicitudes pendientes (GET) - CON LIMPIEZA AUTOMÁTICA
    public function verPendientes() {
        $idEquipo = $_GET['id_equipo'] ?? null;
        if (!$idEquipo) { echo json_encode(["success" => false, "error" => "Falta ID equipo"]); return; }
        try {
            // LIMPIEZA PEREZOSA: Borrar antiguas antes de listar
            Solicitud::borrarAntiguas(3); 
            
            $pendientes = Solicitud::getPendientesPorEquipo($idEquipo);
            echo json_encode(["success" => true, "solicitudes" => $pendientes]);
        } catch (Exception $e) {
             echo json_encode(["success" => false, "error" => "Error al obtener solicitudes"]);
        }
    }

    // ACCIÓN 3: Manager responde (POST)
    public function responder() {
        $data = json_decode(file_get_contents("php://input"), true);
        if (empty($data['id_solicitud']) || empty($data['estado']) || empty($data['id_equipo_manager'])) {
             echo json_encode(["success" => false, "error" => "Faltan datos"]); return;
        }
        $estado = strtolower($data['estado']);
        if ($estado !== 'aceptada' && $estado !== 'rechazada') {
             echo json_encode(["success" => false, "error" => "Estado inválido"]); return;
        }
        try {
            Solicitud::responder($data['id_solicitud'], $estado, $data['id_equipo_manager']);
            $msg = ($estado === 'aceptada') ? "Jugador aceptado." : "Solicitud rechazada.";
            echo json_encode(["success" => true, "message" => $msg]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    }
    
    // ACCIÓN 4: IDs solicitados por jugador (GET)
    public function misSolicitudesPendientes() {
         $idJugador = $_GET['id_jugador'] ?? null;
         if(!$idJugador) { echo json_encode(["success" => false, "ids" => []]); return; }
         $ids = Solicitud::getIdsEquiposSolicitadosPorJugador($idJugador);
         echo json_encode(["success" => true, "ids" => $ids]);
    }
}
?>
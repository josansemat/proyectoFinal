<?php
// backend/models/Solicitud.php
require_once __DIR__ . '/../config/FutbolDB.php';

class Solicitud {
    // Crear una nueva solicitud
    public static function crear($idJugador, $idEquipo) {
        $conexion = FutbolDB::connectDB();
        
        // 1. Verificar si ya está en el equipo
        $stmtCheckMiembro = $conexion->prepare("SELECT 1 FROM jugadores_equipos WHERE idjugador = ? AND idequipo = ?");
        $stmtCheckMiembro->execute([$idJugador, $idEquipo]);
        if ($stmtCheckMiembro->fetch()) {
            throw new Exception("Ya eres miembro de este equipo.");
        }

        // 2. Verificar si ya tiene una solicitud pendiente para este equipo
        $stmtCheckPendiente = $conexion->prepare("SELECT 1 FROM solicitudes_equipo WHERE id_jugador = ? AND id_equipo = ? AND estado = 'pendiente'");
        $stmtCheckPendiente->execute([$idJugador, $idEquipo]);
        if ($stmtCheckPendiente->fetch()) {
            throw new Exception("Ya tienes una solicitud pendiente para este equipo.");
        }

        // 3. Insertar la solicitud
        $sql = "INSERT INTO solicitudes_equipo (id_jugador, id_equipo, estado) VALUES (?, ?, 'pendiente')";
        $stmt = $conexion->prepare($sql);
        return $stmt->execute([$idJugador, $idEquipo]);
    }

    // Obtener solicitudes pendientes para un equipo (Para el Manager)
    public static function getPendientesPorEquipo($idEquipo) {
        $conexion = FutbolDB::connectDB();
        $sql = "SELECT s.id, s.id_jugador, s.fecha_solicitud, j.nombre as nombre_jugador, j.apodo
                FROM solicitudes_equipo s
                JOIN jugadores j ON s.id_jugador = j.id
                WHERE s.id_equipo = ? AND s.estado = 'pendiente'
                ORDER BY s.fecha_solicitud ASC";
        $stmt = $conexion->prepare($sql);
        $stmt->execute([$idEquipo]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Responder a una solicitud (Aceptar o Rechazar)
    public static function responder($idSolicitud, $nuevoEstado, $idEquipoDelManager) {
        $conexion = FutbolDB::connectDB();
        $conexion->beginTransaction();

        try {
            // 1. Obtener datos y verificar seguridad
            $stmtGet = $conexion->prepare("SELECT id_jugador, id_equipo FROM solicitudes_equipo WHERE id = ? AND estado = 'pendiente'");
            $stmtGet->execute([$idSolicitud]);
            $solicitudData = $stmtGet->fetch(PDO::FETCH_ASSOC);

            if (!$solicitudData) throw new Exception("Solicitud no encontrada o no pendiente.");
            if ($solicitudData['id_equipo'] != $idEquipoDelManager) throw new Exception("No tienes permisos.");

            // 2. Actualizar estado
            $stmtUpdate = $conexion->prepare("UPDATE solicitudes_equipo SET estado = ?, fecha_respuesta = NOW() WHERE id = ?");
            $stmtUpdate->execute([$nuevoEstado, $idSolicitud]);

            // 3. Si es aceptada, añadir al equipo como 'jugador'
            if ($nuevoEstado === 'aceptada') {
                $stmtCheck = $conexion->prepare("SELECT 1 FROM jugadores_equipos WHERE idjugador = ? AND idequipo = ?");
                $stmtCheck->execute([$solicitudData['id_jugador'], $solicitudData['id_equipo']]);
                
                if (!$stmtCheck->fetch()) {
                     $stmtInsertMiembro = $conexion->prepare("INSERT INTO jugadores_equipos (idjugador, idequipo, rol_en_equipo) VALUES (?, ?, 'jugador')");
                     $stmtInsertMiembro->execute([$solicitudData['id_jugador'], $solicitudData['id_equipo']]);
                }
            }
            $conexion->commit();
            return true;
        } catch (Exception $e) {
            $conexion->rollBack();
            throw $e;
        }
    }

    // Obtener IDs de equipos ya solicitados (Para el Jugador)
    public static function getIdsEquiposSolicitadosPorJugador($idJugador) {
        $conexion = FutbolDB::connectDB();
        $sql = "SELECT id_equipo FROM solicitudes_equipo WHERE id_jugador = ? AND estado = 'pendiente'";
        $stmt = $conexion->prepare($sql);
        $stmt->execute([$idJugador]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    // NUEVO MÉTODO: Borrar solicitudes antiguas (Plan B)
    public static function borrarAntiguas($dias = 3) {
        $conexion = FutbolDB::connectDB();
        $sql = "DELETE FROM solicitudes_equipo WHERE estado = 'pendiente' AND fecha_solicitud < (NOW() - INTERVAL :dias DAY)";
        $stmt = $conexion->prepare($sql);
        $stmt->bindParam(':dias', $dias, PDO::PARAM_INT);
        $stmt->execute();
    }
}
?>
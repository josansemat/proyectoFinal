<?php
// backend/models/Equipo.php
require_once __DIR__ . '/../config/FutbolDB.php';

class Equipo {
    // Obtener todos los equipos activos
    public static function getAllEquipos() {
        $conexion = FutbolDB::connectDB();
        $sql = "SELECT * FROM equipos WHERE activo = 1";
        $stmt = $conexion->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Obtener un equipo por ID
    public static function getById($id) {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare("SELECT * FROM equipos WHERE id = :id");
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // --- ACTUALIZACIÓN DINÁMICA (INTELIGENTE) ---
    public static function updateDinamico($id, $datos) {
        $conexion = FutbolDB::connectDB();
        
        $campos = [];
        $parametros = [':id' => $id];

        // Solo añadimos a la consulta SQL los campos que vienen en el array $datos
        if (isset($datos['nombre']) && !empty($datos['nombre'])) {
            $campos[] = "nombre = :nombre";
            $parametros[':nombre'] = $datos['nombre'];
        }
        
        if (isset($datos['descripcion'])) {
            $campos[] = "descripcion = :descripcion";
            $parametros[':descripcion'] = $datos['descripcion'];
        }
        
        if (isset($datos['color_principal']) && !empty($datos['color_principal'])) {
            $campos[] = "color_principal = :color";
            $parametros[':color'] = $datos['color_principal'];
        }

        // Si no hay nada que actualizar, salimos
        if (empty($campos)) {
            return true; // No es un error, simplemente no hubo cambios
        }

        // Construimos la SQL final: "UPDATE equipos SET nombre=:nombre, ... WHERE id=:id"
        $sql = "UPDATE equipos SET " . implode(', ', $campos) . " WHERE id = :id";
        
        $stmt = $conexion->prepare($sql);
        return $stmt->execute($parametros);
    }

    // Verificar si un usuario es manager de un equipo específico
    public static function esManager($idUsuario, $idEquipo) {
        $conexion = FutbolDB::connectDB();
        $sql = "SELECT 1 FROM jugadores_equipos 
                WHERE idjugador = :user AND idequipo = :team AND rol_en_equipo = 'manager'";
        $stmt = $conexion->prepare($sql);
        $stmt->execute([':user' => $idUsuario, ':team' => $idEquipo]);
        return $stmt->fetchColumn();
    }
}
?>
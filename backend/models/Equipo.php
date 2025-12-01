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
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // --- ACTUALIZACIÓN DINÁMICA (INTELIGENTE) ---
    public static function updateDinamico($id, $datos) {
        $conexion = FutbolDB::connectDB();
        
        $campos = [];
        $parametros = [':id' => $id];

        // Construimos la consulta SQL dinámicamente
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

        // AÑADIDO: Actualización de la imagen de fondo
        if (isset($datos['fondo_imagen']) && !empty($datos['fondo_imagen'])) {
            $campos[] = "fondo_imagen = :fondo";
            $parametros[':fondo'] = $datos['fondo_imagen'];
        }

        // Campos de lanzadores (pueden ser null o int)
        $lanzadores = [
            'id_lanzador_corner_izq',
            'id_lanzador_corner_der',
            'id_lanzador_penalti',
            'id_lanzador_falta_lejana',
            'id_lanzador_falta_cercana_izq',
            'id_lanzador_falta_cercana_der',
        ];
        foreach ($lanzadores as $field) {
            if (array_key_exists($field, $datos)) {
                $campos[] = "$field = :$field";
                $parametros[":$field"] = $datos[$field] === null || $datos[$field] === '' ? null : (int)$datos[$field];
            }
        }

        // Si no hay campos para actualizar, salimos
        if (empty($campos)) {
            return true;
        }

        // SQL final: "UPDATE equipos SET campo1=:c1, campo2=:c2 WHERE id=:id"
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

    // --- Persistencia de formación (campo y posiciones) ---
    private static function ensureTablaPlantilla($conexion) {
        $conexion->exec("CREATE TABLE IF NOT EXISTS equipos_plantilla (
            id INT NOT NULL AUTO_INCREMENT,
            id_equipo INT NOT NULL,
            mode VARCHAR(3) NOT NULL,
            formation VARCHAR(20) NOT NULL,
            assignments MEDIUMTEXT NULL,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_equipo (id_equipo),
            CONSTRAINT fk_plantilla_equipo FOREIGN KEY (id_equipo) REFERENCES equipos(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }

    public static function getPlantilla($idEquipo) {
        $conexion = FutbolDB::connectDB();
        self::ensureTablaPlantilla($conexion);
        $stmt = $conexion->prepare("SELECT mode, formation, assignments, updated_at FROM equipos_plantilla WHERE id_equipo = :id LIMIT 1");
        $stmt->execute([':id' => $idEquipo]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        return [
            'mode' => $row['mode'],
            'formation' => $row['formation'],
            'assignments' => $row['assignments'] ? json_decode($row['assignments'], true) : new \stdClass(),
            'updated_at' => $row['updated_at']
        ];
    }

    public static function savePlantilla($idEquipo, $mode, $formation, $assignments) {
        $conexion = FutbolDB::connectDB();
        self::ensureTablaPlantilla($conexion);
        $json = is_string($assignments) ? $assignments : json_encode($assignments);
        $sql = "INSERT INTO equipos_plantilla (id_equipo, mode, formation, assignments)
                VALUES (:id, :mode, :formation, :assignments)
                ON DUPLICATE KEY UPDATE mode = VALUES(mode), formation = VALUES(formation), assignments = VALUES(assignments)";
        $stmt = $conexion->prepare($sql);
        return $stmt->execute([
            ':id' => $idEquipo,
            ':mode' => $mode,
            ':formation' => $formation,
            ':assignments' => $json,
        ]);
    }
}
?>
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
}
?>
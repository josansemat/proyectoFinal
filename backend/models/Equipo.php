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

    // Aquí puedes añadir más métodos relacionados con los equipos, como 'crear', 'actualizar', 'eliminar', etc.
}
?>
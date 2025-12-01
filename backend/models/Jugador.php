<?php
require_once __DIR__ . '/../config/FutbolDB.php';

class Jugador {
    private $id;
    private $nombre;
    private $apodo; // Nuevo campo
    private $email;
    private $telefono;
    private $password;
    private $rating_habilidad;
    private $rol;
    private $activo;
    private $fecha_registro;
    private $eliminado;
    private $fecha_eliminacion;

    function __construct(
        $id = 0,
        $nombre = "",
        $apodo = null, // Nuevo parámetro, puede ser null
        $email = "",
        $telefono = "",
        $password = "",
        $rating_habilidad = 5.00,
        $rol = "usuario",
        $activo = 1,
        $fecha_registro = "",
        $eliminado = 0,
        $fecha_eliminacion = null
    ) {
        $this->id = $id;
        $this->nombre = $nombre;
        $this->apodo = $apodo; // Asignación
        $this->email = $email;
        $this->telefono = $telefono;
        $this->password = $password;
        $this->rating_habilidad = $rating_habilidad;
        $this->rol = $rol;
        $this->activo = $activo;
        $this->fecha_registro = $fecha_registro;
        $this->eliminado = $eliminado;
        $this->fecha_eliminacion = $fecha_eliminacion;
    }

    // ----------------------------------------------------------
    // INSERT
    // ----------------------------------------------------------
    public function insert() {
        $conexion = FutbolDB::connectDB();
        // Añadimos 'apodo' a la consulta SQL
        $sql = "INSERT INTO jugadores
                (nombre, apodo, email, telefono, password, rating_habilidad, rol, activo)
                VALUES
                (:nombre, :apodo, :email, :telefono, :password, :rating_habilidad, :rol, :activo)";
        $stmt = $conexion->prepare($sql);
        $stmt->bindParam(':nombre', $this->nombre);
        // Vinculamos el parámetro :apodo. Si es null, se guardará como NULL en la BD.
        $stmt->bindParam(':apodo', $this->apodo);
        $stmt->bindParam(':email', $this->email);
        $stmt->bindParam(':telefono', $this->telefono);
        $stmt->bindParam(':password', $this->password);
        $stmt->bindParam(':rating_habilidad', $this->rating_habilidad);
        $stmt->bindParam(':rol', $this->rol);
        $stmt->bindParam(':activo', $this->activo);
        $stmt->execute();
        $this->id = $conexion->lastInsertId();
    }

    // ----------------------------------------------------------
    // UPDATE
    // ----------------------------------------------------------
    public function update() {
        $conexion = FutbolDB::connectDB();
        $sql = "UPDATE jugadores SET
                nombre = :nombre,
                apodo = :apodo,
                email = :email,
                telefono = :telefono,
                password = :password,
                rating_habilidad = :rating_habilidad,
                rol = :rol,
                activo = :activo
                WHERE id = :id";
        $stmt = $conexion->prepare($sql);
        $stmt->bindParam(':nombre', $this->nombre);
        $stmt->bindParam(':apodo', $this->apodo);
        $stmt->bindParam(':email', $this->email);
        $stmt->bindParam(':telefono', $this->telefono);
        $stmt->bindParam(':password', $this->password);
        $stmt->bindParam(':rating_habilidad', $this->rating_habilidad);
        $stmt->bindParam(':rol', $this->rol);
        $stmt->bindParam(':activo', $this->activo);
        $stmt->bindParam(':id', $this->id);
        $stmt->execute();
    }

    // ----------------------------------------------------------
    // DELETE (ELIMINACIÓN LÓGICA)
    // ----------------------------------------------------------
    public static function delete($id) {
        $conexion = FutbolDB::connectDB();
        // Usamos sentencias preparadas por seguridad
        $sql = "UPDATE jugadores SET eliminado=1, fecha_eliminacion=NOW() WHERE id = :id";
        $stmt = $conexion->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
    }

    // ----------------------------------------------------------
    // GET BY EMAIL (Necesario para el Login)
    // ----------------------------------------------------------
    public static function getByEmail($email) {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare("SELECT * FROM jugadores WHERE email = :email AND eliminado = 0 LIMIT 1");
        $stmt->bindParam(':email', $email);
        $stmt->execute();

        if ($stmt->rowCount() == 0) return false;

        $row = $stmt->fetch(PDO::FETCH_OBJ);
        // Pasamos $row->apodo al constructor
        return new Jugador(
            $row->id, $row->nombre, $row->apodo, $row->email, $row->telefono,
            $row->password, $row->rating_habilidad, $row->rol,
            $row->activo, $row->fecha_registro,
            $row->eliminado, $row->fecha_eliminacion
        );
    }

    // ----------------------------------------------------------
    // GET ALL
    // ----------------------------------------------------------
    public static function getJugadores() {
        $conexion = FutbolDB::connectDB();
        $consulta = $conexion->query("SELECT * FROM jugadores WHERE eliminado = 0");

        $lista = [];
        while ($row = $consulta->fetchObject()) {
            // Pasamos $row->apodo al constructor
            $lista[] = new Jugador(
                $row->id, $row->nombre, $row->apodo, $row->email, $row->telefono,
                $row->password, $row->rating_habilidad, $row->rol,
                $row->activo, $row->fecha_registro,
                $row->eliminado, $row->fecha_eliminacion
            );
        }
        return $lista;
    }

    // ----------------------------------------------------------
    // GET BY ID
    // ----------------------------------------------------------
    public static function getJugadorById($id) {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare("SELECT * FROM jugadores WHERE id = :id AND eliminado = 0");
        $stmt->bindParam(':id', $id);
        $stmt->execute();

        if ($stmt->rowCount() == 0) return false;

        $row = $stmt->fetch(PDO::FETCH_OBJ);
        // Pasamos $row->apodo al constructor
        return new Jugador(
            $row->id, $row->nombre, $row->apodo, $row->email, $row->telefono,
            $row->password, $row->rating_habilidad, $row->rol,
            $row->activo, $row->fecha_registro,
            $row->eliminado, $row->fecha_eliminacion
        );
    }

    // ----------------------------------------------------------
    // GET EQUIPOS DEL JUGADOR
    // ----------------------------------------------------------
    public static function getEquiposByJugadorId($id_jugador) {
        $conexion = FutbolDB::connectDB();
        // MODIFICADO: Se añade 'je.rol_en_equipo as mi_rol'
        $sql = "SELECT e.id, e.nombre, e.color_principal, je.dorsal, je.rol_en_equipo as mi_rol
                FROM equipos e
                JOIN jugadores_equipos je ON e.id = je.idequipo
                WHERE je.idjugador = :id_jugador AND e.activo = 1";
        $stmt = $conexion->prepare($sql);
        $stmt->bindParam(':id_jugador', $id_jugador);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ----------------------------------------------------------
    // GET JUGADORES POR EQUIPO
    // ----------------------------------------------------------
    public static function getJugadoresByEquipoId($id_equipo) {
        $conexion = FutbolDB::connectDB();
        $sql = "SELECT j.id, j.nombre, j.apodo, j.email, j.telefono, j.rating_habilidad, j.rol, j.activo,
                       je.dorsal, je.rol_en_equipo
                FROM jugadores j
                INNER JOIN jugadores_equipos je ON je.idjugador = j.id
                WHERE je.idequipo = :id_equipo AND j.eliminado = 0";
        $stmt = $conexion->prepare($sql);
        $stmt->bindParam(':id_equipo', $id_equipo, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ----------------------------------------------------------
    // UPDATE DINÁMICO (parcial)
    // ----------------------------------------------------------
    public static function updateDinamico($id, $datos) {
        $conexion = FutbolDB::connectDB();
        $campos = [];
        $params = [':id' => (int)$id];

        // Permitidos
        if (array_key_exists('nombre', $datos)) { $campos[] = 'nombre = :nombre'; $params[':nombre'] = $datos['nombre']; }
        if (array_key_exists('apodo', $datos)) { $campos[] = 'apodo = :apodo'; $params[':apodo'] = $datos['apodo']; }
        if (array_key_exists('email', $datos)) { $campos[] = 'email = :email'; $params[':email'] = $datos['email']; }
        if (array_key_exists('telefono', $datos)) { $campos[] = 'telefono = :telefono'; $params[':telefono'] = $datos['telefono']; }

        if (empty($campos)) return false;
        $sql = 'UPDATE jugadores SET ' . implode(', ', $campos) . ' WHERE id = :id AND eliminado = 0';
        $stmt = $conexion->prepare($sql);
        return $stmt->execute($params);
    }

    // ----------------------------------------------------------
    // SALIR DE EQUIPO (ELIMINAR RELACIÓN)
    // ----------------------------------------------------------
    public static function salirDeEquipo($id_jugador, $id_equipo) {
        $conexion = FutbolDB::connectDB();
        $sql = "DELETE FROM jugadores_equipos WHERE idjugador = :idj AND idequipo = :ide";
        $stmt = $conexion->prepare($sql);
        $stmt->bindParam(':idj', $id_jugador, PDO::PARAM_INT);
        $stmt->bindParam(':ide', $id_equipo, PDO::PARAM_INT);
        return $stmt->execute();
    }

    // ----------------------------------------------------------
    // CAMBIAR PASSWORD
    // ----------------------------------------------------------
    public static function updatePassword($id_jugador, $newPasswordHash) {
        $conexion = FutbolDB::connectDB();
        $sql = "UPDATE jugadores SET password = :pwd WHERE id = :id AND eliminado = 0";
        $stmt = $conexion->prepare($sql);
        $stmt->bindParam(':pwd', $newPasswordHash, PDO::PARAM_STR);
        $stmt->bindParam(':id', $id_jugador, PDO::PARAM_INT);
        return $stmt->execute();
    }

    // ----------------------------------------------------------
    // CONTAR PARTIDOS JUGADOS (estado 'completado')
    // ----------------------------------------------------------
    public static function countPartidosJugados($id_jugador) {
        $conexion = FutbolDB::connectDB();
        $sql = "SELECT COUNT(*) AS total
                FROM partidos_jugadores pj
                INNER JOIN partidos p ON p.id = pj.id_partido
                WHERE pj.id_jugador = :id AND p.eliminado = 0 AND p.estado = 'completado'";
        $stmt = $conexion->prepare($sql);
        $stmt->bindParam(':id', $id_jugador, PDO::PARAM_INT);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)($row['total'] ?? 0);
    }



    // GETTERS
    public function getId(){ return $this->id; }
    public function getNombre(){ return $this->nombre; }
    public function getApodo(){ return $this->apodo; } // Nuevo getter
    public function getEmail(){ return $this->email; }
    public function getTelefono(){ return $this->telefono; }
    public function getPassword(){ return $this->password; }
    public function getRating(){ return $this->rating_habilidad; }
    public function getRol(){ return $this->rol; }
    public function getActivo(){ return $this->activo; }
    public function getFechaRegistro(){ return $this->fecha_registro; }
}
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
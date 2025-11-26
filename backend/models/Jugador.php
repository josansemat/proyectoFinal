<?php
require_once __DIR__ . '/../config/FutbolDB.php';

class Jugador {
    private $id;
    private $nombre;
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
        $sql = "INSERT INTO jugadores 
                (nombre, email, telefono, password, rating_habilidad, rol, activo) 
                VALUES 
                (:nombre, :email, :telefono, :password, :rating_habilidad, :rol, :activo)";
        $stmt = $conexion->prepare($sql);
        $stmt->bindParam(':nombre', $this->nombre);
        $stmt->bindParam(':email', $this->email);
        $stmt->bindParam(':telefono', $this->telefono);
        $stmt->bindParam(':password', $this->password);
        $stmt->bindParam(':rating_habilidad', $this->rating_habilidad);
        $stmt->bindParam(':rol', $this->rol);
        $stmt->bindParam(':activo', $this->activo);
        $stmt->execute();
    }

    // ----------------------------------------------------------
    // UPDATE
    // ----------------------------------------------------------
    public function update() {
        $conexion = FutbolDB::connectDB();
        $sql = "UPDATE jugadores SET 
                nombre='$this->nombre',
                email='$this->email',
                telefono='$this->telefono',
                password='$this->password',
                rating_habilidad='$this->rating_habilidad',
                rol='$this->rol',
                activo='$this->activo'
                WHERE id=$this->id";
        $conexion->exec($sql);
    }

    // ----------------------------------------------------------
    // DELETE (ELIMINACIÓN LÓGICA)
    // ----------------------------------------------------------
    public static function delete($id) {
        $conexion = FutbolDB::connectDB();
        $sql = "UPDATE jugadores SET eliminado=1, fecha_eliminacion=NOW() WHERE id=$id";
        $conexion->exec($sql);
    }

    // ----------------------------------------------------------
    // GET ALL
    // ----------------------------------------------------------
    public static function getJugadores() {
        $conexion = FutbolDB::connectDB();
        $consulta = $conexion->query("SELECT * FROM jugadores WHERE eliminado = 0");
        
        $lista = [];
        while ($row = $consulta->fetchObject()) {
            $lista[] = new Jugador(
                $row->id, $row->nombre, $row->email, $row->telefono,
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
        $consulta = $conexion->query("SELECT * FROM jugadores WHERE id=$id");
        
        if ($consulta->rowCount() == 0) return false;

        $row = $consulta->fetchObject();
        return new Jugador(
            $row->id, $row->nombre, $row->email, $row->telefono,
            $row->password, $row->rating_habilidad, $row->rol,
            $row->activo, $row->fecha_registro,
            $row->eliminado, $row->fecha_eliminacion
        );
    }

    // ----------------------------------------------------------
    // GET BY EMAIL (para login)
    // ----------------------------------------------------------
    public static function getByEmail($email) {
        $conexion = FutbolDB::connectDB();
        $consulta = $conexion->query("SELECT * FROM jugadores WHERE email='$email'");
        
        if ($consulta->rowCount() == 0) return false;

        $row = $consulta->fetchObject();
        return new Jugador(
            $row->id, $row->nombre, $row->email, $row->telefono,
            $row->password, $row->rating_habilidad, $row->rol,
            $row->activo, $row->fecha_registro,
            $row->eliminado, $row->fecha_eliminacion
        );        
    }

    // GETTERS
    public function getId(){ return $this->id; }
    public function getNombre(){ return $this->nombre; }
    public function getEmail(){ return $this->email; }
    public function getTelefono(){ return $this->telefono; }
    public function getPassword(){ return $this->password; }
    public function getRating(){ return $this->rating_habilidad; }
    public function getRol(){ return $this->rol; }
    public function getActivo(){ return $this->activo; }
    public function getFechaRegistro(){ return $this->fecha_registro; }
}

<?php
require_once 'cors.php';
require_once '../models/Jugador.php';

class JugadoresController {

    // --------------------------
    // REGISTER (CREATE)
    // --------------------------
    public function crear() {
        $data = json_decode(file_get_contents("php://input"), true);

        // Validación básica: nombre, email y password son obligatorios.
        if (empty($data["email"]) || empty($data["password"]) || empty($data["nombre"])) {
            echo json_encode(["success" => false, "error" => "Faltan datos obligatorios"]);
            return;
        }

        // Verificar si el email ya existe
        if (Jugador::getByEmail($data["email"])) {
            echo json_encode(["success" => false, "error" => "El email ya está registrado"]);
            return;
        }

        // Hashear la contraseña
        $passwordHash = password_hash($data["password"], PASSWORD_DEFAULT);

        // Valores por defecto
        $rolDefault = "usuario";
        $ratingDefault = 5.00;
        $activoDefault = 1;

        // Obtenemos el apodo y teléfono si existen, o NULL si no
        $apodo = !empty($data["apodo"]) ? $data["apodo"] : null;
        $telefono = !empty($data["telefono"]) ? $data["telefono"] : null;

        // Crear la instancia de Jugador pasando TODOS los parámetros necesarios
        $jugador = new Jugador(
            0,              // ID
            $data["nombre"],
            $apodo,         // AQUÍ FALTABA EL APODO
            $data["email"],
            $telefono,
            $passwordHash,
            $ratingDefault,
            $rolDefault,
            $activoDefault
        );

        try {
            $jugador->insert();
            echo json_encode(["success" => true, "message" => "Jugador registrado correctamente"]);
        } catch (Exception $e) {
            // Log del error en el servidor (no lo mostramos al usuario por seguridad)
            error_log("Error al registrar jugador: " . $e->getMessage());
            echo json_encode(["success" => false, "error" => "Error al registrar en la base de datos. Inténtalo más tarde."]);
        }
    }

    // --------------------------
    // LOGIN
    // --------------------------
    public function login() {
        $data = json_decode(file_get_contents("php://input"), true);

        if (empty($data['email']) || empty($data['password'])) {
            echo json_encode(["success" => false, "error" => "Faltan datos de acceso"]);
            return;
        }

        $email = $data['email'];
        $passwordInput = $data['password'];

        // Buscar usuario por email
        $jugador = Jugador::getByEmail($email);

        if ($jugador) {
            // Verificar contraseña
            if (password_verify($passwordInput, $jugador->getPassword())) {
                
                // Login Exitoso: Devolvemos los datos del usuario (sin el password hash)
                $userData = [
                    "id" => $jugador->getId(),
                    "nombre" => $jugador->getNombre(),
                    "apodo" => $jugador->getApodo(),
                    "email" => $jugador->getEmail(),
                    "rol" => $jugador->getRol(),
                    "rating" => $jugador->getRating()
                ];

                echo json_encode([
                    "success" => true, 
                    "message" => "Login exitoso",
                    "user" => $userData
                ]);
            } else {
                echo json_encode(["success" => false, "error" => "Credenciales incorrectas"]);
            }
        } else {
            echo json_encode(["success" => false, "error" => "Credenciales incorrectas"]);
        }
    }

    // --------------------------
    // LISTAR
    // --------------------------
    public function listar() {
        $jugadores = Jugador::getJugadores();
        $arr = [];
        foreach ($jugadores as $j) { $arr[] = (array)$j; }
        echo json_encode($arr);
    }
    public function misEquipos() {
        // En un caso real, el ID vendría del token de sesión.
        // Para este prototipo, lo recibimos como parámetro GET por simplicidad.
        $id_jugador = $_GET['id_jugador'] ?? null;

        if (!$id_jugador) {
            echo json_encode(["success" => false, "error" => "Falta el ID del jugador"]);
            return;
        }

        $equipos = Jugador::getEquiposByJugadorId($id_jugador);

        if ($equipos) {
            echo json_encode(["success" => true, "equipos" => $equipos]);
        } else {
            // Puede ser que no tenga equipos, devolvemos un array vacío
            echo json_encode(["success" => true, "equipos" => []]);
        }
    }

    // --------------------------
    // LISTAR JUGADORES DE UN EQUIPO
    // --------------------------
    public function jugadoresPorEquipo() {
        $id_equipo = $_GET['id_equipo'] ?? null;
        if (!$id_equipo) {
            echo json_encode(["success" => false, "error" => "Falta el ID del equipo"]);
            return;
        }

        try {
            $jugadores = Jugador::getJugadoresByEquipoId((int)$id_equipo);
            echo json_encode(["success" => true, "jugadores" => $jugadores]);
        } catch (Exception $e) {
            error_log("Error jugadoresPorEquipo: ".$e->getMessage());
            echo json_encode(["success" => false, "error" => "No se pudieron cargar los jugadores del equipo"]);
        }
    }
}
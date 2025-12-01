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

    // --------------------------
    // SALIR DE UN EQUIPO
    // --------------------------
    public function salirDeEquipo() {
        $data = json_decode(file_get_contents("php://input"), true);
        $id_jugador = $data['id_jugador'] ?? null;
        $id_equipo = $data['id_equipo'] ?? null;

        if (!$id_jugador || !$id_equipo) {
            echo json_encode(["success" => false, "error" => "Faltan parámetros: id_jugador o id_equipo"]);
            return;
        }

        try {
            $ok = Jugador::salirDeEquipo((int)$id_jugador, (int)$id_equipo);
            if ($ok) {
                echo json_encode(["success" => true, "message" => "Has salido del equipo correctamente"]);
            } else {
                echo json_encode(["success" => false, "error" => "No fue posible salir del equipo"]);
            }
        } catch (Exception $e) {
            error_log("Error salirDeEquipo: ".$e->getMessage());
            echo json_encode(["success" => false, "error" => "Error al procesar la solicitud"]);
        }
    }

    // --------------------------
    // CAMBIAR CONTRASEÑA
    // --------------------------
    public function cambiarPassword() {
        $data = json_decode(file_get_contents("php://input"), true);
        $id_jugador = $data['id_jugador'] ?? null;
        $actual = $data['password_actual'] ?? null;
        $nueva = $data['password_nueva'] ?? null;

        if (!$id_jugador || !$actual || !$nueva) {
            echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
            return;
        }

        try {
            $jug = Jugador::getJugadorById((int)$id_jugador);
            if (!$jug) {
                echo json_encode(["success" => false, "error" => "Usuario no encontrado"]);
                return;
            }
            if (!password_verify($actual, $jug->getPassword())) {
                echo json_encode(["success" => false, "error" => "La contraseña actual no es válida"]);
                return;
            }
            $hashNuevo = password_hash($nueva, PASSWORD_DEFAULT);
            $ok = Jugador::updatePassword((int)$id_jugador, $hashNuevo);
            echo json_encode(["success" => (bool)$ok]);
        } catch (Exception $e) {
            error_log("Error cambiarPassword: ".$e->getMessage());
            echo json_encode(["success" => false, "error" => "No se pudo cambiar la contraseña"]);
        }
    }

    // --------------------------
    // PARTIDOS JUGADOS (TOTAL)
    // --------------------------
    public function partidosJugados() {
        $id_jugador = $_GET['id_jugador'] ?? null;
        if (!$id_jugador) {
            echo json_encode(["success" => false, "error" => "Falta id_jugador"]);
            return;
        }
        try {
            $total = Jugador::countPartidosJugados((int)$id_jugador);
            echo json_encode(["success" => true, "total" => $total]);
        } catch (Exception $e) {
            error_log("Error partidosJugados: ".$e->getMessage());
            echo json_encode(["success" => false, "error" => "No se pudo obtener el total de partidos"]);
        }
    }

    // --------------------------
    // ACTUALIZAR DATOS PERFIL
    // --------------------------
    public function actualizarDatos() {
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['id_jugador'] ?? null;
        if (!$id) { echo json_encode(["success" => false, "error" => "Falta id_jugador"]); return; }

        // Filtrar solo campos permitidos
        $permitidos = ['nombre','apodo','email','telefono'];
        $payload = [];
        foreach ($permitidos as $k) {
            if (array_key_exists($k, $data)) { $payload[$k] = $data[$k]; }
        }
        if (empty($payload)) { echo json_encode(["success" => false, "error" => "Sin cambios"]); return; }

        try {
            $ok = Jugador::updateDinamico((int)$id, $payload);
            echo json_encode(["success" => (bool)$ok]);
        } catch (Exception $e) {
            error_log('Error actualizarDatos: '.$e->getMessage());
            echo json_encode(["success" => false, "error" => "No se pudieron guardar los cambios"]);
        }
    }
}
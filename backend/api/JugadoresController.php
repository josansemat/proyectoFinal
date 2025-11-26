<?php
require_once 'cors.php';
require_once '../models/Jugador.php';

class JugadoresController {

    // --------------------------
    // REGISTER (CREATE)
    // --------------------------
    public function crear() {
        $data = json_decode(file_get_contents("php://input"), true);

        if (!$data) {
            echo json_encode(["error" => "No data received"]);
            return;
        }

        // Validar si el email ya existe antes de crear
        $existe = Jugador::getByEmail($data["email"]);
        if ($existe) {
            echo json_encode(["error" => "El email ya está registrado"]);
            return;
        }

        $jugador = new Jugador(
            0,
            $data["nombre"],
            $data["email"],
            $data["telefono"],
            password_hash($data["password"], PASSWORD_DEFAULT), // Encriptar contraseña
            $data["rating_habilidad"] ?? 5.00, // Valor por defecto si no viene
            "usuario", // Rol por defecto al registrarse
            1 // Activo por defecto
        );

        try {
            $jugador->insert();
            echo json_encode(["success" => true, "message" => "Jugador registrado correctamente"]);
        } catch (Exception $e) {
            echo json_encode(["error" => $e->getMessage()]);
        }
    }

    // --------------------------
    // LOGIN
    // --------------------------
    public function login() {
        $data = json_decode(file_get_contents("php://input"), true);

        if (!isset($data['email']) || !isset($data['password'])) {
            echo json_encode(["error" => "Faltan datos de acceso"]);
            return;
        }

        $email = $data['email'];
        $password = $data['password'];

        // Buscar usuario por email
        $jugador = Jugador::getByEmail($email);

        if ($jugador) {
            // Verificar contraseña encriptada
            if (password_verify($password, $jugador->getPassword())) {
                // Login exitoso
                
                // Opcional: No devolver el password hash en la respuesta
                $userData = [
                    "id" => $jugador->getId(),
                    "nombre" => $jugador->getNombre(),
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
                echo json_encode(["error" => "Contraseña incorrecta"]);
            }
        } else {
            echo json_encode(["error" => "Usuario no encontrado"]);
        }
    }

    // --------------------------
    // LIST (GET)
    // --------------------------
    public function listar() {
        $jugadores = Jugador::getJugadores();
        $arr = [];

        foreach ($jugadores as $j) {
            $arr[] = [
                "id" => $j->getId(),
                "nombre" => $j->getNombre(),
                "email" => $j->getEmail(),
                "telefono" => $j->getTelefono(),
                "rating_habilidad" => $j->getRating(),
                "rol" => $j->getRol(),
                "activo" => $j->getActivo()
            ];
        }

        echo json_encode($arr);
    }
}
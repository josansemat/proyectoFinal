<?php
require_once 'cors.php';
require_once '../models/Jugador.php';

class JugadoresController {

    // --------------------------
    // CREATE (POST)
    // --------------------------
    public function crear() {
        $data = json_decode(file_get_contents("php://input"), true);

        if (!$data) {
            echo json_encode(["error" => "No data received"]);
            return;
        }

        $jugador = new Jugador(
            0,
            $data["nombre"],
            $data["email"],
            $data["telefono"],
            password_hash($data["password"], PASSWORD_DEFAULT),
            $data["rating_habilidad"],
            $data["rol"],
            $data["activo"]
        );

        try {
            $jugador->insert();
            echo json_encode(["success" => true, "message" => "Jugador creado correctamente"]);
        } catch (Exception $e) {
            echo json_encode(["error" => $e->getMessage()]);
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

<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once "JugadoresController.php";
require_once "SolicitudesController.php"; 
require_once "../models/Equipo.php";
require_once "EquiposController.php";

$solicitudesController = new SolicitudesController(); 
$controller = new JugadoresController();
$equiposController = new EquiposController(); 

$action = $_GET["action"] ?? "";

switch ($action) {
    case "crear": // Registro de jugador
        $controller->crear();
        break;

    case "login": // Login
        $controller->login();
        break;

    case "listar": // Listar jugadores
        $controller->listar();
        break;

    case "mis_equipos": // Equipos de un jugador
        $controller->misEquipos();
        break;

    case "listar_equipos_todos":
        $equipos = Equipo::getAllEquipos();
        echo json_encode(["success" => true, "equipos" => $equipos]);
        break;

    // --- RUTAS DE SOLICITUDES ---
    case "solicitar_unirse": // Jugador envía solicitud
        $solicitudesController->solicitarUnirse();
        break;

    case "ver_solicitudes_equipo": // Manager/Admin ve solicitudes pendientes
        $solicitudesController->verPendientes();
        break;

    case "responder_solicitud": // Manager responde solicitud
        $solicitudesController->responder();
        break;

    case "mis_solicitudes_ids": // IDs de equipos solicitados por jugador
        $solicitudesController->misSolicitudesPendientes();
        break;
    case "get_equipo":
        $equiposController->getEquipo();
        break;
    case "update_equipo":
        $equiposController->update();
        break;

    default:
        echo json_encode(["error" => "Invalid action"]);
        break;
}

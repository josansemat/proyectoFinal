<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once "JugadoresController.php";
require_once "SolicitudesController.php"; 
require_once "../models/Equipo.php";

$solicitudesController = new SolicitudesController(); 
$controller = new JugadoresController();

$action = $_GET["action"] ?? "";

switch ($action) {
    case "crear": // Se usa para el Registro
        $controller->crear();
        break;

    case "login": // Nueva ruta para Login
        $controller->login();
        break;

    case "listar":
        $controller->listar();
        break;
    case "mis_equipos":
        $controller->misEquipos();
        break;
    // --- NUEVAS RUTAS DE SOLICITUDES Y EQUIPOS ---
    case "listar_equipos_todos":
        $equipos = Equipo::getAllEquipos();
        echo json_encode(["success" => true, "equipos" => $equipos]);
        break;
    case "solicitar_unirse":
        $solicitudesController->solicitarUnirse();
        break;
    case "ver_solicitudes_equipo":
        $solicitudesController->verPendientes();
        break;
    case "responder_solicitud":
        $solicitudesController->responder();
        break;
     case "mis_solicitudes_ids":
        $solicitudesController->misSolicitudesPendientes();
        break;
        
    default:
        echo json_encode(["error" => "Invalid action"]);
        break;
}
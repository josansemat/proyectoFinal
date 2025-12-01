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
    case "crear": 
        $controller->crear();
        break;

    case "login": 
        $controller->login();
        break;

    case "listar": 
        $controller->listar();
        break;

    case "mis_equipos": 
        $controller->misEquipos();
        break;

    case "jugadores_equipo":
        $controller->jugadoresPorEquipo();
        break;

    case "salir_equipo":
        $controller->salirDeEquipo();
        break;

    case "cambiar_password":
        $controller->cambiarPassword();
        break;

    case "partidos_jugados":
        $controller->partidosJugados();
        break;

    case "actualizar_datos":
        $controller->actualizarDatos();
        break;

    case "listar_equipos_todos":
        $equipos = Equipo::getAllEquipos();
        echo json_encode(["success" => true, "equipos" => $equipos]);
        break;

    // --- SOLICITUDES ---
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
        
    // --- EQUIPOS ---
    case "get_equipo":
        $equiposController->getEquipo();
        break;
        
    case "get_fondos": // <--- ESTA ES LA LINEA IMPORTANTE NUEVA
        $equiposController->listarFondos();
        break;

    case "update_equipo":
        $equiposController->update();
        break;

    default:
        echo json_encode(["error" => "Invalid action"]);
        break;
}
?>
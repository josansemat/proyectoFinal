<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once "JugadoresController.php";
require_once "SolicitudesController.php"; 
require_once "../models/Equipo.php";
require_once "EquiposController.php";
require_once "PartidosController.php";

$solicitudesController = new SolicitudesController(); 
$controller = new JugadoresController();
$equiposController = new EquiposController(); 
$partidosController = new PartidosController();

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

    case "get_plantilla_equipo":
        $equiposController->getPlantillaEquipo();
        break;

    case "save_plantilla_equipo":
        $equiposController->savePlantillaEquipo();
        break;

    case "admin_listar_jugadores":
        $controller->adminListarJugadores();
        break;

    // --- ADMIN EQUIPOS ---
    case "admin_listar_equipos":
        $equiposController->adminListarEquipos();
        break;
    case "admin_toggle_equipo_activo":
        $equiposController->adminToggleEquipoActivo();
        break;
    case "admin_get_equipo_detalle":
        $equiposController->adminGetEquipoDetalle();
        break;
    case "admin_update_equipo_completo":
        $equiposController->adminUpdateEquipoCompleto();
        break;

    case "admin_toggle_activo":
        $controller->adminToggleActivo();
        break;

    case "admin_toggle_eliminado":
        $controller->adminToggleEliminado();
        break;
    case "admin_crear_equipo":
        $equiposController->adminCrearEquipo();
        break;
    case "update_equipo_completo": // <--- NUEVO NOMBRE
        $equiposController->updateCompleto(); // <--- NUEVA FUNCIÓN
        break;

    // --- PARTIDOS ---
    case "partidos_listar":
        $partidosController->listar();
        break;
    case "partido_crear":
        $partidosController->crear();
        break;
    case "partido_actualizar":
        $partidosController->actualizar();
        break;
    case "partido_eliminar":
        $partidosController->eliminar();
        break;
    case "partido_detalle":
        $partidosController->detalle();
        break;
    case "partido_inscribir":
        $partidosController->inscribirJugador();
        break;
    case "partido_desinscribir":
        $partidosController->desinscribirJugador();
        break;
    case "partido_guardar_formacion":
        $partidosController->guardarFormacion();
        break;
    case "partido_chat_listar":
        $partidosController->listarChat();
        break;
    case "partido_chat_publicar":
        $partidosController->publicarChat();
        break;
    case "partido_activar_votacion":
        $partidosController->activarVotacion();
        break;
    case "partido_registrar_evento":
        $partidosController->registrarEvento();
        break;
    case "partido_eliminar_evento":
        $partidosController->eliminarEvento();
        break;
    case "partido_votar_categoria":
        $partidosController->votarCategoria();
        break;
    case "partido_votar_mvp":
        $partidosController->votarMvp();
        break;
    case "partido_calificar_jugadores":
        $partidosController->calificarJugadores();
        break;

    default:
        echo json_encode(["error" => "Invalid action"]);
        break;
}
?>
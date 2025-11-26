<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once "JugadoresController.php";

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

    default:
        echo json_encode(["error" => "Invalid action"]);
        break;
}
<?php
// backend/api/EquiposController.php
require_once 'cors.php';
require_once '../models/Equipo.php';

class EquiposController {

    public function getEquipo() {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            echo json_encode(["success" => false, "error" => "Falta ID"]);
            return;
        }
        $equipo = Equipo::getById($id);
        if ($equipo) {
            echo json_encode(["success" => true, "equipo" => $equipo]);
        } else {
            echo json_encode(["success" => false, "error" => "Equipo no encontrado"]);
        }
    }

    // POST: Actualizar equipo (FLEXIBLE)
    public function update() {
        $data = json_decode(file_get_contents("php://input"), true);

        // 1. Solo validamos lo estrictamente necesario para identificar el recurso y permisos
        if (empty($data['id_equipo']) || empty($data['id_usuario'])) {
            echo json_encode(["success" => false, "error" => "Faltan datos de identificación (ID equipo o usuario)"]);
            return;
        }

        $idEquipo = $data['id_equipo'];
        $idUsuario = $data['id_usuario'];
        $rolGlobal = $data['rol_global'] ?? 'usuario';

        // 2. Verificación de Seguridad
        $esManager = Equipo::esManager($idUsuario, $idEquipo);
        $esAdmin = ($rolGlobal === 'admin');

        if (!$esManager && !$esAdmin) {
            echo json_encode(["success" => false, "error" => "No tienes permisos para editar este equipo"]);
            return;
        }

        try {
            // 3. Preparamos los datos limpios para enviar al modelo
            $datosParaActualizar = [];

            // Solo pasamos al modelo lo que el usuario ha enviado
            if (isset($data['nombre'])) $datosParaActualizar['nombre'] = $data['nombre'];
            if (isset($data['descripcion'])) $datosParaActualizar['descripcion'] = $data['descripcion'];
            if (isset($data['color_principal'])) $datosParaActualizar['color_principal'] = $data['color_principal'];

            // 4. Llamamos al nuevo método dinámico
            $resultado = Equipo::updateDinamico($idEquipo, $datosParaActualizar);

            if ($resultado) {
                // Recuperamos el equipo actualizado para devolver los datos frescos al frontend
                $equipoActualizado = Equipo::getById($idEquipo);
                
                echo json_encode([
                    "success" => true, 
                    "message" => "Guardado correctamente",
                    // Devolvemos los datos nuevos o mantenemos los viejos si no se enviaron
                    "nuevo_color" => $equipoActualizado['color_principal'],
                    "nuevo_nombre" => $equipoActualizado['nombre']
                ]);
            } else {
                echo json_encode(["success" => false, "error" => "No se pudo actualizar en la BD"]);
            }

        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    }
}
?>
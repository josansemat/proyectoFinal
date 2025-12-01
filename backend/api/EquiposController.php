<?php
// backend/api/EquiposController.php
require_once 'cors.php';
require_once '../models/Equipo.php';

class EquiposController {

    // --- FUNCIÓN CLAVE PARA DETECTAR LA RUTA CORRECTA ---
    private function getFondosPath() {
        // 1. Intenta la estructura del servidor (furbito/fondos)
        // __DIR__ está en /backend/api. Subimos 2 niveles.
        $pathServidor = __DIR__ . '/../../fondos/';

        // 2. Intenta la estructura local clásica (frontend/public/fondos)
        // __DIR__ está en /backend/api. Subimos 3 niveles.
        $pathLocal = __DIR__ . '/../../frontend/public/fondos/';

        if (is_dir($pathServidor)) {
            return realpath($pathServidor) . '/';
        }
        if (is_dir($pathLocal)) {
            return realpath($pathLocal) . '/';
        }

        return null; // No se encontró ninguna
    }

    // Listar archivos para llenar el <select> del frontend
    public function listarFondos() {
        $path = $this->getFondosPath();

        if (!$path) {
            echo json_encode([
                "success" => false, 
                "error" => "No se encontró la carpeta de fondos en el servidor."
            ]);
            return;
        }

        // Leer archivos ignorando . y ..
        $archivos = array_diff(scandir($path), array('.', '..'));
        
        $imagenes = [];
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

        foreach ($archivos as $archivo) {
            $ext = strtolower(pathinfo($archivo, PATHINFO_EXTENSION));
            if (in_array($ext, $allowedExtensions)) {
                $imagenes[] = $archivo;
            }
        }

        echo json_encode(["success" => true, "fondos" => array_values($imagenes)]);
    }

    public function getEquipo() {
        $id = $_GET['id'] ?? null;
        if (!$id) { echo json_encode(["success" => false, "error" => "Falta ID"]); return; }
        $equipo = Equipo::getById($id);
        if ($equipo) { echo json_encode(["success" => true, "equipo" => $equipo]); } 
        else { echo json_encode(["success" => false, "error" => "Equipo no encontrado"]); }
    }

    // POST: Actualizar equipo (Sin subida de archivos, solo selección)
    public function update() {
        if (empty($_POST['id_equipo']) || empty($_POST['id_usuario'])) {
            echo json_encode(["success" => false, "error" => "Faltan datos de identificación"]);
            return;
        }

        $idEquipo = $_POST['id_equipo'];
        $idUsuario = $_POST['id_usuario'];
        $rolGlobal = $_POST['rol_global'] ?? 'usuario';

        $esManager = Equipo::esManager($idUsuario, $idEquipo);
        $esAdmin = ($rolGlobal === 'admin');

        if (!$esManager && !$esAdmin) {
            echo json_encode(["success" => false, "error" => "No tienes permisos para editar este equipo"]);
            return;
        }

        try {
            $datosParaActualizar = [];
            if (isset($_POST['nombre'])) $datosParaActualizar['nombre'] = $_POST['nombre'];
            if (isset($_POST['descripcion'])) $datosParaActualizar['descripcion'] = $_POST['descripcion'];
            if (isset($_POST['color_principal'])) $datosParaActualizar['color_principal'] = $_POST['color_principal'];

            // Lógica de selección de imagen
            if (isset($_POST['fondo_imagen']) && !empty($_POST['fondo_imagen'])) {
                $fondoSeleccionado = basename($_POST['fondo_imagen']); 
                $path = $this->getFondosPath();
                
                // Verificamos existencia física antes de guardar
                if ($path && file_exists($path . $fondoSeleccionado)) {
                    $datosParaActualizar['fondo_imagen'] = $fondoSeleccionado;
                }
            }

            // Campos de lanzadores (permitir null limpiando con string vacio)
            $mapLanzadores = [
                'id_lanzador_corner_izq',
                'id_lanzador_corner_der',
                'id_lanzador_penalti',
                'id_lanzador_falta_lejana',
                'id_lanzador_falta_cercana_izq',
                'id_lanzador_falta_cercana_der',
            ];
            foreach ($mapLanzadores as $field) {
                if (isset($_POST[$field])) {
                    $val = trim((string)$_POST[$field]);
                    $datosParaActualizar[$field] = $val === '' ? null : (int)$val;
                }
            }

            if (empty($datosParaActualizar)) {
                 echo json_encode(["success" => true, "message" => "No hubo cambios para guardar."]);
                 return;
            }

            $resultado = Equipo::updateDinamico($idEquipo, $datosParaActualizar);

            if ($resultado) {
                $equipoActualizado = Equipo::getById($idEquipo);
                echo json_encode([
                    "success" => true, 
                    "message" => "Guardado correctamente",
                    "nuevo_color" => $equipoActualizado['color_principal'],
                    "nuevo_nombre" => $equipoActualizado['nombre'],
                    "nuevo_fondo" => $equipoActualizado['fondo_imagen']
                ]);
            } else {
                throw new Exception("No se pudo actualizar la base de datos.");
            }

        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    }

    // GET: obtener formación del equipo (modo, formación y asignaciones)
    public function getPlantillaEquipo() {
        $idEquipo = $_GET['id_equipo'] ?? null;
        if (!$idEquipo) { echo json_encode(["success" => false, "error" => "Falta id_equipo"]); return; }
        try {
            $plantilla = Equipo::getPlantilla((int)$idEquipo);
            echo json_encode(["success" => true, "plantilla" => $plantilla]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    }

    // POST: guardar formación del equipo (requiere manager o admin)
    public function savePlantillaEquipo() {
        if (empty($_POST['id_equipo']) || empty($_POST['id_usuario']) || empty($_POST['mode']) || empty($_POST['formation'])) {
            echo json_encode(["success" => false, "error" => "Faltan datos obligatorios"]);
            return;
        }
        $idEquipo = (int)$_POST['id_equipo'];
        $idUsuario = (int)$_POST['id_usuario'];
        $rolGlobal = $_POST['rol_global'] ?? 'usuario';
        $mode = $_POST['mode'];
        $formation = $_POST['formation'];
        $assignments = $_POST['assignments'] ?? '{}';

        $esManager = Equipo::esManager($idUsuario, $idEquipo);
        $esAdmin = ($rolGlobal === 'admin');
        if (!$esManager && !$esAdmin) {
            echo json_encode(["success" => false, "error" => "No tienes permisos para guardar la formación"]);
            return;
        }

        try {
            $ok = Equipo::savePlantilla($idEquipo, $mode, $formation, $assignments);
            echo json_encode(["success" => (bool)$ok]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    }
}
?>
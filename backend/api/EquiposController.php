<?php
// backend/api/EquiposController.php
require_once 'cors.php';
require_once '../models/Equipo.php';
require_once '../models/Jugador.php';
require_once '../models/FcmToken.php';
require_once '../services/FirebaseNotifier.php';

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

    // --------------------------
    // ADMIN: LISTAR EQUIPOS
    // --------------------------
    public function adminListarEquipos() {
        $search = isset($_GET['search']) ? trim($_GET['search']) : null;
        $estado = isset($_GET['estado']) ? trim($_GET['estado']) : null; // 'activo'|'inactivo'|''
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        try {
            $res = Equipo::adminListEquipos($search, $estado, $page, $limit);
            $totalPages = (int)ceil(($res['total'] ?: 0) / ($res['limit'] ?: 1));
            echo json_encode([
                'success' => true,
                'page' => $res['page'],
                'limit' => $res['limit'],
                'total' => $res['total'],
                'totalPages' => $totalPages,
                'equipos' => $res['items'],
            ]);
        } catch (Exception $e) {
            error_log('adminListarEquipos: '.$e->getMessage());
            echo json_encode(['success' => false, 'error' => 'No se pudo listar equipos']);
        }
    }

    // --------------------------
    // ADMIN: TOGGLE ACTIVO
    // --------------------------
    public function adminToggleEquipoActivo() {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'] ?? null;
        $activo = $data['activo'] ?? null;
        if ($id === null || $activo === null) { echo json_encode(['success'=>false,'error'=>'Faltan parámetros']); return; }
        try {
            $ok = Equipo::updateActivo((int)$id, (int)$activo);
            echo json_encode(['success' => (bool)$ok]);
        } catch (Exception $e) {
            error_log('adminToggleEquipoActivo: '.$e->getMessage());
            echo json_encode(['success' => false, 'error' => 'No se pudo actualizar activo']);
        }
    }

    // --------------------------
    // ADMIN: DETALLE EQUIPO (para modal)
    // --------------------------
    public function adminGetEquipoDetalle() {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if (!$id) { echo json_encode(['success'=>false,'error'=>'Falta id']); return; }
        try {
            $equipo = Equipo::getById($id);
            if (!$equipo) { echo json_encode(['success'=>false,'error'=>'Equipo no encontrado']); return; }
            $jugadores = Jugador::getJugadoresByEquipoId($id);
            echo json_encode(['success'=>true,'equipo'=>$equipo,'jugadores'=>$jugadores]);
        } catch (Exception $e) {
            error_log('adminGetEquipoDetalle: '.$e->getMessage());
            echo json_encode(['success'=>false,'error'=>'No se pudo cargar el detalle']);
        }
    }

    // --------------------------
    // ADMIN: UPDATE COMPLETO (equipo + dorsales)
    // --------------------------
    // --------------------------
    // ADMIN: UPDATE COMPLETO (equipo + dorsales + ROLES)
    // --------------------------
    public function adminUpdateEquipoCompleto() {
        $data = json_decode(file_get_contents('php://input'), true);
        $idEquipo = $data['id'] ?? null; // El frontend envía 'id'
        // En el panel admin no siempre llega el usuario; si no llega, asumimos permisos de admin
        $idUsuario = $data['id_usuario'] ?? null;
        $rolGlobal = $data['rol_global'] ?? 'admin';

        if (!$idEquipo) {
            echo json_encode(['success'=>false, 'error'=>'Falta id del equipo']);
            return;
        }

        if ($idUsuario) {
            $esManager = Equipo::esManager($idUsuario, $idEquipo);
            $esAdmin = ($rolGlobal === 'admin');
            if (!$esManager && !$esAdmin) {
                echo json_encode(["success" => false, "error" => "No tienes permisos para editar este equipo"]);
                return;
            }
        }

        try {
            // Parte 1: Actualizar datos básicos y lanzadores
            $datos = [];
            // Lista blanca de campos permitidos para la tabla 'equipos'
            $camposPermitidos = ['nombre','descripcion','color_principal','fondo_imagen','id_lanzador_penalti','id_lanzador_falta_lejana','id_lanzador_corner_izq','id_lanzador_corner_der'];
            foreach ($camposPermitidos as $k) {
                if (array_key_exists($k, $data)) {
                    // Para los lanzadores, si el valor es vacío o null, lo guardamos como NULL en la BD
                    if (strpos($k, 'id_lanzador_') === 0 && ($data[$k] === '' || $data[$k] === null)) {
                        $datos[$k] = null;
                    } else {
                        $datos[$k] = $data[$k];
                    }
                }
            }
            
            if (!empty($datos)) {
                Equipo::updateDinamico((int)$idEquipo, $datos);
            }

            // Parte 2: Actualizar dorsales
            $dorsales = $data['dorsales'] ?? [];
            if (is_array($dorsales) && !empty($dorsales)) {
                $this->updateDorsalesEnLote((int)$idEquipo, $dorsales);
            }

            // Parte 3: Actualizar roles (NUEVO)
            $roles = $data['roles'] ?? [];
            if (is_array($roles) && !empty($roles)) {
                // Llamamos al nuevo método del modelo
                Equipo::updateRolesJugadores((int)$idEquipo, $roles);

                // Trigger silencioso por FCM para que los usuarios refresquen roles/equipos al momento.
                // Enviamos a todos los jugadores afectados en el payload (aunque no hayan cambiado).
                $userIds = [];
                foreach ($roles as $row) {
                    $uid = (int)($row['id_jugador'] ?? 0);
                    if ($uid > 0) $userIds[] = $uid;
                }
                $userIds = array_values(array_unique($userIds));
                if (!empty($userIds)) {
                    try {
                        $tokens = FcmToken::listActiveTokensByUsers($userIds);
                        if (!empty($tokens)) {
                            FirebaseNotifier::sendMulticastDataOnly($tokens, [
                                'type' => 'roles_updated',
                                'id_equipo' => (string)$idEquipo,
                                'ts' => (string)time(),
                            ]);
                        }
                    } catch (Exception $e) {
                        // No bloqueamos el guardado si falla el push.
                        error_log('FCM roles_updated failed: ' . $e->getMessage());
                    }
                }
            }

            // Obtener los datos actualizados para devolverlos
            $equipoActualizado = Equipo::getById($idEquipo);
            
            echo json_encode([
                'success'=>true,
                'message' => '¡Cambios guardados con éxito!',
                // Devolvemos los datos clave para actualizar el frontend al instante
                'nuevo_nombre' => $equipoActualizado['nombre'],
                'nuevo_color' => $equipoActualizado['color_principal'],
                'nuevo_fondo' => $equipoActualizado['fondo_imagen']
            ]);

        } catch (Exception $e) {
            error_log('adminUpdateEquipoCompleto Error: '.$e->getMessage());
            echo json_encode(['success'=>false,'error'=>'Error interno al guardar los cambios.']);
        }
    }

    private function updateDorsalesEnLote($idEquipo, $dorsales) {
        $conexion = FutbolDB::connectDB();
        $sql = 'UPDATE jugadores_equipos SET dorsal = :d WHERE idequipo = :ide AND idjugador = :idj';
        $stmt = $conexion->prepare($sql);
        foreach ($dorsales as $row) {
            $idj = (int)($row['id_jugador'] ?? 0);
            $d = $row['nuevo_dorsal'] ?? null;
            if ($idj && $d !== null && $d !== '') {
                $stmt->execute([':d' => (int)$d, ':ide' => $idEquipo, ':idj' => $idj]);
            }
        }
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
    // EN: backend/api/EquiposController.php -> DENTRO DE LA CLASE EquiposController

    // --------------------------
    // ADMIN: CREAR EQUIPO
    // --------------------------
    public function adminCrearEquipo() {
        // Leemos los datos JSON enviados por React
        $data = json_decode(file_get_contents('php://input'), true);

        // Extraemos solo los datos básicos para crear
        $datosParaCrear = [];
        if (isset($data['nombre'])) $datosParaCrear['nombre'] = trim($data['nombre']);
        if (isset($data['descripcion'])) $datosParaCrear['descripcion'] = trim($data['descripcion']);
        if (isset($data['color_principal'])) $datosParaCrear['color_principal'] = $data['color_principal'];
        if (isset($data['fondo_imagen'])) $datosParaCrear['fondo_imagen'] = $data['fondo_imagen'];

        try {
            $nuevoId = Equipo::create($datosParaCrear);
            if ($nuevoId) {
                // Devolvemos el nuevo equipo creado para añadirlo a la tabla en el frontend sin recargar
                $nuevoEquipo = Equipo::getById($nuevoId);
                echo json_encode(['success' => true, 'equipo' => $nuevoEquipo]);
            } else {
                throw new Exception("No se pudo insertar el equipo en la base de datos.");
            }
        } catch (Exception $e) {
            error_log('adminCrearEquipo: ' . $e->getMessage());
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    // --- NUEVA FUNCIÓN PARA ACTUALIZAR TODO EL EQUIPO (DATOS + DORSALES) ---
    public function updateCompleto() {
        // 1. Recibimos los datos en formato JSON
        $data = json_decode(file_get_contents('php://input'), true);
        
        $idEquipo = $data['id_equipo'] ?? null;
        $idUsuario = $data['id_usuario'] ?? null;
        $rolGlobal = $data['rol_global'] ?? 'usuario';

        if (!$idEquipo || !$idUsuario) {
            echo json_encode(["success" => false, "error" => "Faltan datos de identificación"]);
            return;
        }

        // 2. Verificación de Permisos
        $esManager = Equipo::esManager($idUsuario, $idEquipo);
        $esAdmin = ($rolGlobal === 'admin');

        if (!$esManager && !$esAdmin) {
            echo json_encode(["success" => false, "error" => "No tienes permisos para editar este equipo"]);
            return;
        }

        try {
            // 3. Preparar datos para la tabla 'equipos' (datos básicos + lanzadores)
            $datosEquipo = [];
            // Campos de texto/color
            if (isset($data['nombre'])) $datosEquipo['nombre'] = trim($data['nombre']);
            if (isset($data['descripcion'])) $datosEquipo['descripcion'] = trim($data['descripcion']);
            if (isset($data['color_principal'])) $datosEquipo['color_principal'] = $data['color_principal'];
            if (isset($data['fondo_imagen'])) $datosEquipo['fondo_imagen'] = $data['fondo_imagen'];

            // Campos de lanzadores (convertir a int o null)
            $mapLanzadores = [
                'id_lanzador_penalti', 'id_lanzador_falta_lejana',
                'id_lanzador_corner_izq', 'id_lanzador_corner_der'
            ];
            foreach ($mapLanzadores as $field) {
                if (array_key_exists($field, $data)) {
                    $val = $data[$field];
                    $datosEquipo[$field] = ($val === '' || $val === null) ? null : (int)$val;
                }
            }

            // 4. Actualizar tabla 'equipos' si hay datos
            if (!empty($datosEquipo)) {
                Equipo::updateDinamico((int)$idEquipo, $datosEquipo);
            }

            // 5. Actualizar dorsales en 'jugadores_equipos'
            $dorsales = $data['dorsales'] ?? [];
            if (is_array($dorsales) && !empty($dorsales)) {
                $conexion = FutbolDB::connectDB();
                // Preparamos la consulta UNA VEZ para ser más eficientes
                $sql = 'UPDATE jugadores_equipos SET dorsal = :d WHERE idequipo = :ide AND idjugador = :idj';
                $stmt = $conexion->prepare($sql);
                
                foreach ($dorsales as $row) {
                    $idj = (int)($row['id_jugador'] ?? 0);
                    $d = $row['nuevo_dorsal']; // Puede ser null o un número
                    
                    if ($idj > 0) {
                        $stmt->execute([
                            ':d' => ($d === '' || $d === null) ? null : (int)$d,
                            ':ide' => (int)$idEquipo,
                            ':idj' => $idj
                        ]);
                    }
                }
            }

            // 6. Obtener el equipo actualizado para devolverlo al frontend
            $equipoActualizado = Equipo::getById($idEquipo);
            echo json_encode([
                "success" => true, 
                "message" => "¡Cambios guardados con éxito!",
                // Devolvemos los datos nuevos para que la App se actualice al instante
                "nuevo_color" => $equipoActualizado['color_principal'],
                "nuevo_nombre" => $equipoActualizado['nombre'],
                "nuevo_fondo" => $equipoActualizado['fondo_imagen']
            ]);

        } catch (Exception $e) {
            error_log('Error updateCompleto: ' . $e->getMessage());
            echo json_encode(["success" => false, "error" => "Error interno al guardar datos."]);
        }
    }
    
}
?>
<?php
// backend/api/EquiposController.php
require_once 'cors.php';
require_once '../models/Equipo.php';

class EquiposController {

    // Función auxiliar para limpiar el nombre del equipo y usarlo como nombre de archivo seguro
    private function sanearNombreArchivo($nombre) {
        $nombre = strtolower(trim($nombre));
        $nombre = str_replace([' ', 'á', 'é', 'í', 'ó', 'ú', 'ñ'], ['_', 'a', 'e', 'i', 'o', 'u', 'n'], $nombre);
        $nombre = preg_replace('/[^a-z0-9_-]/', '', $nombre);
        return $nombre ?: 'equipo';
    }

    public function getEquipo() {
        $id = $_GET['id'] ?? null;
        if (!$id) { echo json_encode(["success" => false, "error" => "Falta ID"]); return; }
        $equipo = Equipo::getById($id);
        if ($equipo) { echo json_encode(["success" => true, "equipo" => $equipo]); } 
        else { echo json_encode(["success" => false, "error" => "Equipo no encontrado"]); }
    }

    // POST: Actualizar equipo (SOPORTA ARCHIVOS)
    public function update() {
        if (empty($_POST['id_equipo']) || empty($_POST['id_usuario'])) {
            echo json_encode(["success" => false, "error" => "Faltan datos de identificación"]);
            return;
        }

        $idEquipo = $_POST['id_equipo'];
        $idUsuario = $_POST['id_usuario'];
        $rolGlobal = $_POST['rol_global'] ?? 'usuario';
        $nombreParaArchivo = $_POST['nombre'] ?? $_POST['nombre_actual'] ?? 'equipo';

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

            // ======================================================
            // PROCESAMIENTO DE LA IMAGEN (Con límite 8MB y nueva ruta)
            // ======================================================
            if (isset($_FILES['imagen_fondo']) && $_FILES['imagen_fondo']['error'] === UPLOAD_ERR_OK) {
                
                $fileTmpPath = $_FILES['imagen_fondo']['tmp_name'];
                $fileName = $_FILES['imagen_fondo']['name'];
                $fileSize = $_FILES['imagen_fondo']['size'];
                $fileNameCmps = explode(".", $fileName);
                $fileExtension = strtolower(end($fileNameCmps));

                $allowedfileExtensions = array('jpg', 'jpeg', 'png', 'webp');
                if (!in_array($fileExtension, $allowedfileExtensions)) {
                    throw new Exception("Tipo de archivo no permitido. Solo JPG, PNG o WEBP.");
                }

                // Límite de 2MB
                $maxFileSize = 8 * 1024 * 1024;
                if ($fileSize > $maxFileSize) {
                    throw new Exception("El archivo es demasiado grande. El límite del servidor es de 8MB.");
                }

                if(getimagesize($fileTmpPath) === false) {
                     throw new Exception("El archivo subido no es una imagen válida.");
                }

                // --- CAMBIO CRÍTICO: Directorio de destino en el FRONTEND ---
                // Subimos 3 niveles desde api/ para llegar a la raíz y entramos a frontend/public/fondos/
                $uploadFileDir = '/var/www/html/furbogenuine/frontend/public/fondos/';
                
                if (!is_dir($uploadFileDir) || !is_writable($uploadFileDir)) {
                     // Intenta crear el directorio si no existe (requiere permisos parentales)
                     if (!mkdir($uploadFileDir, 0755, true)) {
                         throw new Exception("El directorio de destino (frontend/public/fondos) no existe o no tiene permisos de escritura.");
                     }
                }

                $nombreSaneado = $this->sanearNombreArchivo($nombreParaArchivo);
                // Nombre limpio: fondo_nombre-equipo.ext
                $newFileName = 'fondo_' . $nombreSaneado . '.' . $fileExtension;
                $dest_path = $uploadFileDir . $newFileName;

                if(move_uploaded_file($fileTmpPath, $dest_path)) {
                    $datosParaActualizar['fondo_imagen'] = $newFileName;
                } else {
                    throw new Exception("Error al guardar el archivo. Verifica permisos en 'frontend/public/fondos'.");
                }
            } elseif (isset($_FILES['imagen_fondo']) && $_FILES['imagen_fondo']['error'] !== UPLOAD_ERR_NO_FILE) {
                throw new Exception("Error en la subida del archivo. Código de error PHP: " . $_FILES['imagen_fondo']['error']);
            }
            // ======================================================

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
}
?>
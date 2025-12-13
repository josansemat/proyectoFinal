<?php
require_once 'cors.php';
require_once '../models/Jugador.php';
require_once '../models/Equipo.php';

class JugadoresController {

    // --------------------------
    // REGISTER (CREATE)
    // --------------------------
    public function crear() {
        $data = json_decode(file_get_contents("php://input"), true);

        // Validación básica: nombre, email y password son obligatorios.
        if (empty($data["email"]) || empty($data["password"]) || empty($data["nombre"])) {
            echo json_encode(["success" => false, "error" => "Faltan datos obligatorios"]);
            return;
        }

        // Verificar si el email ya existe
        if (Jugador::getByEmail($data["email"])) {
            echo json_encode(["success" => false, "error" => "El email ya está registrado"]);
            return;
        }

        // Hashear la contraseña
        $passwordHash = password_hash($data["password"], PASSWORD_DEFAULT);

        // Valores por defecto
        $rolDefault = "usuario";
        $ratingDefault = 5.00;
        $activoDefault = 1;

        // Obtenemos el apodo y teléfono si existen, o NULL si no
        $apodo = !empty($data["apodo"]) ? $data["apodo"] : null;
        $telefono = !empty($data["telefono"]) ? $data["telefono"] : null;

        // Crear la instancia de Jugador pasando TODOS los parámetros necesarios
        $jugador = new Jugador(
            0,              // ID
            $data["nombre"],
            $apodo,         // AQUÍ FALTABA EL APODO
            $data["email"],
            $telefono,
            $passwordHash,
            $ratingDefault,
            $rolDefault,
            $activoDefault
        );

        try {
            $jugador->insert();
            echo json_encode(["success" => true, "message" => "Jugador registrado correctamente"]);
        } catch (Exception $e) {
            // Log del error en el servidor (no lo mostramos al usuario por seguridad)
            error_log("Error al registrar jugador: " . $e->getMessage());
            echo json_encode(["success" => false, "error" => "Error al registrar en la base de datos. Inténtalo más tarde."]);
        }
    }

    // --------------------------
    // LOGIN
    // --------------------------
    public function login() {
        $data = json_decode(file_get_contents("php://input"), true);

        if (empty($data['email']) || empty($data['password'])) {
            echo json_encode(["success" => false, "error" => "Faltan datos de acceso"]);
            return;
        }

        $email = $data['email'];
        $passwordInput = $data['password'];

        // Buscar usuario por email
        $jugador = Jugador::getByEmail($email);

        if ($jugador) {
            // Si está baneado/desactivado, no permitimos iniciar sesión
            if ((int)$jugador->getActivo() === 0) {
                echo json_encode(["success" => false, "error" => "Tu cuenta está desactivada. Contacta con un administrador."]);
                return;
            }

            // Verificar contraseña
            if (password_verify($passwordInput, $jugador->getPassword())) {
                
                // Login Exitoso: Devolvemos los datos del usuario (sin el password hash)
                $userData = [
                    "id" => $jugador->getId(),
                    "nombre" => $jugador->getNombre(),
                    "apodo" => $jugador->getApodo(),
                    "email" => $jugador->getEmail(),
                    "rol" => $jugador->getRol(),
                    "rating" => $jugador->getRating()
                ];

                echo json_encode([
                    "success" => true, 
                    "message" => "Login exitoso",
                    "user" => $userData
                ]);
            } else {
                echo json_encode(["success" => false, "error" => "Credenciales incorrectas"]);
            }
        } else {
            echo json_encode(["success" => false, "error" => "Credenciales incorrectas"]);
        }
    }

    // --------------------------
    // LISTAR
    // --------------------------
    public function listar() {
        $jugadores = Jugador::getJugadores();
        $arr = [];
        foreach ($jugadores as $j) { $arr[] = (array)$j; }
        echo json_encode($arr);
    }

    // --------------------------
    // GET JUGADOR (estado sesión/rol)
    // --------------------------
    public function getJugador() {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if (!$id) {
            echo json_encode(["success" => false, "error" => "Falta id"]);
            return;
        }

        try {
            $jugador = Jugador::getJugadorById($id);
            if (!$jugador) {
                echo json_encode(["success" => false, "error" => "Jugador no encontrado"]);
                return;
            }

            echo json_encode([
                "success" => true,
                "jugador" => [
                    "id" => $jugador->getId(),
                    "nombre" => $jugador->getNombre(),
                    "apodo" => $jugador->getApodo(),
                    "email" => $jugador->getEmail(),
                    "rol" => $jugador->getRol(),
                    "activo" => (int)$jugador->getActivo(),
                ]
            ]);
        } catch (Exception $e) {
            error_log('Error getJugador: '.$e->getMessage());
            echo json_encode(["success" => false, "error" => "No se pudo cargar el usuario"]);
        }
    }
    public function misEquipos() {
        // En un caso real, el ID vendría del token de sesión.
        // Para este prototipo, lo recibimos como parámetro GET por simplicidad.
        $id_jugador = $_GET['id_jugador'] ?? null;

        if (!$id_jugador) {
            echo json_encode(["success" => false, "error" => "Falta el ID del jugador"]);
            return;
        }

        $equipos = Jugador::getEquiposByJugadorId($id_jugador);

        if ($equipos) {
            echo json_encode(["success" => true, "equipos" => $equipos]);
        } else {
            // Puede ser que no tenga equipos, devolvemos un array vacío
            echo json_encode(["success" => true, "equipos" => []]);
        }
    }

    // --------------------------
    // LISTAR JUGADORES DE UN EQUIPO
    // --------------------------
    public function jugadoresPorEquipo() {
        $id_equipo = $_GET['id_equipo'] ?? null;
        if (!$id_equipo) {
            echo json_encode(["success" => false, "error" => "Falta el ID del equipo"]);
            return;
        }

        try {
            $jugadores = Jugador::getJugadoresByEquipoId((int)$id_equipo);
            echo json_encode(["success" => true, "jugadores" => $jugadores]);
        } catch (Exception $e) {
            error_log("Error jugadoresPorEquipo: ".$e->getMessage());
            echo json_encode(["success" => false, "error" => "No se pudieron cargar los jugadores del equipo"]);
        }
    }

    // --------------------------
    // SALIR DE UN EQUIPO
    // --------------------------
    public function salirDeEquipo() {
        $data = json_decode(file_get_contents("php://input"), true);
        $id_jugador = $data['id_jugador'] ?? null;
        $id_equipo = $data['id_equipo'] ?? null;

        // Compatibilidad: si no vienen, asumimos que la acción la realiza el propio jugador.
        $id_usuario = $data['id_usuario'] ?? $id_jugador;
        $rol_global = $data['rol_global'] ?? 'usuario';

        if (!$id_jugador || !$id_equipo) {
            echo json_encode(["success" => false, "error" => "Faltan parámetros: id_jugador o id_equipo"]);
            return;
        }

        try {
            $idJugadorNum = (int)$id_jugador;
            $idEquipoNum = (int)$id_equipo;
            $idUsuarioNum = (int)$id_usuario;

            // Autorización:
            // - Un jugador puede salir de su propio equipo.
            // - Para sacar a otro jugador: debe ser admin global o manager del equipo.
            $esMismoJugador = $idUsuarioNum === $idJugadorNum;
            $esAdmin = ($rol_global === 'admin');
            $esManager = Equipo::esManager($idUsuarioNum, $idEquipoNum);
            if (!$esMismoJugador && !$esAdmin && !$esManager) {
                echo json_encode(["success" => false, "error" => "No tienes permisos para sacar a este jugador del equipo"]);
                return;
            }

            $ok = Jugador::salirDeEquipo($idJugadorNum, $idEquipoNum);
            if ($ok) {
                echo json_encode(["success" => true, "message" => "Has salido del equipo correctamente"]);
            } else {
                echo json_encode(["success" => false, "error" => "No fue posible salir del equipo"]);
            }
        } catch (Exception $e) {
            error_log("Error salirDeEquipo: ".$e->getMessage());
            echo json_encode(["success" => false, "error" => "Error al procesar la solicitud"]);
        }
    }

    // --------------------------
    // CAMBIAR CONTRASEÑA
    // --------------------------
    public function cambiarPassword() {
        $data = json_decode(file_get_contents("php://input"), true);
        $id_jugador = $data['id_jugador'] ?? null;
        $actual = $data['password_actual'] ?? null;
        $nueva = $data['password_nueva'] ?? null;

        if (!$id_jugador || !$actual || !$nueva) {
            echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
            return;
        }

        try {
            $jug = Jugador::getJugadorById((int)$id_jugador);
            if (!$jug) {
                echo json_encode(["success" => false, "error" => "Usuario no encontrado"]);
                return;
            }
            if (!password_verify($actual, $jug->getPassword())) {
                echo json_encode(["success" => false, "error" => "La contraseña actual no es válida"]);
                return;
            }
            $hashNuevo = password_hash($nueva, PASSWORD_DEFAULT);
            $ok = Jugador::updatePassword((int)$id_jugador, $hashNuevo);
            echo json_encode(["success" => (bool)$ok]);
        } catch (Exception $e) {
            error_log("Error cambiarPassword: ".$e->getMessage());
            echo json_encode(["success" => false, "error" => "No se pudo cambiar la contraseña"]);
        }
    }

    // --------------------------
    // PARTIDOS JUGADOS (TOTAL)
    // --------------------------
    public function partidosJugados() {
        $id_jugador = $_GET['id_jugador'] ?? null;
        if (!$id_jugador) {
            echo json_encode(["success" => false, "error" => "Falta id_jugador"]);
            return;
        }
        try {
            $total = Jugador::countPartidosJugados((int)$id_jugador);
            echo json_encode(["success" => true, "total" => $total]);
        } catch (Exception $e) {
            error_log("Error partidosJugados: ".$e->getMessage());
            echo json_encode(["success" => false, "error" => "No se pudo obtener el total de partidos"]);
        }
    }

    // --------------------------
    // ACTUALIZAR DATOS PERFIL
    // --------------------------
    public function actualizarDatos() {
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['id_jugador'] ?? null;
        if (!$id) { echo json_encode(["success" => false, "error" => "Falta id_jugador"]); return; }

        // Filtrar solo campos permitidos
        $permitidos = ['nombre','apodo','email','telefono'];
        $payload = [];
        foreach ($permitidos as $k) {
            if (array_key_exists($k, $data)) { $payload[$k] = $data[$k]; }
        }
        if (empty($payload)) { echo json_encode(["success" => false, "error" => "Sin cambios"]); return; }

        try {
            $ok = Jugador::updateDinamico((int)$id, $payload);
            echo json_encode(["success" => (bool)$ok]);
        } catch (Exception $e) {
            error_log('Error actualizarDatos: '.$e->getMessage());
            echo json_encode(["success" => false, "error" => "No se pudieron guardar los cambios"]);
        }
    }

    // --------------------------
    // ADMIN: LISTAR JUGADORES CON FILTROS Y PÁGINA
    // --------------------------
    public function adminListarJugadores() {
        // Parámetros GET
        $search = isset($_GET['search']) ? trim($_GET['search']) : null;
        $rol = isset($_GET['rol']) ? trim($_GET['rol']) : null; // 'admin' | 'usuario'
        $estado = isset($_GET['estado']) ? trim($_GET['estado']) : null; // 'activo' | 'inactivo' | 'eliminado'
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;

        try {
            $result = Jugador::adminListJugadores($search, $rol, $estado, $page, $limit);
            $totalPages = (int)ceil(($result['total'] ?: 0) / ($result['limit'] ?: 1));
            echo json_encode([
                'success' => true,
                'page' => $result['page'],
                'limit' => $result['limit'],
                'total' => $result['total'],
                'totalPages' => $totalPages,
                'jugadores' => $result['items'],
            ]);
        } catch (Exception $e) {
            error_log('Error adminListarJugadores: '.$e->getMessage());
            echo json_encode(['success' => false, 'error' => 'No se pudo listar jugadores']);
        }
    }

    // --------------------------
    // ADMIN: BANEAR/DESBANEAR (toggle activo)
    // --------------------------
    public function adminToggleActivo() {
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['id'] ?? null;
        $activo = $data['activo'] ?? null; // 0 o 1
        if ($id === null || $activo === null) {
            echo json_encode(['success' => false, 'error' => 'Faltan parámetros']);
            return;
        }
        try {
            $ok = Jugador::updateActivo((int)$id, (int)$activo);
            echo json_encode(['success' => (bool)$ok]);
        } catch (Exception $e) {
            error_log('Error adminToggleActivo: '.$e->getMessage());
            echo json_encode(['success' => false, 'error' => 'No se pudo actualizar el estado activo']);
        }
    }

    // --------------------------
    // ADMIN: ELIMINAR/RESTAURAR (toggle eliminado)
    // --------------------------
    public function adminToggleEliminado() {
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['id'] ?? null;
        $eliminado = $data['eliminado'] ?? null; // 0 o 1
        if ($id === null || $eliminado === null) {
            echo json_encode(['success' => false, 'error' => 'Faltan parámetros']);
            return;
        }
        try {
            $ok = Jugador::updateEliminado((int)$id, (int)$eliminado);
            echo json_encode(['success' => (bool)$ok]);
        } catch (Exception $e) {
            error_log('Error adminToggleEliminado: '.$e->getMessage());
            echo json_encode(['success' => false, 'error' => 'No se pudo actualizar eliminado']);
        }
    }

    // Forgot Password
    public function forgotPassword() {
        $data = json_decode(file_get_contents("php://input"), true);

        if (empty($data['email'])) {
            echo json_encode(["success" => false, "error" => "Falta el email"]);
            return;
        }

        $email = $data['email'];
        $jugador = Jugador::getByEmail($email);

        if (!$jugador) {
            // Don't reveal if email exists
            echo json_encode(["success" => true, "message" => "Si el email existe, se ha enviado un enlace de recuperación"]);
            return;
        }

        // Generate token
        $token = bin2hex(random_bytes(32));
        $expires = gmdate('Y-m-d H:i:s', time() + 3600); // store expiration in UTC

        try {
            $jugador->setResetToken($token, $expires);
        } catch (Exception $e) {
            error_log('Error setting reset token: ' . $e->getMessage());
            echo json_encode(["success" => false, "error" => "Error interno del servidor"]);
            return;
        }

        // Send email and ensure it succeeds
        $mailSent = $this->sendResetEmail($email, $token);
        if (!$mailSent) {
            echo json_encode(["success" => false, "error" => "No se pudo enviar el correo de recuperación. Revisa la configuración SMTP e inténtalo de nuevo."]);
            return;
        }

        echo json_encode(["success" => true, "message" => "Si el email existe, se ha enviado un enlace de recuperación"]);
    }

    // Reset Password
    public function resetPassword() {
        $data = json_decode(file_get_contents("php://input"), true);

        if (empty($data['token']) || empty($data['password'])) {
            echo json_encode(["success" => false, "error" => "Faltan parámetros"]);
            return;
        }

        $token = $data['token'];
        $newPassword = $data['password'];

        $jugador = Jugador::getByResetToken($token);

        if (!$jugador) {
            echo json_encode(["success" => false, "error" => "Token inválido o expirado"]);
            return;
        }

        try {
            $jugador->resetPasswordAndClearToken($newPassword);
        } catch (Exception $e) {
            error_log('Error updating password: ' . $e->getMessage());
            echo json_encode(["success" => false, "error" => "Error interno del servidor"]);
            return;
        }

        echo json_encode(["success" => true, "message" => "Contraseña actualizada correctamente"]);
    }

    private function sendResetEmail($email, $token) {
        require_once '../vendor/autoload.php';

        $smtpHost   = $_ENV['SMTP_HOST']   ?? 'smtp.ionos.com';
        $smtpPort   = (int)($_ENV['SMTP_PORT']   ?? 587);
        $smtpUser   = $_ENV['SMTP_USER']   ?? 'info@laferiadepepe.es';
        $smtpPass   = $_ENV['SMTP_PASS']   ?? '3Pf9R5FpStBn7r4zhJwLUMLGK8X6azFJ';
        $smtpSecure = strtolower($_ENV['SMTP_SECURE'] ?? 'tls'); // tls | ssl | none
        $smtpFrom   = $_ENV['SMTP_FROM']   ?? $smtpUser;
        $smtpFromName = $_ENV['SMTP_FROM_NAME'] ?? 'Furbo App';
        $smtpDebug  = (int)($_ENV['SMTP_DEBUG'] ?? 0);
        $resetBaseUrl = $_ENV['RESET_URL'] ?? 'http://localhost:5173';

        $mail = new PHPMailer\PHPMailer\PHPMailer(true);

        try {
            //Server settings
            $mail->isSMTP();
            $mail->Host       = $smtpHost;
            $mail->SMTPAuth   = true;
            $mail->Username   = $smtpUser;
            $mail->Password   = $smtpPass;
            $mail->CharSet    = 'UTF-8';
            $mail->Port       = $smtpPort;

            if ($smtpSecure === 'ssl' || $smtpSecure === 'smtps') {
                $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
            } elseif ($smtpSecure === 'none') {
                $mail->SMTPSecure = false;
            } else {
                $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            }

            if ($smtpDebug > 0) {
                $mail->SMTPDebug = $smtpDebug;
                $mail->Debugoutput = function ($str, $level) {
                    error_log("PHPMailer [{$level}]: {$str}");
                };
            }

            //Recipients
            $mail->setFrom($smtpFrom, $smtpFromName);
            $mail->addAddress($email);

            //Content
            $mail->isHTML(true);
            $mail->Subject = 'Recuperar contraseña - Furbo';
            $resetLink = rtrim($resetBaseUrl, '/') . "?token=$token";
            $mail->Body    = "Haz clic en el siguiente enlace para recuperar tu contraseña: <a href='$resetLink'>$resetLink</a>";
            $mail->AltBody = "Haz clic en el siguiente enlace para recuperar tu contraseña: $resetLink";

            $mail->send();
            return true;
        } catch (\PHPMailer\PHPMailer\Exception $e) {
            error_log("Error sending email: {$mail->ErrorInfo}");
        } catch (\Throwable $t) {
            error_log('Unexpected mail error: '.$t->getMessage());
        }

        return false;
    }
}
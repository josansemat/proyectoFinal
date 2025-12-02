<?php
require_once __DIR__ . '/../config/FutbolDB.php';

class Partido {
    private const ESTADOS_VALIDOS = ['programado','en_curso','completado','cancelado'];
    private const MODALIDADES_VALIDAS = ['f5','f7','f11'];
    private const GENERACION_METODOS = ['manual','aleatorio','equilibrado'];
    private const FORMACIONES_POR_MODALIDAD = [
        'f5' => ['2-2', '3-1', '1-2-1'],
        'f7' => ['2-3-1', '3-2-1', '2-2-2'],
        'f11' => ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1', '5-3-2'],
    ];

    private static function parseDateTime(?string $value): ?string {
        if (!$value) { return null; }
        try {
            $dt = new DateTime($value);
            return $dt->format('Y-m-d H:i:s');
        } catch (Exception $e) {
            return null;
        }
    }

    private static function sanitizeEstado(?string $estado): string {
        if (!$estado) { return 'programado'; }
        return in_array($estado, self::ESTADOS_VALIDOS, true) ? $estado : 'programado';
    }

    private static function sanitizeTipo(?string $tipo): string {
        if (!$tipo) { return 'interno'; }
        return in_array($tipo, ['interno','externo'], true) ? $tipo : 'interno';
    }

    private static function sanitizeModalidad(?string $modalidad): string {
        if (!$modalidad) { return 'f7'; }
        return in_array($modalidad, self::MODALIDADES_VALIDAS, true) ? $modalidad : 'f7';
    }

    private static function sanitizeMetodo(?string $metodo): string {
        if (!$metodo) { return 'aleatorio'; }
        return in_array($metodo, self::GENERACION_METODOS, true) ? $metodo : 'aleatorio';
    }

    private static function normalizeEquipoId($value): int {
        $id = (int)$value;
        if ($id <= 0) {
            throw new InvalidArgumentException('id_equipo es obligatorio');
        }
        return $id;
    }

    private static function fetchAllAssoc(PDO $conexion, string $sql, array $params = []): array {
        $stmt = $conexion->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private static function calcularCostoPorJugador(array $partido, ?int $inscritos = null): ?float {
        $total = isset($partido['precio_total_pista']) ? (float)$partido['precio_total_pista'] : 0.0;
        if ($total <= 0) { return null; }
        $registrados = $inscritos !== null ? $inscritos : (int)($partido['total_inscritos'] ?? 0);
        if ($registrados <= 0) { return null; }
        $divisor = $partido['tipo_partido'] === 'externo' ? $registrados * 2 : $registrados;
        if ($divisor <= 0) { return null; }
        return round($total / $divisor, 2);
    }

    public static function listar(array $filters = []): array {
        $conexion = FutbolDB::connectDB();
        $where = [];
        $params = [];

        $idEquipo = self::normalizeEquipoId($filters['id_equipo'] ?? null);
        $where[] = 'p.id_equipo = :id_equipo';
        $params[':id_equipo'] = $idEquipo;

        $includeDeleted = !empty($filters['includeDeleted']);
        if (!$includeDeleted) {
            $where[] = 'p.eliminado = 0';
        }

        if (!empty($filters['estado']) && $filters['estado'] !== 'todos') {
            $where[] = 'p.estado = :estado';
            $params[':estado'] = $filters['estado'];
        }

        if (!empty($filters['search'])) {
            $where[] = '(p.lugar_nombre LIKE :search OR DATE_FORMAT(p.fecha_hora, "%d/%m/%Y %H:%i") LIKE :search)';
            $params[':search'] = '%' . $filters['search'] . '%';
        }

        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $page = max(1, (int)($filters['page'] ?? 1));
        $limit = max(5, min(50, (int)($filters['limit'] ?? 10)));
        $offset = ($page - 1) * $limit;

        $stmtCount = $conexion->prepare("SELECT COUNT(*) FROM partidos p $whereSql");
        foreach ($params as $key => $value) {
            $stmtCount->bindValue($key, $value);
        }
        $stmtCount->execute();
        $total = (int)$stmtCount->fetchColumn();

        $sql = "SELECT p.*, 
                       (SELECT COUNT(*) FROM partidos_jugadores pj WHERE pj.id_partido = p.id) AS total_inscritos,
                       (SELECT COUNT(*) FROM partidos_jugadores pj WHERE pj.id_partido = p.id AND pj.pago_confirmado = 1) AS pagos_confirmados
                FROM partidos p
                $whereSql
                ORDER BY p.fecha_hora DESC
                LIMIT :limit OFFSET :offset";
        $stmt = $conexion->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($items as &$item) {
            $item['costo_jugador'] = self::calcularCostoPorJugador($item);
        }
        unset($item);

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'totalPages' => $limit > 0 ? (int)ceil($total / $limit) : 1,
        ];
    }

    public static function getById(int $id): ?array {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare('SELECT * FROM partidos WHERE id = :id LIMIT 1');
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public static function create(array $data) {
        $fecha = self::parseDateTime($data['fecha_hora'] ?? null);
        $lugar = trim($data['lugar_nombre'] ?? '');
        $idEquipo = self::normalizeEquipoId($data['id_equipo'] ?? null);
        if (!$fecha || !$lugar) {
            throw new InvalidArgumentException('Fecha y lugar son obligatorios');
        }

        $fechaLimite = self::parseDateTime($data['fecha_limite_inscripcion'] ?? null);

        $payload = [
            'id_equipo' => $idEquipo,
            'tipo_partido' => self::sanitizeTipo($data['tipo_partido'] ?? null),
            'modalidad_juego' => self::sanitizeModalidad($data['modalidad_juego'] ?? null),
            'metodo_generacion' => self::sanitizeMetodo($data['metodo_generacion'] ?? null),
            'fecha_hora' => $fecha,
            'fecha_limite_inscripcion' => $fechaLimite,
            'lugar_nombre' => $lugar,
            'lugar_enlace_maps' => $data['lugar_enlace_maps'] ?? null,
            'max_jugadores' => (int)($data['max_jugadores'] ?? 10),
            'precio_total_pista' => $data['precio_total_pista'] !== '' ? $data['precio_total_pista'] : null,
            'id_responsable_alquiler' => !empty($data['id_responsable_alquiler']) ? (int)$data['id_responsable_alquiler'] : null,
            'estado' => self::sanitizeEstado($data['estado'] ?? null),
            'equipos_generados' => !empty($data['equipos_generados']) ? 1 : 0,
            'votacion_habilitada' => !empty($data['votacion_habilitada']) ? 1 : 0,
            'comprobante_pdf' => $data['comprobante_pdf'] ?? null,
            'goles_equipo_A' => isset($data['goles_equipo_A']) ? (int)$data['goles_equipo_A'] : 0,
            'goles_equipo_B' => isset($data['goles_equipo_B']) ? (int)$data['goles_equipo_B'] : 0,
        ];

        $conexion = FutbolDB::connectDB();
        $columns = array_keys($payload);
        $placeholders = array_map(fn($col) => ':' . $col, $columns);
        $sql = 'INSERT INTO partidos (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';
        $stmt = $conexion->prepare($sql);
        foreach ($payload as $col => $value) {
            $stmt->bindValue(':' . $col, $value);
        }

        if ($stmt->execute()) {
            return $conexion->lastInsertId();
        }
        return false;
    }

    public static function update(int $id, array $data): bool {
        $campos = [];
        $params = [':id' => $id];
        $map = [
            'lugar_nombre' => fn($v) => trim($v),
            'lugar_enlace_maps' => fn($v) => $v !== '' ? $v : null,
            'max_jugadores' => fn($v) => (int)$v,
            'precio_total_pista' => fn($v) => $v !== '' ? $v : null,
            'id_responsable_alquiler' => fn($v) => $v ? (int)$v : null,
            'equipos_generados' => fn($v) => !empty($v) ? 1 : 0,
            'votacion_habilitada' => fn($v) => !empty($v) ? 1 : 0,
            'comprobante_pdf' => fn($v) => $v !== '' ? $v : null,
            'goles_equipo_A' => fn($v) => (int)$v,
            'goles_equipo_B' => fn($v) => (int)$v,
            'id_equipo' => fn($v) => self::normalizeEquipoId($v),
            'tipo_partido' => fn($v) => self::sanitizeTipo($v),
            'modalidad_juego' => fn($v) => self::sanitizeModalidad($v),
            'metodo_generacion' => fn($v) => self::sanitizeMetodo($v),
            'fecha_limite_inscripcion' => fn($v) => self::parseDateTime($v),
        ];

        if (isset($data['fecha_hora'])) {
            $fecha = self::parseDateTime($data['fecha_hora']);
            if (!$fecha) {
                throw new InvalidArgumentException('Fecha inválida');
            }
            $campos[] = 'fecha_hora = :fecha_hora';
            $params[':fecha_hora'] = $fecha;
        }

        if (isset($data['estado'])) {
            $campos[] = 'estado = :estado';
            $params[':estado'] = self::sanitizeEstado($data['estado']);
        }

        foreach ($map as $field => $transform) {
            if (array_key_exists($field, $data)) {
                $campos[] = "$field = :$field";
                $params[':' . $field] = $transform($data[$field]);
            }
        }

        if (empty($campos)) {
            return true;
        }

        $sql = 'UPDATE partidos SET ' . implode(', ', $campos) . ' WHERE id = :id';
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare($sql);
        return $stmt->execute($params);
    }

    public static function softDelete(int $id): bool {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare('UPDATE partidos SET eliminado = 1, fecha_eliminacion = NOW() WHERE id = :id');
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        return $stmt->execute();
    }

    public static function resumenDashboard(?int $idEquipo = null): array {
        $conexion = FutbolDB::connectDB();

        $params = [];
        $filtro = '';
        if ($idEquipo) {
            $filtro = ' AND id_equipo = :id_equipo';
            $params[':id_equipo'] = $idEquipo;
        }

        $totProgramados = (int)self::valorEscalar($conexion, "SELECT COUNT(*) FROM partidos WHERE eliminado = 0 AND estado = 'programado'" . $filtro, $params);
        $totCompletados = (int)self::valorEscalar($conexion, "SELECT COUNT(*) FROM partidos WHERE eliminado = 0 AND estado = 'completado'" . $filtro, $params);
        $pendienteCobrar = (float)self::valorEscalar($conexion, "SELECT COALESCE(SUM(precio_total_pista),0) FROM partidos WHERE eliminado = 0 AND estado = 'programado'" . $filtro, $params);
        $recaudado = (float)self::valorEscalar($conexion, "SELECT COALESCE(SUM(precio_total_pista),0) FROM partidos WHERE eliminado = 0 AND estado = 'completado'" . $filtro, $params);

        $ocupacionSql =
            "SELECT AVG(ocupacion) FROM (
                SELECT CASE WHEN p.max_jugadores > 0 THEN (
                    (SELECT COUNT(*) FROM partidos_jugadores pj WHERE pj.id_partido = p.id) / p.max_jugadores
                ) ELSE NULL END AS ocupacion
                FROM partidos p
                WHERE p.eliminado = 0 AND p.max_jugadores > 0" . ($filtro ? ' AND p.id_equipo = :id_equipo' : '') .
            " ) AS t";
        $ocupacionStmt = $conexion->prepare($ocupacionSql);
        $ocupacionStmt->execute($params);
        $ocupacionVal = $ocupacionStmt->fetchColumn();
        $ocupacion = $ocupacionVal !== false && $ocupacionVal !== null ? (float)$ocupacionVal : 0.0;

        $sqlProx = "SELECT id, fecha_hora, lugar_nombre, estado
             FROM partidos
             WHERE eliminado = 0 AND fecha_hora >= NOW()" . ($filtro ? ' AND id_equipo = :id_equipo' : '') .
             " ORDER BY fecha_hora ASC LIMIT 1";
        $proximoStmt = $conexion->prepare($sqlProx);
        $proximoStmt->execute($params);
        $proximo = $proximoStmt->fetch(PDO::FETCH_ASSOC) ?: null;

        return [
            'totalProgramados' => $totProgramados,
            'totalCompletados' => $totCompletados,
            'pendienteCobrar' => round($pendienteCobrar, 2),
            'totalRecaudado' => round($recaudado, 2),
            'promedioOcupacion' => round($ocupacion * 100, 1),
            'proximoPartido' => $proximo,
        ];
    }

    private static function valorEscalar(PDO $conexion, string $sql, array $params = []) {
        $stmt = $conexion->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    private static function jugadorPerteneceEquipo(int $idJugador, int $idEquipo): bool {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare('SELECT 1 FROM jugadores_equipos WHERE idjugador = :jugador AND idequipo = :equipo LIMIT 1');
        $stmt->execute([':jugador' => $idJugador, ':equipo' => $idEquipo]);
        return (bool)$stmt->fetchColumn();
    }

    private static function fetchJugadoresInscritos(int $idPartido): array {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare("SELECT pj.id_jugador, pj.equipo, j.rating_habilidad\n             FROM partidos_jugadores pj\n             INNER JOIN jugadores j ON j.id = pj.id_jugador\n             WHERE pj.id_partido = :id\n             ORDER BY pj.fecha_inscripcion ASC");
        $stmt->execute([':id' => $idPartido]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private static function jugadoresIdsInscritos(int $idPartido, ?PDO $conexion = null): array {
        if (!$conexion) {
            $conexion = FutbolDB::connectDB();
        }
        $stmt = $conexion->prepare('SELECT id_jugador FROM partidos_jugadores WHERE id_partido = :id');
        $stmt->execute([':id' => $idPartido]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $ids = [];
        foreach ($rows as $row) {
            $ids[(int)$row['id_jugador']] = true;
        }
        return $ids;
    }

    private static function guardarAsignacionesEquipos(int $idPartido, array $equipoA, array $equipoB): void {
        $conexion = FutbolDB::connectDB();
        $conexion->beginTransaction();
        try {
            $stmt = $conexion->prepare('UPDATE partidos_jugadores SET equipo = :equipo WHERE id_partido = :partido AND id_jugador = :jugador');
            $todos = [];
            foreach ($equipoA as $jugador) {
                $todos[] = ['jugador' => (int)$jugador, 'equipo' => 'A'];
            }
            foreach ($equipoB as $jugador) {
                $todos[] = ['jugador' => (int)$jugador, 'equipo' => 'B'];
            }
            foreach ($todos as $info) {
                $stmt->execute([
                    ':equipo' => $info['equipo'],
                    ':partido' => $idPartido,
                    ':jugador' => $info['jugador'],
                ]);
            }
            $conexion->commit();
        } catch (Exception $e) {
            $conexion->rollBack();
            throw $e;
        }
    }

    public static function detalleCompleto(int $id): array {
        $conexion = FutbolDB::connectDB();
        $partido = self::getById($id);
        if (!$partido) {
            throw new InvalidArgumentException('Partido no encontrado');
        }

        $params = [':id' => $id];

        $jugadores = self::fetchAllAssoc(
            $conexion,
            "SELECT pj.*, j.nombre, j.apodo, j.email, j.telefono, j.rating_habilidad
             FROM partidos_jugadores pj
             INNER JOIN jugadores j ON j.id = pj.id_jugador
             WHERE pj.id_partido = :id
             ORDER BY pj.fecha_inscripcion ASC",
            $params
        );

        $espera = self::fetchAllAssoc(
            $conexion,
            "SELECT pe.*, j.nombre, j.apodo
             FROM partidos_espera pe
             INNER JOIN jugadores j ON j.id = pe.id_jugador
             WHERE pe.id_partido = :id
             ORDER BY pe.fecha_registro ASC",
            $params
        );

        $eventos = self::fetchAllAssoc(
            $conexion,
            "SELECT ev.*, j.nombre AS jugador_nombre, j.apodo AS jugador_apodo,
                    ja.nombre AS asistente_nombre, ja.apodo AS asistente_apodo
             FROM partidos_eventos ev
             INNER JOIN jugadores j ON j.id = ev.id_jugador
             LEFT JOIN jugadores ja ON ja.id = ev.id_asistente
             WHERE ev.id_partido = :id
             ORDER BY ev.fecha_registro ASC",
            $params
        );

        $formaciones = self::fetchAllAssoc(
            $conexion,
            "SELECT pf.*, j.nombre, j.apodo
             FROM partidos_formaciones pf
             INNER JOIN jugadores j ON j.id = pf.id_jugador
             WHERE pf.id_partido = :id
             ORDER BY pf.equipo, pf.fila, pf.columna",
            $params
        );

        $formacionConfig = self::fetchAllAssoc(
            $conexion,
            'SELECT * FROM partidos_formacion_config WHERE id_partido = :id',
            $params
        );

        $comentarios = self::fetchAllAssoc(
            $conexion,
            "SELECT pc.*, j.nombre, j.apodo
             FROM partidos_comentarios pc
             INNER JOIN jugadores j ON j.id = pc.id_jugador
             WHERE pc.id_partido = :id
             ORDER BY pc.fecha_creacion ASC",
            $params
        );

        $ratings = self::fetchAllAssoc(
            $conexion,
            "SELECT rh.*, ev.nombre AS evaluador_nombre, ev.apodo AS evaluador_apodo,
                    ea.nombre AS evaluado_nombre, ea.apodo AS evaluado_apodo
             FROM ratings_historial rh
             INNER JOIN jugadores ev ON ev.id = rh.id_evaluador
             INNER JOIN jugadores ea ON ea.id = rh.id_evaluado
             WHERE rh.id_partido = :id
             ORDER BY rh.fecha_rating DESC",
            $params
        );

        $votacionConfig = self::fetchAllAssoc(
            $conexion,
            'SELECT * FROM partidos_votacion_config WHERE id_partido = :id',
            $params
        );

        $votosCategorias = self::fetchAllAssoc(
            $conexion,
            "SELECT vc.*, vot.nombre AS votante_nombre, vot.apodo AS votante_apodo,
                    vo.nombre AS votado_nombre, vo.apodo AS votado_apodo
             FROM votos_categorias vc
             INNER JOIN jugadores vot ON vot.id = vc.id_votante
             INNER JOIN jugadores vo ON vo.id = vc.id_votado
             WHERE vc.id_partido = :id
             ORDER BY vc.fecha_voto DESC",
            $params
        );

        $votosMvp = self::fetchAllAssoc(
            $conexion,
            "SELECT vm.*, vot.nombre AS votante_nombre, vot.apodo AS votante_apodo,
                    vo.nombre AS votado_nombre, vo.apodo AS votado_apodo
             FROM votos_mvp vm
             INNER JOIN jugadores vot ON vot.id = vm.id_votante
             INNER JOIN jugadores vo ON vo.id = vm.id_votado
             WHERE vm.id_partido = :id
             ORDER BY vm.fecha_voto DESC",
            $params
        );

        $costo = self::calcularCostoPorJugador($partido, count($jugadores));

        return [
            'partido' => $partido,
            'costo_jugador' => $costo,
            'jugadores' => $jugadores,
            'espera' => $espera,
            'eventos' => $eventos,
            'formaciones' => $formaciones,
            'formacion_config' => $formacionConfig,
            'comentarios' => $comentarios,
            'ratings' => $ratings,
            'votacion_config' => $votacionConfig,
            'votos_categorias' => $votosCategorias,
            'votos_mvp' => $votosMvp,
        ];
    }

    public static function inscribirJugador(int $idPartido, int $idJugador, array $options = []): array {
        if ($idPartido <= 0 || $idJugador <= 0) {
            throw new InvalidArgumentException('Parámetros de inscripción inválidos');
        }

        $conexion = FutbolDB::connectDB();
        $conexion->beginTransaction();

        try {
            $stmtPartido = $conexion->prepare('SELECT * FROM partidos WHERE id = :id FOR UPDATE');
            $stmtPartido->execute([':id' => $idPartido]);
            $partido = $stmtPartido->fetch(PDO::FETCH_ASSOC);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }
            if ((int)$partido['eliminado'] === 1 || $partido['estado'] !== 'programado') {
                throw new InvalidArgumentException('El partido no admite nuevas inscripciones');
            }
            if (!empty($partido['fecha_limite_inscripcion'])) {
                $limite = new DateTimeImmutable($partido['fecha_limite_inscripcion']);
                if (new DateTimeImmutable() > $limite) {
                    throw new InvalidArgumentException('Las inscripciones ya se han cerrado');
                }
            }
            if ($partido['tipo_partido'] === 'interno' && !self::jugadorPerteneceEquipo($idJugador, (int)$partido['id_equipo'])) {
                throw new InvalidArgumentException('El jugador no pertenece al equipo gestor del partido');
            }

            $stmtYaInscrito = $conexion->prepare('SELECT id FROM partidos_jugadores WHERE id_partido = :partido AND id_jugador = :jugador LIMIT 1');
            $stmtYaInscrito->execute([':partido' => $idPartido, ':jugador' => $idJugador]);
            if ($stmtYaInscrito->fetch()) {
                throw new InvalidArgumentException('El jugador ya está inscrito en este partido');
            }

            $stmtEspera = $conexion->prepare('SELECT id FROM partidos_espera WHERE id_partido = :partido AND id_jugador = :jugador LIMIT 1');
            $stmtEspera->execute([':partido' => $idPartido, ':jugador' => $idJugador]);
            $registroEspera = $stmtEspera->fetch(PDO::FETCH_ASSOC);

            $stmtConteo = $conexion->prepare('SELECT COUNT(*) FROM partidos_jugadores WHERE id_partido = :partido');
            $stmtConteo->execute([':partido' => $idPartido]);
            $inscritos = (int)$stmtConteo->fetchColumn();
            $cupo = (int)($partido['max_jugadores'] ?? 0);

            if ($cupo > 0 && $inscritos >= $cupo) {
                if ($registroEspera) {
                    throw new InvalidArgumentException('El jugador ya está en la lista de espera');
                }
                $stmtInsertEspera = $conexion->prepare('INSERT INTO partidos_espera (id_partido, id_jugador) VALUES (:partido, :jugador)');
                $stmtInsertEspera->execute([':partido' => $idPartido, ':jugador' => $idJugador]);
                $conexion->commit();
                return ['status' => 'espera', 'message' => 'Cupo completo, jugador añadido a la lista de espera'];
            }

            $stmtInsert = $conexion->prepare('INSERT INTO partidos_jugadores (id_partido, id_jugador, equipo, es_responsable_pago) VALUES (:partido, :jugador, :equipo, :responsable)');
            $stmtInsert->execute([
                ':partido' => $idPartido,
                ':jugador' => $idJugador,
                ':equipo' => $options['equipo'] ?? null,
                ':responsable' => !empty($options['es_responsable_pago']) ? 1 : 0,
            ]);

            if ($registroEspera) {
                $conexion->prepare('DELETE FROM partidos_espera WHERE id = :id')->execute([':id' => $registroEspera['id']]);
            }

            $conexion->commit();
            return ['status' => 'inscrito', 'message' => 'Jugador inscrito correctamente'];
        } catch (Exception $e) {
            $conexion->rollBack();
            throw $e;
        }
    }

    public static function desinscribirJugador(int $idPartido, int $idJugador): array {
        if ($idPartido <= 0 || $idJugador <= 0) {
            throw new InvalidArgumentException('Parámetros de baja inválidos');
        }

        $conexion = FutbolDB::connectDB();
        $conexion->beginTransaction();

        try {
            $stmtPartido = $conexion->prepare('SELECT * FROM partidos WHERE id = :id FOR UPDATE');
            $stmtPartido->execute([':id' => $idPartido]);
            $partido = $stmtPartido->fetch(PDO::FETCH_ASSOC);
            if (!$partido) {
                throw new InvalidArgumentException('Partido no encontrado');
            }

            $stmtDelete = $conexion->prepare('DELETE FROM partidos_jugadores WHERE id_partido = :partido AND id_jugador = :jugador');
            $stmtDelete->execute([':partido' => $idPartido, ':jugador' => $idJugador]);
            $eliminado = $stmtDelete->rowCount() > 0;

            if (!$eliminado) {
                $stmtEspera = $conexion->prepare('DELETE FROM partidos_espera WHERE id_partido = :partido AND id_jugador = :jugador');
                $stmtEspera->execute([':partido' => $idPartido, ':jugador' => $idJugador]);
                if ($stmtEspera->rowCount() === 0) {
                    throw new InvalidArgumentException('El jugador no está registrado en este partido');
                }
                $conexion->commit();
                return ['status' => 'espera_removida', 'message' => 'Jugador eliminado de la lista de espera'];
            }

            $promovido = null;
            $cupo = (int)($partido['max_jugadores'] ?? 0);
            if ($cupo > 0) {
                $stmtSiguiente = $conexion->prepare('SELECT * FROM partidos_espera WHERE id_partido = :partido ORDER BY fecha_registro ASC LIMIT 1');
                $stmtSiguiente->execute([':partido' => $idPartido]);
                $next = $stmtSiguiente->fetch(PDO::FETCH_ASSOC);
                if ($next) {
                    $conexion->prepare('DELETE FROM partidos_espera WHERE id = :id')->execute([':id' => $next['id']]);
                    $conexion->prepare('INSERT INTO partidos_jugadores (id_partido, id_jugador, equipo, es_responsable_pago) VALUES (:partido, :jugador, NULL, 0)')
                        ->execute([':partido' => $idPartido, ':jugador' => $next['id_jugador']]);
                    $promovido = (int)$next['id_jugador'];
                }
            }

            $conexion->commit();
            return [
                'status' => 'baja',
                'message' => $promovido ? 'Jugador eliminado y reemplazado por la lista de espera' : 'Jugador eliminado del partido',
                'promovido' => $promovido,
            ];
        } catch (Exception $e) {
            $conexion->rollBack();
            throw $e;
        }
    }

    public static function guardarFormacion(array $data): array {
        $idPartido = (int)($data['id_partido'] ?? 0);
        $equipo = isset($data['equipo']) ? strtoupper($data['equipo']) : '';
        if ($idPartido <= 0 || !in_array($equipo, ['A', 'B'], true)) {
            throw new InvalidArgumentException('Datos de equipo no válidos');
        }

        $modalidad = self::sanitizeModalidad($data['modalidad'] ?? null);
        $sistema = trim((string)($data['sistema'] ?? ''));
        if (!$sistema || !self::validarFormacion($modalidad, $sistema)) {
            throw new InvalidArgumentException('Formación inválida para la modalidad seleccionada');
        }

        $grid = $data['grid'] ?? [];
        if (!is_array($grid)) {
            throw new InvalidArgumentException('Distribución de jugadores inválida');
        }

        $conexion = FutbolDB::connectDB();
        $conexion->beginTransaction();

        try {
            $stmtPartido = $conexion->prepare('SELECT id FROM partidos WHERE id = :id FOR UPDATE');
            $stmtPartido->execute([':id' => $idPartido]);
            if (!$stmtPartido->fetch(PDO::FETCH_ASSOC)) {
                throw new InvalidArgumentException('Partido no encontrado');
            }

            $jugadoresDisponibles = self::jugadoresIdsInscritos($idPartido, $conexion);
            $conexion->prepare('DELETE FROM partidos_formaciones WHERE id_partido = :partido AND equipo = :equipo')
                ->execute([':partido' => $idPartido, ':equipo' => $equipo]);

            $stmtInsert = $conexion->prepare('INSERT INTO partidos_formaciones (id_partido, equipo, id_jugador, fila, columna) VALUES (:partido, :equipo, :jugador, :fila, :columna)');
            $insertados = 0;
            foreach ($grid as $slot) {
                $jugador = (int)($slot['id_jugador'] ?? 0);
                if ($jugador <= 0) {
                    continue;
                }
                if (!isset($jugadoresDisponibles[$jugador])) {
                    throw new InvalidArgumentException('Uno de los jugadores no está inscrito en el partido');
                }
                $fila = array_key_exists('fila', $slot) ? (int)$slot['fila'] : null;
                $columna = array_key_exists('columna', $slot) ? (int)$slot['columna'] : null;
                if ($fila === null || $columna === null) {
                    throw new InvalidArgumentException('Coordenadas de formación incompletas');
                }
                $stmtInsert->execute([
                    ':partido' => $idPartido,
                    ':equipo' => $equipo,
                    ':jugador' => $jugador,
                    ':fila' => $fila,
                    ':columna' => $columna,
                ]);
                $insertados++;
            }

            $stmtConfig = $conexion->prepare(
                'INSERT INTO partidos_formacion_config (id_partido, equipo, modalidad, sistema)
                 VALUES (:partido, :equipo, :modalidad, :sistema)
                 ON DUPLICATE KEY UPDATE modalidad = VALUES(modalidad), sistema = VALUES(sistema), updated_at = CURRENT_TIMESTAMP'
            );
            $stmtConfig->execute([
                ':partido' => $idPartido,
                ':equipo' => $equipo,
                ':modalidad' => $modalidad,
                ':sistema' => $sistema,
            ]);

            $conexion->commit();
            return ['success' => true, 'slots_guardados' => $insertados];
        } catch (Exception $e) {
            $conexion->rollBack();
            throw $e;
        }
    }

    private static function validarFormacion(string $modalidad, string $sistema): bool {
        return in_array($modalidad, array_keys(self::FORMACIONES_POR_MODALIDAD), true)
            && in_array($sistema, self::FORMACIONES_POR_MODALIDAD[$modalidad], true);
    }
}

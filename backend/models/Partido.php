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
    private const CHAT_RETENTION_HOURS = 72;
    private const CHAT_CLOSE_INTERVAL = '+1 day';
    private const VOTACION_CATEGORIAS = ['regateador','atacante','pasador','defensa','portero'];
    private const RIVAL_PLACEHOLDER_EMAIL = 'jugador.rival@furbo.local';
    private const RIVAL_PLACEHOLDER_NAME = 'Jugador rival';
    private const POSITION_LABELS = [
        'portero' => 'Mejor portero',
        'defensa' => 'Mejor defensa',
        'centrocampista' => 'Mejor centrocampista',
        'delantero' => 'Mejor delantero',
    ];
    private const SKILL_LABELS = [
        'regateador' => 'Mejor regateador',
        'atacante' => 'Mejor atacante',
        'pasador' => 'Mejor pasador',
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

    private static function obtenerJugadorRivalId(PDO $conexion): int {
        $stmt = $conexion->prepare('SELECT id FROM jugadores WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => self::RIVAL_PLACEHOLDER_EMAIL]);
        $id = $stmt->fetchColumn();
        if ($id) {
            return (int)$id;
        }

        $passwordSeed = function_exists('random_bytes') ? bin2hex(random_bytes(16)) : uniqid('rival_', true);
        $hashedPassword = password_hash($passwordSeed, PASSWORD_BCRYPT);
        try {
            $stmtInsert = $conexion->prepare(
                'INSERT INTO jugadores (nombre, apodo, email, telefono, password, rol, activo) VALUES (:nombre, :apodo, :email, NULL, :password, :rol, 0)'
            );
            $stmtInsert->execute([
                ':nombre' => self::RIVAL_PLACEHOLDER_NAME,
                ':apodo' => self::RIVAL_PLACEHOLDER_NAME,
                ':email' => self::RIVAL_PLACEHOLDER_EMAIL,
                ':password' => $hashedPassword,
                ':rol' => 'usuario',
            ]);
            return (int)$conexion->lastInsertId();
        } catch (PDOException $e) {
            if ($e->getCode() !== '23000') {
                throw $e;
            }
            $stmtRetry = $conexion->prepare('SELECT id FROM jugadores WHERE email = :email LIMIT 1');
            $stmtRetry->execute([':email' => self::RIVAL_PLACEHOLDER_EMAIL]);
            $retryId = $stmtRetry->fetchColumn();
            if ($retryId) {
                return (int)$retryId;
            }
            throw $e;
        }
    }

    private static function buildHighlightPlayer(array $jugador, array $extra = []): array {
        $base = [
            'id' => $jugador['id'],
            'nombre' => $jugador['nombre'],
            'apodo' => $jugador['apodo'],
            'rol' => $jugador['rol'],
            'position_tag' => $jugador['position_tag'],
            'avg_rating' => $jugador['avg_rating'],
            'score' => $jugador['score'],
            'matches_completados' => $jugador['matches_completados'],
            'goals' => $jugador['goals'],
            'assists' => $jugador['assists'],
        ];
        foreach ($extra as $key => $value) {
            $base[$key] = $value;
        }
        return $base;
    }

    public static function rankingEquipo(int $idEquipo): array {
        $idEquipo = self::normalizeEquipoId($idEquipo);
        $conexion = FutbolDB::connectDB();

        $jugadoresRows = self::fetchAllAssoc(
            $conexion,
            "SELECT j.id, j.nombre, j.apodo, j.rating_habilidad, je.rol_en_equipo\n             FROM jugadores j\n             INNER JOIN jugadores_equipos je ON je.idjugador = j.id\n             WHERE je.idequipo = :equipo\n             ORDER BY j.nombre ASC",
            [':equipo' => $idEquipo]
        );

        $jugadores = [];
        foreach ($jugadoresRows as $row) {
            $id = (int)$row['id'];
            $jugadores[$id] = [
                'id' => $id,
                'nombre' => $row['nombre'],
                'apodo' => $row['apodo'],
                'rol' => $row['rol_en_equipo'],
                'rating_base' => isset($row['rating_habilidad']) ? (float)$row['rating_habilidad'] : null,
                'matches_played' => 0,
                'matches_completados' => 0,
                'matches_last30' => 0,
                'avg_rating' => null,
                'rating_count' => 0,
                'best_rating' => null,
                'worst_rating' => null,
                'last_rating' => null,
                'last_rating_date' => null,
                'trend_vs_avg' => null,
                'consistency_range' => null,
                'mvp_votes' => 0,
                'category_votes' => 0,
                'category_top' => null,
                'category_breakdown' => [],
                'position_tag' => null,
                'goals' => 0,
                'assists' => 0,
                'recent_rating_avg' => null,
                'recent_rating_count' => 0,
                'score' => 0.0,
            ];
        }

        if (empty($jugadores)) {
            return [
                'ranking' => [],
                'stats' => [
                    'jugadores_activos' => 0,
                    'jugadores_con_calificacion' => 0,
                    'rating_promedio_equipo' => null,
                    'evaluaciones_registradas' => 0,
                    'mvp_acumulados' => 0,
                    'partidos_registrados' => 0,
                    'partidos_completados' => 0,
                    'ultima_actualizacion' => null,
                ],
            ];
        }

        $params = [':equipo' => $idEquipo];

        $matchesRows = self::fetchAllAssoc(
            $conexion,
            "SELECT pj.id_jugador,\n                    COUNT(*) AS partidos_jugados,\n                    SUM(CASE WHEN p.estado = 'completado' THEN 1 ELSE 0 END) AS partidos_completados,\n                    SUM(CASE WHEN pj.fecha_inscripcion >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS partidos_ultimos_30\n             FROM partidos_jugadores pj\n             INNER JOIN partidos p ON p.id = pj.id_partido\n             WHERE p.id_equipo = :equipo\n             GROUP BY pj.id_jugador",
            $params
        );
        foreach ($matchesRows as $row) {
            $id = (int)$row['id_jugador'];
            if (!isset($jugadores[$id])) {
                continue;
            }
            $jugadores[$id]['matches_played'] = (int)$row['partidos_jugados'];
            $jugadores[$id]['matches_completados'] = (int)$row['partidos_completados'];
            $jugadores[$id]['matches_last30'] = (int)$row['partidos_ultimos_30'];
        }

        $ratingsRows = self::fetchAllAssoc(
            $conexion,
            "SELECT rh.id_evaluado AS id_jugador,\n                    COUNT(*) AS ratings_registrados,\n                    AVG(rh.rating) AS rating_promedio,\n                    MAX(rh.rating) AS rating_maximo,\n                    MIN(rh.rating) AS rating_minimo\n             FROM ratings_historial rh\n             INNER JOIN partidos p ON p.id = rh.id_partido\n             WHERE p.id_equipo = :equipo\n             GROUP BY rh.id_evaluado",
            $params
        );
        foreach ($ratingsRows as $row) {
            $id = (int)$row['id_jugador'];
            if (!isset($jugadores[$id])) {
                continue;
            }
            $jugadores[$id]['rating_count'] = (int)$row['ratings_registrados'];
            $jugadores[$id]['avg_rating'] = $row['rating_promedio'] !== null ? round((float)$row['rating_promedio'], 2) : null;
            $jugadores[$id]['best_rating'] = $row['rating_maximo'] !== null ? (float)$row['rating_maximo'] : null;
            $jugadores[$id]['worst_rating'] = $row['rating_minimo'] !== null ? (float)$row['rating_minimo'] : null;
            if ($jugadores[$id]['best_rating'] !== null && $jugadores[$id]['worst_rating'] !== null) {
                $jugadores[$id]['consistency_range'] = round($jugadores[$id]['best_rating'] - $jugadores[$id]['worst_rating'], 2);
            }
        }

        $lastRatingsRows = self::fetchAllAssoc(
            $conexion,
            "SELECT rh.id_evaluado AS id_jugador, rh.rating, rh.fecha_rating\n             FROM ratings_historial rh\n             INNER JOIN partidos p ON p.id = rh.id_partido\n             WHERE p.id_equipo = :equipo\n             ORDER BY rh.id_evaluado ASC, rh.fecha_rating DESC",
            $params
        );
        $assignedLast = [];
        foreach ($lastRatingsRows as $row) {
            $id = (int)$row['id_jugador'];
            if (!isset($jugadores[$id]) || isset($assignedLast[$id])) {
                continue;
            }
            $jugadores[$id]['last_rating'] = (float)$row['rating'];
            $jugadores[$id]['last_rating_date'] = $row['fecha_rating'];
            $assignedLast[$id] = true;
        }

        $mvpRows = self::fetchAllAssoc(
            $conexion,
            "SELECT vm.id_votado AS id_jugador, COUNT(*) AS votos_mvp\n             FROM votos_mvp vm\n             INNER JOIN partidos p ON p.id = vm.id_partido\n             WHERE p.id_equipo = :equipo\n             GROUP BY vm.id_votado",
            $params
        );
        foreach ($mvpRows as $row) {
            $id = (int)$row['id_jugador'];
            if (!isset($jugadores[$id])) {
                continue;
            }
            $jugadores[$id]['mvp_votes'] = (int)$row['votos_mvp'];
        }

        $categoriaRows = self::fetchAllAssoc(
            $conexion,
            "SELECT vc.id_votado AS id_jugador, vc.categoria, COUNT(*) AS votos\n             FROM votos_categorias vc\n             INNER JOIN partidos p ON p.id = vc.id_partido\n             WHERE p.id_equipo = :equipo\n             GROUP BY vc.id_votado, vc.categoria",
            $params
        );
        foreach ($categoriaRows as $row) {
            $id = (int)$row['id_jugador'];
            if (!isset($jugadores[$id])) {
                continue;
            }
            $votes = (int)$row['votos'];
            $jugadores[$id]['category_votes'] += $votes;
            $categoria = $row['categoria'];
            $jugadores[$id]['category_breakdown'][$categoria] = $votes;
            $currentTop = $jugadores[$id]['category_top'];
            if ($currentTop === null || $votes > $currentTop['votos']) {
                $jugadores[$id]['category_top'] = [
                    'categoria' => $categoria,
                    'votos' => $votes,
                ];
            }
        }

        $formacionRows = self::fetchAllAssoc(
            $conexion,
            "SELECT pf.id_jugador, pf.fila, COUNT(*) AS apariciones\n             FROM partidos_formaciones pf\n             INNER JOIN partidos p ON p.id = pf.id_partido\n             WHERE p.id_equipo = :equipo AND pf.equipo = 'A'\n             GROUP BY pf.id_jugador, pf.fila",
            $params
        );
        $posicionMapa = [
            0 => 'portero',
            1 => 'defensa',
            2 => 'centrocampista',
            3 => 'delantero',
        ];
        $posicionConteo = [];
        foreach ($formacionRows as $row) {
            $id = (int)$row['id_jugador'];
            if (!isset($jugadores[$id])) {
                continue;
            }
            $fila = (int)$row['fila'];
            $tag = $posicionMapa[$fila] ?? null;
            if ($tag === null) {
                continue;
            }
            $posicionConteo[$id][$tag] = ($posicionConteo[$id][$tag] ?? 0) + (int)$row['apariciones'];
        }
        foreach ($posicionConteo as $id => $conteos) {
            arsort($conteos);
            $jugadores[$id]['position_tag'] = array_key_first($conteos) ?: null;
        }

        $golesRows = self::fetchAllAssoc(
            $conexion,
            "SELECT ev.id_jugador, COUNT(*) AS goles\n             FROM partidos_eventos ev\n             INNER JOIN partidos p ON p.id = ev.id_partido\n             WHERE p.id_equipo = :equipo AND ev.tipo = 'gol'\n             GROUP BY ev.id_jugador",
            $params
        );
        foreach ($golesRows as $row) {
            $id = (int)$row['id_jugador'];
            if (!isset($jugadores[$id])) {
                continue;
            }
            $jugadores[$id]['goals'] = (int)$row['goles'];
        }

        $asistRows = self::fetchAllAssoc(
            $conexion,
            "SELECT ev.id_asistente AS id_jugador, COUNT(*) AS asistencias\n             FROM partidos_eventos ev\n             INNER JOIN partidos p ON p.id = ev.id_partido\n             WHERE p.id_equipo = :equipo AND ev.id_asistente IS NOT NULL AND ev.tipo = 'gol'\n             GROUP BY ev.id_asistente",
            $params
        );
        foreach ($asistRows as $row) {
            $id = (int)$row['id_jugador'];
            if (!isset($jugadores[$id])) {
                continue;
            }
            $jugadores[$id]['assists'] = (int)$row['asistencias'];
        }

        $recentRows = self::fetchAllAssoc(
            $conexion,
            "SELECT rh.id_evaluado AS id_jugador, AVG(rh.rating) AS rating_promedio, COUNT(*) AS evaluaciones\n             FROM ratings_historial rh\n             INNER JOIN partidos p ON p.id = rh.id_partido\n             WHERE p.id_equipo = :equipo AND rh.fecha_rating >= DATE_SUB(NOW(), INTERVAL 30 DAY)\n             GROUP BY rh.id_evaluado",
            $params
        );
        foreach ($recentRows as $row) {
            $id = (int)$row['id_jugador'];
            if (!isset($jugadores[$id])) {
                continue;
            }
            $jugadores[$id]['recent_rating_avg'] = $row['rating_promedio'] !== null ? round((float)$row['rating_promedio'], 2) : null;
            $jugadores[$id]['recent_rating_count'] = (int)$row['evaluaciones'];
        }

        $totalRatings = 0;
        $totalMvpVotes = 0;
        $playersWithAverage = 0;
        $sumAverages = 0.0;
        $ultimaActualizacion = null;
        $maxScore = 0.0;

        foreach ($jugadores as &$jugador) {
            if ($jugador['rating_count'] > 0 && $jugador['avg_rating'] !== null) {
                $totalRatings += $jugador['rating_count'];
                $playersWithAverage++;
                $sumAverages += $jugador['avg_rating'];
            }
            $totalMvpVotes += $jugador['mvp_votes'];

            if ($jugador['avg_rating'] !== null && $jugador['last_rating'] !== null) {
                $jugador['trend_vs_avg'] = round($jugador['last_rating'] - $jugador['avg_rating'], 2);
            }

            if ($jugador['last_rating_date']) {
                if (!$ultimaActualizacion || $jugador['last_rating_date'] > $ultimaActualizacion) {
                    $ultimaActualizacion = $jugador['last_rating_date'];
                }
            }

            $score = 0.0;
            if ($jugador['avg_rating'] !== null) {
                $score += $jugador['avg_rating'] * 600;
            }
            $score += min($jugador['matches_completados'], 40) * 8;
            $score += min($jugador['matches_last30'], 10) * 12;
            $score += $jugador['mvp_votes'] * 6;
            $score += $jugador['category_votes'] * 2;
            $jugador['score'] = round($score, 2);
            if ($score > $maxScore) {
                $maxScore = $score;
            }
        }
        unset($jugador);

        usort($jugadores, function (array $a, array $b): int {
            if ($a['score'] === $b['score']) {
                if ($a['matches_completados'] === $b['matches_completados']) {
                    return strcasecmp($a['nombre'], $b['nombre']);
                }
                return $b['matches_completados'] <=> $a['matches_completados'];
            }
            return $b['score'] <=> $a['score'];
        });

        foreach ($jugadores as $index => &$jugador) {
            $jugador['rank'] = $index + 1;
            $jugador['score_relative'] = $maxScore > 0 ? round(($jugador['score'] / $maxScore) * 100, 2) : 0;
            if ($jugador['category_top']) {
                $jugador['category_top']['etiqueta'] = ucfirst(str_replace('_', ' ', $jugador['category_top']['categoria']));
            }
        }
        unset($jugador);

        $bestPositions = [];
        foreach (self::POSITION_LABELS as $tag => $label) {
            $bestPositions[$tag] = null;
        }
        foreach ($jugadores as $jugador) {
            $tag = $jugador['position_tag'];
            if ($tag && array_key_exists($tag, self::POSITION_LABELS) && $bestPositions[$tag] === null) {
                $bestPositions[$tag] = [
                    'tag' => $tag,
                    'label' => self::POSITION_LABELS[$tag],
                    'player' => self::buildHighlightPlayer($jugador),
                    'metric_label' => 'Score',
                    'metric_value' => $jugador['score'],
                ];
            }
        }

        $skillHighlights = [];
        foreach (self::SKILL_LABELS as $skillTag => $skillLabel) {
            $skillHighlights[$skillTag] = null;
        }
        foreach ($jugadores as $jugador) {
            foreach (self::SKILL_LABELS as $skillTag => $skillLabel) {
                $votesSkill = $jugador['category_breakdown'][$skillTag] ?? 0;
                if ($votesSkill <= 0) {
                    continue;
                }
                $currentBest = $skillHighlights[$skillTag];
                if ($currentBest === null || $votesSkill > $currentBest['metric_value'] || ($votesSkill === $currentBest['metric_value'] && $jugador['score'] > $currentBest['player']['score'])) {
                    $skillHighlights[$skillTag] = [
                        'tag' => $skillTag,
                        'label' => $skillLabel,
                        'metric_label' => 'Votos',
                        'metric_value' => $votesSkill,
                        'player' => self::buildHighlightPlayer($jugador),
                    ];
                }
            }
        }

        $topScorer = null;
        foreach ($jugadores as $jugador) {
            $goles = (int)$jugador['goals'];
            if ($goles <= 0) {
                continue;
            }
            if ($topScorer === null || $goles > $topScorer['metric_value'] || ($goles === $topScorer['metric_value'] && $jugador['score'] > $topScorer['player']['score'])) {
                $topScorer = [
                    'label' => 'Máximo goleador',
                    'metric_label' => 'Goles',
                    'metric_value' => $goles,
                    'player' => self::buildHighlightPlayer($jugador),
                ];
            }
        }

        $topAssistant = null;
        foreach ($jugadores as $jugador) {
            $asist = (int)$jugador['assists'];
            if ($asist <= 0) {
                continue;
            }
            if ($topAssistant === null || $asist > $topAssistant['metric_value'] || ($asist === $topAssistant['metric_value'] && $jugador['score'] > $topAssistant['player']['score'])) {
                $topAssistant = [
                    'label' => 'Máximo asistente',
                    'metric_label' => 'Asistencias',
                    'metric_value' => $asist,
                    'player' => self::buildHighlightPlayer($jugador),
                ];
            }
        }

        $playerOfMonth = null;
        foreach ($jugadores as $jugador) {
            if ($jugador['recent_rating_avg'] === null || $jugador['recent_rating_count'] === 0) {
                continue;
            }
            if ($playerOfMonth === null || $jugador['recent_rating_avg'] > $playerOfMonth['metric_value'] || ($jugador['recent_rating_avg'] === $playerOfMonth['metric_value'] && $jugador['recent_rating_count'] > $playerOfMonth['extra']['evaluaciones'])) {
                $playerOfMonth = [
                    'label' => 'Jugador del mes',
                    'metric_label' => 'Rating 30d',
                    'metric_value' => $jugador['recent_rating_avg'],
                    'extra' => ['evaluaciones' => $jugador['recent_rating_count']],
                    'player' => self::buildHighlightPlayer($jugador),
                ];
            }
        }

        $highlights = [
            'positions' => array_filter($bestPositions),
            'skills' => array_filter($skillHighlights),
            'top_scorer' => $topScorer,
            'top_assistant' => $topAssistant,
            'player_of_month' => $playerOfMonth,
        ];

        $totalPartidos = (int)self::valorEscalar($conexion, 'SELECT COUNT(*) FROM partidos WHERE id_equipo = :equipo', $params);
        $totalPartidosCompletados = (int)self::valorEscalar($conexion, "SELECT COUNT(*) FROM partidos WHERE id_equipo = :equipo AND estado = 'completado'", $params);

        return [
            'ranking' => $jugadores,
            'stats' => [
                'jugadores_activos' => count($jugadoresRows),
                'jugadores_con_calificacion' => $playersWithAverage,
                'rating_promedio_equipo' => $playersWithAverage > 0 ? round($sumAverages / $playersWithAverage, 2) : null,
                'evaluaciones_registradas' => $totalRatings,
                'mvp_acumulados' => $totalMvpVotes,
                'partidos_registrados' => $totalPartidos,
                'partidos_completados' => $totalPartidosCompletados,
                'ultima_actualizacion' => $ultimaActualizacion ? (new DateTime($ultimaActualizacion))->format(DateTime::ATOM) : null,
            ],
            'highlights' => $highlights,
        ];
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

    public static function jugadorPerteneceEquipo(int $idJugador, int $idEquipo): bool {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare('SELECT 1 FROM jugadores_equipos WHERE idjugador = :jugador AND idequipo = :equipo LIMIT 1');
        $stmt->execute([':jugador' => $idJugador, ':equipo' => $idEquipo]);
        return (bool)$stmt->fetchColumn();
    }

    private static function obtenerRelacionJugadorPartido(int $idPartido, int $idJugador, ?PDO $conexion = null): ?array {
        if (!$conexion) {
            $conexion = FutbolDB::connectDB();
        }
        $stmt = $conexion->prepare('SELECT id_jugador, equipo FROM partidos_jugadores WHERE id_partido = :partido AND id_jugador = :jugador LIMIT 1');
        $stmt->execute([':partido' => $idPartido, ':jugador' => $idJugador]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public static function jugadorInscritoEnPartido(int $idPartido, int $idJugador): bool {
        return (bool)self::obtenerRelacionJugadorPartido($idPartido, $idJugador);
    }

    public static function obtenerModoVotacion(int $idPartido): string {
        if ($idPartido <= 0) {
            return 'todos';
        }
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare('SELECT modo FROM partidos_votacion_config WHERE id_partido = :id LIMIT 1');
        $stmt->execute([':id' => $idPartido]);
        $modo = $stmt->fetchColumn();
        return in_array($modo, ['manager','todos'], true) ? $modo : 'todos';
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

    private static function eliminarMensajesAntiguos(PDO $conexion): void {
        $stmt = $conexion->prepare('DELETE FROM partidos_comentarios WHERE fecha_creacion < DATE_SUB(NOW(), INTERVAL :horas HOUR)');
        $stmt->bindValue(':horas', self::CHAT_RETENTION_HOURS, PDO::PARAM_INT);
        $stmt->execute();
    }

    private static function chatCloseDate(array $partido): ?DateTimeImmutable {
        if (empty($partido['fecha_hora'])) {
            return null;
        }
        try {
            $fecha = new DateTimeImmutable($partido['fecha_hora']);
            return $fecha->modify(self::CHAT_CLOSE_INTERVAL);
        } catch (Exception $e) {
            return null;
        }
    }

    public static function chatEstaAbierto(array $partido): bool {
        $cierre = self::chatCloseDate($partido);
        if (!$cierre) {
            return true;
        }
        return new DateTimeImmutable() <= $cierre;
    }

    public static function chatCierreIso(array $partido): ?string {
        $cierre = self::chatCloseDate($partido);
        return $cierre ? $cierre->format(DateTimeInterface::ATOM) : null;
    }

    public static function jugadorPuedeParticiparChat(array $partido, int $idJugador): bool {
        $idEquipo = isset($partido['id_equipo']) ? (int)$partido['id_equipo'] : 0;
        if ($idEquipo && self::jugadorPerteneceEquipo($idJugador, $idEquipo)) {
            return true;
        }
        if (!empty($partido['id'])) {
            return self::jugadorInscritoEnPartido((int)$partido['id'], $idJugador);
        }
        return false;
    }

    public static function listarChat(int $idPartido, int $limit = 100): array {
        $limit = max(10, min(200, $limit));
        $conexion = FutbolDB::connectDB();
        self::eliminarMensajesAntiguos($conexion);
        $stmt = $conexion->prepare(
            "SELECT pc.id, pc.id_jugador, pc.comentario, pc.fecha_creacion, j.nombre, j.apodo\n             FROM partidos_comentarios pc\n             INNER JOIN jugadores j ON j.id = pc.id_jugador\n             WHERE pc.id_partido = :partido\n             ORDER BY pc.fecha_creacion DESC\n             LIMIT :limit"
        );
        $stmt->bindValue(':partido', $idPartido, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return array_reverse($rows);
    }

    public static function agregarChatMensaje(array $partido, int $idJugador, string $mensaje): array {
        $mensaje = trim($mensaje);
        if ($mensaje === '') {
            throw new InvalidArgumentException('El mensaje no puede estar vacío');
        }
        if (!self::chatEstaAbierto($partido)) {
            throw new InvalidArgumentException('El chat está cerrado para este partido');
        }

        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare('INSERT INTO partidos_comentarios (id_partido, id_jugador, comentario) VALUES (:partido, :jugador, :mensaje)');
        $stmt->execute([
            ':partido' => (int)$partido['id'],
            ':jugador' => $idJugador,
            ':mensaje' => $mensaje,
        ]);

        $id = (int)$conexion->lastInsertId();
        $stmtSelect = $conexion->prepare(
            "SELECT pc.id, pc.id_jugador, pc.comentario, pc.fecha_creacion, j.nombre, j.apodo\n             FROM partidos_comentarios pc\n             INNER JOIN jugadores j ON j.id = pc.id_jugador\n             WHERE pc.id = :id"
        );
        $stmtSelect->execute([':id' => $id]);
        $row = $stmtSelect->fetch(PDO::FETCH_ASSOC);
        return $row ?: [];
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

    private static function resolverCampoMarcador(string $tipo, string $equipo): ?string {
        if (!in_array($equipo, ['A','B'], true)) {
            return null;
        }
        if ($tipo === 'gol') {
            return $equipo === 'A' ? 'goles_equipo_A' : 'goles_equipo_B';
        }
        if ($tipo === 'autogol') {
            return $equipo === 'A' ? 'goles_equipo_B' : 'goles_equipo_A';
        }
        return null;
    }

    private static function ajustarMarcador(PDO $conexion, int $idPartido, string $campo, int $delta): void {
        if (!in_array($campo, ['goles_equipo_A','goles_equipo_B'], true)) {
            return;
        }
        $sql = "UPDATE partidos SET $campo = CASE WHEN $campo + :delta < 0 THEN 0 ELSE $campo + :delta END WHERE id = :id";
        $stmt = $conexion->prepare($sql);
        $stmt->execute([':delta' => $delta, ':id' => $idPartido]);
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
            'chat_abierto' => self::chatEstaAbierto($partido),
            'chat_cierre' => self::chatCierreIso($partido),
        ];
    }

    public static function estadoPermiteEventos(string $estado): bool {
        return in_array($estado, ['en_curso', 'completado'], true);
    }

    private static function obtenerEventoPorId(int $id): ?array {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare(
            "SELECT ev.*, j.nombre AS jugador_nombre, j.apodo AS jugador_apodo,\n                    ja.nombre AS asistente_nombre, ja.apodo AS asistente_apodo\n             FROM partidos_eventos ev\n             INNER JOIN jugadores j ON j.id = ev.id_jugador\n             LEFT JOIN jugadores ja ON ja.id = ev.id_asistente\n             WHERE ev.id = :id"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public static function registrarEvento(array $partido, array $data): array {
        $idPartido = (int)($partido['id'] ?? 0);
        if ($idPartido <= 0) {
            throw new InvalidArgumentException('Partido inválido');
        }
        $tipo = $data['tipo'] ?? 'gol';
        $equipo = strtoupper($data['equipo'] ?? '');
        $idJugador = isset($data['id_jugador']) ? (int)$data['id_jugador'] : 0;
        $idAsistente = isset($data['id_asistente']) && $data['id_asistente'] !== '' ? (int)$data['id_asistente'] : null;
        $minuto = isset($data['minuto']) && $data['minuto'] !== '' ? (int)$data['minuto'] : null;
        $esRival = !empty($data['es_rival']);
        if ($esRival) {
            $idAsistente = null;
        }

        $tiposPermitidos = ['gol','autogol','tarjeta_amarilla','tarjeta_roja'];
        if (!in_array($tipo, $tiposPermitidos, true)) {
            throw new InvalidArgumentException('Tipo de evento no soportado');
        }
        if (!in_array($equipo, ['A','B'], true)) {
            throw new InvalidArgumentException('Equipo inválido para el evento');
        }
        if (!$esRival && $idJugador <= 0) {
            throw new InvalidArgumentException('Jugador inválido');
        }

        $conexion = FutbolDB::connectDB();
        $conexion->beginTransaction();
        try {
            if ($esRival) {
                $idJugador = self::obtenerJugadorRivalId($conexion);
            } else {
                $relacionPrincipal = self::obtenerRelacionJugadorPartido($idPartido, $idJugador, $conexion);
                if (!$relacionPrincipal) {
                    throw new InvalidArgumentException('El jugador no está inscrito en el partido');
                }
            }
            if ($idAsistente) {
                $relacionAsistente = self::obtenerRelacionJugadorPartido($idPartido, $idAsistente, $conexion);
                if (!$relacionAsistente) {
                    throw new InvalidArgumentException('El asistente no está inscrito en el partido');
                }
            }

            $stmt = $conexion->prepare('INSERT INTO partidos_eventos (id_partido, id_jugador, id_asistente, equipo, tipo, minuto) VALUES (:partido, :jugador, :asistente, :equipo, :tipo, :minuto)');
            $stmt->execute([
                ':partido' => $idPartido,
                ':jugador' => $idJugador,
                ':asistente' => $idAsistente,
                ':equipo' => $equipo,
                ':tipo' => $tipo,
                ':minuto' => $minuto,
            ]);

            $campo = self::resolverCampoMarcador($tipo, $equipo);
            if ($campo) {
                self::ajustarMarcador($conexion, $idPartido, $campo, 1);
            }

            $nuevoId = (int)$conexion->lastInsertId();
            $conexion->commit();
        } catch (Exception $e) {
            if ($conexion->inTransaction()) {
                $conexion->rollBack();
            }
            throw $e;
        }

        $evento = self::obtenerEventoPorId($nuevoId ?? 0);
        if ($evento) {
            return $evento;
        }

        error_log('registrarEvento: no se pudo recuperar el evento guardado, devolviendo payload base');
        return [
            'id' => $nuevoId,
            'id_partido' => $idPartido,
            'id_jugador' => $idJugador,
            'id_asistente' => $idAsistente,
            'equipo' => $equipo,
            'tipo' => $tipo,
            'minuto' => $minuto,
        ];
    }

    public static function eliminarEvento(int $idPartido, int $idEvento): bool {
        $conexion = FutbolDB::connectDB();
        $conexion->beginTransaction();
        try {
            $stmt = $conexion->prepare('SELECT * FROM partidos_eventos WHERE id = :id AND id_partido = :partido FOR UPDATE');
            $stmt->execute([':id' => $idEvento, ':partido' => $idPartido]);
            $evento = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$evento) {
                throw new InvalidArgumentException('Evento no encontrado');
            }

            $conexion->prepare('DELETE FROM partidos_eventos WHERE id = :id')->execute([':id' => $idEvento]);
            $campo = self::resolverCampoMarcador($evento['tipo'], $evento['equipo']);
            if ($campo) {
                self::ajustarMarcador($conexion, $idPartido, $campo, -1);
            }
            $conexion->commit();
            return true;
        } catch (Exception $e) {
            $conexion->rollBack();
            throw $e;
        }
    }

    private static function obtenerVotoCategoriaPorId(int $id): ?array {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare(
            "SELECT vc.*, vot.nombre AS votante_nombre, vot.apodo AS votante_apodo,
                    vo.nombre AS votado_nombre, vo.apodo AS votado_apodo
             FROM votos_categorias vc
             INNER JOIN jugadores vot ON vot.id = vc.id_votante
             INNER JOIN jugadores vo ON vo.id = vc.id_votado
             WHERE vc.id = :id"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private static function obtenerVotoMvpPorId(int $id): ?array {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare(
            "SELECT vm.*, vot.nombre AS votante_nombre, vot.apodo AS votante_apodo,
                    vo.nombre AS votado_nombre, vo.apodo AS votado_apodo
             FROM votos_mvp vm
             INNER JOIN jugadores vot ON vot.id = vm.id_votante
             INNER JOIN jugadores vo ON vo.id = vm.id_votado
             WHERE vm.id = :id"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public static function registrarVotoCategoria(array $partido, int $idVotante, string $categoria, int $idVotado, bool $permitirExcepcion = false): array {
        $idPartido = (int)($partido['id'] ?? 0);
        if ($idPartido <= 0) {
            throw new InvalidArgumentException('Partido inválido');
        }
        $categoria = strtolower(trim($categoria));
        if (!in_array($categoria, self::VOTACION_CATEGORIAS, true)) {
            throw new InvalidArgumentException('Categoría no permitida');
        }
        if ($idVotante <= 0 || $idVotado <= 0) {
            throw new InvalidArgumentException('Jugador no válido para votar');
        }

        $conexion = FutbolDB::connectDB();
        if (!$permitirExcepcion && !self::jugadorInscritoEnPartido($idPartido, $idVotante)) {
            throw new InvalidArgumentException('Debes haber disputado el partido para votar');
        }
        if (!self::jugadorInscritoEnPartido($idPartido, $idVotado)) {
            throw new InvalidArgumentException('Solo puedes votar a jugadores inscritos');
        }

        $conexion->beginTransaction();
        try {
            $conexion->prepare('DELETE FROM votos_categorias WHERE id_partido = :partido AND id_votante = :votante AND categoria = :categoria')
                ->execute([':partido' => $idPartido, ':votante' => $idVotante, ':categoria' => $categoria]);

            $stmtInsert = $conexion->prepare('INSERT INTO votos_categorias (id_partido, id_votante, id_votado, categoria) VALUES (:partido, :votante, :votado, :categoria)');
            $stmtInsert->execute([
                ':partido' => $idPartido,
                ':votante' => $idVotante,
                ':votado' => $idVotado,
                ':categoria' => $categoria,
            ]);

            $id = (int)$conexion->lastInsertId();
            $conexion->commit();
            $voto = self::obtenerVotoCategoriaPorId($id);
            if (!$voto) {
                throw new RuntimeException('No se pudo recuperar el voto recién emitido');
            }
            return $voto;
        } catch (Exception $e) {
            $conexion->rollBack();
            throw $e;
        }
    }

    public static function registrarVotoMvp(array $partido, int $idVotante, int $idVotado, bool $permitirExcepcion = false): array {
        $idPartido = (int)($partido['id'] ?? 0);
        if ($idPartido <= 0) {
            throw new InvalidArgumentException('Partido inválido');
        }
        if ($idVotante <= 0 || $idVotado <= 0) {
            throw new InvalidArgumentException('Jugador no válido para votar');
        }

        $conexion = FutbolDB::connectDB();
        if (!$permitirExcepcion && !self::jugadorInscritoEnPartido($idPartido, $idVotante)) {
            throw new InvalidArgumentException('Debes haber disputado el partido para votar');
        }
        if (!self::jugadorInscritoEnPartido($idPartido, $idVotado)) {
            throw new InvalidArgumentException('Solo puedes votar a jugadores inscritos');
        }

        $conexion->beginTransaction();
        try {
            $conexion->prepare('DELETE FROM votos_mvp WHERE id_partido = :partido AND id_votante = :votante')
                ->execute([':partido' => $idPartido, ':votante' => $idVotante]);

            $stmtInsert = $conexion->prepare('INSERT INTO votos_mvp (id_partido, id_votante, id_votado) VALUES (:partido, :votante, :votado)');
            $stmtInsert->execute([
                ':partido' => $idPartido,
                ':votante' => $idVotante,
                ':votado' => $idVotado,
            ]);

            $id = (int)$conexion->lastInsertId();
            $conexion->commit();
            $voto = self::obtenerVotoMvpPorId($id);
            if (!$voto) {
                throw new RuntimeException('No se pudo recuperar el voto recién emitido');
            }
            return $voto;
        } catch (Exception $e) {
            $conexion->rollBack();
            throw $e;
        }
    }

    public static function registrarRatingsJugadores(array $partido, int $idEvaluador, array $payload): array {
        $idPartido = (int)($partido['id'] ?? 0);
        if ($idPartido <= 0 || $idEvaluador <= 0) {
            throw new InvalidArgumentException('Datos de calificación inválidos');
        }
        if (!is_array($payload) || empty($payload)) {
            throw new InvalidArgumentException('No se recibieron calificaciones');
        }

        $conexion = FutbolDB::connectDB();
        $inscritos = self::jugadoresIdsInscritos($idPartido, $conexion);
        if (empty($inscritos)) {
            throw new InvalidArgumentException('El partido no tiene jugadores inscritos');
        }

        $ratingsNormalizados = [];
        foreach ($payload as $item) {
            if (!is_array($item)) {
                continue;
            }
            $idEvaluado = (int)($item['id_jugador'] ?? $item['id'] ?? 0);
            $valor = isset($item['rating']) ? (float)$item['rating'] : null;
            if ($idEvaluado <= 0 || $valor === null) {
                throw new InvalidArgumentException('Formato de calificación inválido');
            }
            if (!isset($inscritos[$idEvaluado])) {
                throw new InvalidArgumentException('Solo puedes calificar jugadores inscritos en el partido');
            }
            $valor = max(1.0, min(10.0, $valor));
            $ratingsNormalizados[$idEvaluado] = round($valor, 2);
        }

        if (count($ratingsNormalizados) !== count($inscritos)) {
            throw new InvalidArgumentException('Debes asignar una nota a cada jugador participante');
        }

        $conexion->beginTransaction();
        try {
            $stmt = $conexion->prepare(
                'INSERT INTO ratings_historial (id_partido, id_evaluador, id_evaluado, rating)
                 VALUES (:partido, :evaluador, :evaluado, :rating)
                 ON DUPLICATE KEY UPDATE rating = VALUES(rating), fecha_rating = CURRENT_TIMESTAMP'
            );
            foreach ($ratingsNormalizados as $idEvaluado => $valor) {
                $stmt->execute([
                    ':partido' => $idPartido,
                    ':evaluador' => $idEvaluador,
                    ':evaluado' => $idEvaluado,
                    ':rating' => $valor,
                ]);
            }
            $conexion->commit();
            return ['total' => count($ratingsNormalizados)];
        } catch (Exception $e) {
            if ($conexion->inTransaction()) {
                $conexion->rollBack();
            }
            throw $e;
        }
    }

    public static function activarVotacion(int $idPartido): bool {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare("UPDATE partidos SET votacion_habilitada = 1 WHERE id = :id AND estado = 'completado'");
        $stmt->execute([':id' => $idPartido]);
        return $stmt->rowCount() > 0;
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

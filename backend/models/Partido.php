<?php
require_once __DIR__ . '/../config/FutbolDB.php';

class Partido {
    private const ESTADOS_VALIDOS = ['programado','en_curso','completado','cancelado'];

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

    public static function listar(array $filters = []): array {
        $conexion = FutbolDB::connectDB();
        $where = [];
        $params = [];

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
        if (!$fecha || !$lugar) {
            throw new InvalidArgumentException('Fecha y lugar son obligatorios');
        }

        $payload = [
            'fecha_hora' => $fecha,
            'lugar_nombre' => $lugar,
            'lugar_enlace_maps' => $data['lugar_enlace_maps'] ?? null,
            'max_jugadores' => (int)($data['max_jugadores'] ?? 10),
            'precio_total_pista' => $data['precio_total_pista'] !== '' ? $data['precio_total_pista'] : null,
            'id_responsable_alquiler' => !empty($data['id_responsable_alquiler']) ? (int)$data['id_responsable_alquiler'] : null,
            'estado' => self::sanitizeEstado($data['estado'] ?? null),
            'equipos_generados' => !empty($data['equipos_generados']) ? 1 : 0,
            'votacion_habilitada' => !empty($data['votacion_habilitada']) ? 1 : 0,
            'notificado_a_jugadores' => !empty($data['notificado_a_jugadores']) ? 1 : 0,
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
            'notificado_a_jugadores' => fn($v) => !empty($v) ? 1 : 0,
            'goles_equipo_A' => fn($v) => (int)$v,
            'goles_equipo_B' => fn($v) => (int)$v,
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

    public static function resumenDashboard(): array {
        $conexion = FutbolDB::connectDB();

        $totProgramados = (int)$conexion->query("SELECT COUNT(*) FROM partidos WHERE eliminado = 0 AND estado = 'programado'")->fetchColumn();
        $totCompletados = (int)$conexion->query("SELECT COUNT(*) FROM partidos WHERE eliminado = 0 AND estado = 'completado'")->fetchColumn();
        $pendienteCobrar = (float)$conexion->query("SELECT COALESCE(SUM(precio_total_pista),0) FROM partidos WHERE eliminado = 0 AND estado = 'programado'")->fetchColumn();
        $recaudado = (float)$conexion->query("SELECT COALESCE(SUM(precio_total_pista),0) FROM partidos WHERE eliminado = 0 AND estado = 'completado'")->fetchColumn();

        $ocupacionStmt = $conexion->query(
            "SELECT AVG(ocupacion) FROM (
                SELECT CASE WHEN p.max_jugadores > 0 THEN (
                    (SELECT COUNT(*) FROM partidos_jugadores pj WHERE pj.id_partido = p.id) / p.max_jugadores
                ) ELSE NULL END AS ocupacion
                FROM partidos p
                WHERE p.eliminado = 0 AND p.max_jugadores > 0
            ) AS t"
        );
        $ocupacionVal = $ocupacionStmt->fetchColumn();
        $ocupacion = $ocupacionVal !== false && $ocupacionVal !== null ? (float)$ocupacionVal : 0.0;

        $proximoStmt = $conexion->query(
            "SELECT id, fecha_hora, lugar_nombre, estado
             FROM partidos
             WHERE eliminado = 0 AND fecha_hora >= NOW()
             ORDER BY fecha_hora ASC
             LIMIT 1"
        );
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
}

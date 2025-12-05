<?php
require_once __DIR__ . '/../config/FutbolDB.php';

class Bus {
    private const TIPOS_DIA_VALIDOS = ['L-V', 'SAB', 'DOM', 'VIE'];

    private static function fetchAll(PDO $db, string $sql, array $params = []): array {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private static function sanitizeLineaId(?int $lineaId): ?int {
        if ($lineaId === null) {
            return null;
        }
        if ($lineaId <= 0) {
            throw new InvalidArgumentException('linea_id inválido');
        }
        return $lineaId;
    }

    private static function sanitizeTipoDia(?string $tipoDia): ?string {
        if ($tipoDia === null || $tipoDia === '') {
            return null;
        }
        $normalized = strtoupper(trim($tipoDia));
        if (!in_array($normalized, self::TIPOS_DIA_VALIDOS, true)) {
            throw new InvalidArgumentException('tipo_dia inválido');
        }
        return $normalized;
    }

    public static function listLineas(?int $lineaId = null): array {
        $lineaId = self::sanitizeLineaId($lineaId);
        $db = FutbolDB::connectDB();

        $params = [];
        $sql = 'SELECT id, nombre, color FROM lineas';
        if ($lineaId !== null) {
            $sql .= ' WHERE id = :linea';
            $params[':linea'] = $lineaId;
        }
        $sql .= ' ORDER BY nombre ASC';

        $lineas = self::fetchAll($db, $sql, $params);
        if (empty($lineas)) {
            return [];
        }

        $ids = array_column($lineas, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stopsSql = 'SELECT lp.linea_id, lp.orden, p.id, p.nombre, p.latitud, p.longitud, p.direccion
                     FROM linea_parada lp
                     INNER JOIN paradas p ON p.id = lp.parada_id
                     WHERE lp.linea_id IN (' . $placeholders . ')
                     ORDER BY lp.linea_id ASC, lp.orden ASC';
        $stmtStops = $db->prepare($stopsSql);
        $stmtStops->execute($ids);
        $stopsRows = $stmtStops->fetchAll(PDO::FETCH_ASSOC);

        $stopsByLine = [];
        foreach ($stopsRows as $row) {
            $lineId = (int)$row['linea_id'];
            $stopsByLine[$lineId][] = [
                'id' => (int)$row['id'],
                'nombre' => $row['nombre'],
                'latitud' => (float)$row['latitud'],
                'longitud' => (float)$row['longitud'],
                'direccion' => $row['direccion'],
                'orden' => (int)$row['orden'],
            ];
        }

        foreach ($lineas as &$linea) {
            $id = (int)$linea['id'];
            $linea['id'] = $id;
            $linea['color'] = $linea['color'] ?? '#2563eb';
            $linea['stops'] = $stopsByLine[$id] ?? [];
        }
        unset($linea);

        return $lineas;
    }

    public static function listParadas(?string $search = null): array {
        $db = FutbolDB::connectDB();
        $params = [];
        $sql = 'SELECT p.id, p.nombre, p.latitud, p.longitud, p.direccion,
                       GROUP_CONCAT(DISTINCT l.nombre ORDER BY l.nombre SEPARATOR ",") AS lineas
                FROM paradas p
                LEFT JOIN linea_parada lp ON lp.parada_id = p.id
                LEFT JOIN lineas l ON l.id = lp.linea_id';

        if ($search !== null && trim($search) !== '') {
            $sql .= ' WHERE p.nombre LIKE :term OR p.direccion LIKE :term';
            $params[':term'] = '%' . trim($search) . '%';
        }

        $sql .= ' GROUP BY p.id ORDER BY p.nombre ASC';

        $rows = self::fetchAll($db, $sql, $params);
        return array_map(static function (array $row) {
            $lineas = array_filter(explode(',', (string)($row['lineas'] ?? '')));
            return [
                'id' => (int)$row['id'],
                'nombre' => $row['nombre'],
                'latitud' => (float)$row['latitud'],
                'longitud' => (float)$row['longitud'],
                'direccion' => $row['direccion'],
                'lineas' => array_values($lineas),
            ];
        }, $rows);
    }

    public static function listHorarios(int $lineaId, ?string $tipoDia = null): array {
        $lineaId = self::sanitizeLineaId($lineaId);
        if ($lineaId === null) {
            throw new InvalidArgumentException('linea_id es obligatorio');
        }
        $tipoDia = self::sanitizeTipoDia($tipoDia);

        $db = FutbolDB::connectDB();
        $params = [':linea' => $lineaId];
        $sql = 'SELECT id, linea_id, tipo_dia, TIME_FORMAT(hora, "%H:%i") AS hora, trayecto
                FROM horarios
                WHERE linea_id = :linea';
        if ($tipoDia !== null) {
            $sql .= ' AND tipo_dia = :tipo';
            $params[':tipo'] = $tipoDia;
        }
        $sql .= ' ORDER BY hora ASC';

        $rows = self::fetchAll($db, $sql, $params);
        return array_map(static function (array $row) {
            return [
                'id' => (int)$row['id'],
                'linea_id' => (int)$row['linea_id'],
                'tipo_dia' => $row['tipo_dia'],
                'hora' => $row['hora'],
                'trayecto' => $row['trayecto'],
            ];
        }, $rows);
    }
}

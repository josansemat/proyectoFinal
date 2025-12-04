<?php
require_once __DIR__ . '/../config/FutbolDB.php';

class FcmToken
{
    public static function upsert(int $usuarioId, string $token, ?string $device = null): bool
    {
        $conexion = FutbolDB::connectDB();
        $sql = "INSERT INTO fcm_tokens (usuario_id, token, device, activo)
                VALUES (:uid, :token, :device, 1)
                ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), device = VALUES(device), activo = 1, ultima_conexion = CURRENT_TIMESTAMP";
        $stmt = $conexion->prepare($sql);
        $stmt->bindValue(':uid', $usuarioId, PDO::PARAM_INT);
        $stmt->bindValue(':token', $token, PDO::PARAM_STR);
        if ($device === null) {
            $stmt->bindValue(':device', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':device', $device, PDO::PARAM_STR);
        }
        return $stmt->execute();
    }

    public static function deactivateByToken(string $token): bool
    {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare("UPDATE fcm_tokens SET activo = 0 WHERE token = :token");
        $stmt->bindValue(':token', $token, PDO::PARAM_STR);
        return $stmt->execute();
    }

    public static function deactivateAllForUser(int $usuarioId): bool
    {
        $conexion = FutbolDB::connectDB();
        $stmt = $conexion->prepare("UPDATE fcm_tokens SET activo = 0 WHERE usuario_id = :uid");
        $stmt->bindValue(':uid', $usuarioId, PDO::PARAM_INT);
        return $stmt->execute();
    }

    public static function listActiveTokensByEquipo(int $idEquipo): array
    {
        $conexion = FutbolDB::connectDB();
        $sql = "SELECT DISTINCT ft.token
                FROM fcm_tokens ft
                INNER JOIN jugadores j ON j.id = ft.usuario_id AND j.eliminado = 0
                INNER JOIN jugadores_equipos je ON je.idjugador = ft.usuario_id
                WHERE je.idequipo = :equipo AND je.rol_en_equipo IN ('manager', 'jugador') AND ft.activo = 1";
        $stmt = $conexion->prepare($sql);
        $stmt->bindValue(':equipo', $idEquipo, PDO::PARAM_INT);
        $stmt->execute();
        return array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'token');
    }

    public static function listActiveTokensByUsers(array $userIds): array
    {
        if (empty($userIds)) {
            return [];
        }
        $conexion = FutbolDB::connectDB();
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $sql = "SELECT DISTINCT token FROM fcm_tokens WHERE activo = 1 AND usuario_id IN ($placeholders)";
        $stmt = $conexion->prepare($sql);
        foreach ($userIds as $idx => $id) {
            $stmt->bindValue($idx + 1, (int)$id, PDO::PARAM_INT);
        }
        $stmt->execute();
        return array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'token');
    }
}

<?php

require_once __DIR__ . '/../models/FcmToken.php';

class FirebaseNotifier
{
    private const OAUTH_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
    private const OAUTH_URI = 'https://oauth2.googleapis.com/token';
    private const DEFAULT_CREDENTIALS = __DIR__ . '/../config/firebase-credentials.json';

    private static ?array $cachedCredentials = null;
    private static ?string $cachedToken = null;
    private static int $cachedTokenExpiresAt = 0;

    public static function sendMulticast(array $tokens, array $notification, array $data = []): array
    {
        $tokens = array_values(array_unique(array_filter($tokens)));
        if (empty($tokens)) {
            return ['success' => 0, 'failure' => 0, 'responses' => []];
        }

        $projectId = self::getProjectId();
        $normalizedData = self::normalizeDataPayload($data);
        if (!isset($notification['click_action']) && isset($normalizedData['click_action'])) {
            $notification['click_action'] = $normalizedData['click_action'];
        }

        $results = ['success' => 0, 'failure' => 0, 'responses' => []];
        foreach ($tokens as $token) {
            $response = self::sendMessageToToken($projectId, $token, $notification, $normalizedData);
            $results['responses'][] = $response;
            if (!empty($response['success'])) {
                $results['success']++;
            } else {
                $results['failure']++;
                if (!empty($response['deactivated'])) {
                    FcmToken::deactivateByToken($token);
                }
            }
        }

        return $results;
    }

    private static function sendMessageToToken(string $projectId, string $token, array $notification, array $data): array
    {
        $message = self::buildMessagePayload($token, $notification, $data);
        $url = sprintf('https://fcm.googleapis.com/v1/projects/%s/messages:send', $projectId);

        try {
            $response = self::authorizedJsonPost($url, ['message' => $message]);
            return ['token' => $token, 'success' => true, 'response' => $response];
        } catch (FirebaseNotifierException $e) {
            $shouldDeactivate = self::shouldDeactivateToken($e->getStatus(), $e->getMessage());
            return [
                'token' => $token,
                'success' => false,
                'status' => $e->getStatus(),
                'error' => $e->getMessage(),
                'response' => $e->getResponseBody(),
                'deactivated' => $shouldDeactivate,
            ];
        }
    }

    private static function buildMessagePayload(string $token, array $notification, array $data): array
    {
        $title = $notification['title'] ?? 'Furbo';
        $body = $notification['body'] ?? '';
        $clickAction = $notification['click_action'] ?? $data['click_action'] ?? '/';
        $icon = $notification['icon'] ?? '/favicon.ico';
        $image = $notification['image'] ?? null;

        $message = [
            'token' => $token,
            'data' => $data,
            'notification' => array_filter([
                'title' => $title,
                'body' => $body,
                'image' => $image,
            ]),
            'webpush' => [
                'headers' => ['Urgency' => 'high'],
                'notification' => array_filter([
                    'title' => $title,
                    'body' => $body,
                    'icon' => self::absoluteUrl($icon),
                    'image' => $image ? self::absoluteUrl($image) : null,
                    'click_action' => self::absoluteUrl($clickAction),
                    'badge' => self::absoluteUrl('/favicon.ico'),
                ]),
                'fcm_options' => [
                    'link' => self::absoluteUrl($clickAction),
                ],
            ],
        ];

        return $message;
    }

    private static function normalizeDataPayload(array $data): array
    {
        $normalized = [];
        foreach ($data as $key => $value) {
            if ($value === null) {
                continue;
            }
            if (is_bool($value)) {
                $normalized[$key] = $value ? '1' : '0';
            } elseif (is_scalar($value)) {
                $normalized[$key] = (string)$value;
            } else {
                $normalized[$key] = json_encode($value);
            }
        }
        return $normalized;
    }

    private static function absoluteUrl(string $pathOrUrl): string
    {
        if (preg_match('/^https?:\/\//i', $pathOrUrl)) {
            return $pathOrUrl;
        }
        $base = rtrim($_ENV['APP_BASE_URL'] ?? ($_ENV['RESET_URL'] ?? ''), '/');
        if (empty($base)) {
            return $pathOrUrl;
        }
        if ($pathOrUrl === '/') {
            return $base;
        }
        return $base . '/' . ltrim($pathOrUrl, '/');
    }

    private static function authorizedJsonPost(string $url, array $payload): array
    {
        $token = self::getAccessToken();
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $token,
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

        $raw = curl_exec($ch);
        if ($raw === false) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new FirebaseNotifierException('Error al contactar FCM: ' . $error);
        }

        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $decoded = json_decode($raw, true);

        if ($code >= 200 && $code < 300) {
            return $decoded ?? [];
        }

        $status = $decoded['error']['status'] ?? null;
        $message = $decoded['error']['message'] ?? ('Error HTTP ' . $code);
        throw new FirebaseNotifierException($message, $code, $status, $decoded);
    }

    private static function getAccessToken(): string
    {
        if (self::$cachedToken && (self::$cachedTokenExpiresAt - 60) > time()) {
            return self::$cachedToken;
        }

        $credentials = self::getCredentials();
        $jwt = self::buildSignedJwt($credentials);

        $postFields = http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt,
        ]);

        $ch = curl_init(self::OAUTH_URI);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/x-www-form-urlencoded',
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
        $raw = curl_exec($ch);
        if ($raw === false) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new RuntimeException('No se pudo obtener access token: ' . $error);
        }
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $decoded = json_decode($raw, true);
        if ($code >= 400 || !isset($decoded['access_token'])) {
            throw new RuntimeException('Respuesta inválida de OAuth: ' . $raw);
        }

        self::$cachedToken = $decoded['access_token'];
        self::$cachedTokenExpiresAt = time() + (int)($decoded['expires_in'] ?? 3600);
        return self::$cachedToken;
    }

    private static function buildSignedJwt(array $credentials): string
    {
        $header = ['alg' => 'RS256', 'typ' => 'JWT'];
        $now = time();
        $payload = [
            'iss' => $credentials['client_email'],
            'scope' => self::OAUTH_SCOPE,
            'aud' => self::OAUTH_URI,
            'iat' => $now - 60,
            'exp' => $now + 3600,
        ];

        $segments = [
            self::base64UrlEncode(json_encode($header)),
            self::base64UrlEncode(json_encode($payload)),
        ];
        $signingInput = implode('.', $segments);

        $privateKey = openssl_get_privatekey($credentials['private_key']);
        if ($privateKey === false) {
            throw new RuntimeException('No se pudo cargar la private_key de Firebase');
        }

        $signature = '';
        $ok = openssl_sign($signingInput, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        openssl_free_key($privateKey);
        if (!$ok) {
            throw new RuntimeException('No se pudo firmar el JWT de Firebase');
        }

        $segments[] = self::base64UrlEncode($signature);
        return implode('.', $segments);
    }

    private static function getCredentials(): array
    {
        if (self::$cachedCredentials !== null) {
            return self::$cachedCredentials;
        }

        $path = $_ENV['FIREBASE_CREDENTIALS_PATH'] ?? self::DEFAULT_CREDENTIALS;
        $path = trim($path);
        if ($path === '') {
            $path = self::DEFAULT_CREDENTIALS;
        }
        $path = self::resolveCredentialsPath($path);
        if (!is_file($path)) {
            throw new RuntimeException('No se encontró el archivo de credenciales de Firebase en ' . $path);
        }
        if (!is_readable($path)) {
            throw new RuntimeException('El archivo de credenciales de Firebase no es legible: ' . $path);
        }

        $json = file_get_contents($path);
        $decoded = json_decode($json, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('El archivo de credenciales de Firebase contiene JSON inválido');
        }

        self::$cachedCredentials = $decoded;
        return $decoded;
    }

    private static function getProjectId(): string
    {
        $projectId = $_ENV['FIREBASE_PROJECT_ID'] ?? null;
        if (!$projectId) {
            $credentials = self::getCredentials();
            $projectId = $credentials['project_id'] ?? null;
        }
        if (!$projectId) {
            throw new RuntimeException('Falta FIREBASE_PROJECT_ID en el entorno');
        }
        return $projectId;
    }

    private static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function resolveCredentialsPath(string $path): string
    {
        if (self::isAbsolutePath($path)) {
            return $path;
        }

        $baseDir = dirname(__DIR__);
        $trimmed = ltrim($path, '/\\');
        if ($trimmed === '') {
            return $baseDir;
        }

        return rtrim($baseDir, '/\\') . DIRECTORY_SEPARATOR . $trimmed;
    }

    private static function isAbsolutePath(string $path): bool
    {
        if ($path === '') {
            return false;
        }
        if ($path[0] === '/' || $path[0] === '\\') {
            return true;
        }
        return (bool)preg_match('/^[A-Za-z]:[\\\\\/]/', $path);
    }

    private static function shouldDeactivateToken(?string $status, string $message): bool
    {
        $status = strtoupper((string)$status);
        if (in_array($status, ['NOT_FOUND', 'UNREGISTERED'], true)) {
            return true;
        }
        if ($status === 'INVALID_ARGUMENT' && str_contains(strtolower($message), 'registration token')) {
            return true;
        }
        return false;
    }
}

class FirebaseNotifierException extends RuntimeException
{
    private ?string $status;
    private ?array $responseBody;

    public function __construct(string $message, int $code = 0, ?string $status = null, ?array $responseBody = null)
    {
        parent::__construct($message, $code);
        $this->status = $status;
        $this->responseBody = $responseBody;
    }

    public function getStatus(): ?string
    {
        return $this->status;
    }

    public function getResponseBody(): ?array
    {
        return $this->responseBody;
    }
}

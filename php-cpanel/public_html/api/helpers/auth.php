<?php
declare(strict_types=1);

function jsonResponse(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonBody(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string {
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/')) ?: '';
}

function signToken(int $userId, string $role): string {
    $header = base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64UrlEncode(json_encode([
        'sub' => $userId,
        'role' => $role,
        'exp' => time() + (60 * 60 * 24 * 7),
    ]));
    $sig = base64UrlEncode(hash_hmac('sha256', "$header.$payload", APP_JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function getBearerToken(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';
    if (!$header && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (preg_match('/Bearer\s+(.+)$/i', trim($header), $m)) {
        return trim($m[1]);
    }
    return null;
}

function verifyToken(?string $token): ?array {
    if (!$token) {
        return null;
    }
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }
    [$header, $payload, $sig] = $parts;
    $expected = base64UrlEncode(hash_hmac('sha256', "$header.$payload", APP_JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) {
        return null;
    }
    $data = json_decode(base64UrlDecode($payload), true);
    if (!is_array($data) || ($data['exp'] ?? 0) < time()) {
        return null;
    }
    return $data;
}

function formatUserRow(array $row): array {
    return [
        'id' => (int)$row['id'],
        'name' => $row['name'],
        'username' => $row['username'] ?? $row['name'],
        'phone' => $row['phone'] ?? '',
        'email' => $row['email'],
        'country' => $row['country'],
        'role' => $row['role'],
        'status' => $row['status'],
        'kycStatus' => $row['kyc_status'],
        'kycDocumentUrl' => $row['kyc_document_url'],
        'kycNote' => $row['kyc_note'],
        'earningBalance' => (float)$row['earning_balance'],
        'depositBalance' => (float)$row['deposit_balance'],
        'referralCode' => $row['referral_code'],
        'referredBy' => $row['referred_by'] ? (int)$row['referred_by'] : null,
        'referralEarned' => (float)$row['referral_earned'],
        'tasksCompleted' => (int)$row['tasks_completed'],
        'createdAt' => $row['created_at'],
    ];
}

function requireAuth(PDO $pdo): array {
    $claims = verifyToken(getBearerToken());
    if (!$claims || empty($claims['sub'])) {
        jsonResponse(['error' => 'Authentication required.'], 401);
    }
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([(int)$claims['sub']]);
    $user = $stmt->fetch();
    if (!$user) {
        jsonResponse(['error' => 'Account not found.'], 401);
    }
    if ($user['status'] === 'banned') {
        jsonResponse(['error' => 'Account is suspended.'], 403);
    }
    return $user;
}

function requireAdmin(PDO $pdo): array {
    $user = requireAuth($pdo);
    if ($user['role'] !== 'admin') {
        jsonResponse(['error' => 'Admin access required.'], 403);
    }
    return $user;
}

function saveBase64Upload(string $dataUrl): string {
    if (!preg_match('/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i', $dataUrl, $matches)) {
        jsonResponse(['error' => 'Only PNG, JPG, or WEBP images are allowed.'], 400);
    }
    $ext = strtolower($matches[1]) === 'jpeg' ? 'jpg' : strtolower($matches[1]);
    $binary = base64_decode($matches[2], true);
    if ($binary === false || strlen($binary) > 2 * 1024 * 1024) {
        jsonResponse(['error' => 'Image must be valid and under 2MB.'], 400);
    }
    $uploadDir = dirname(__DIR__, 2) . '/uploads';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    file_put_contents($uploadDir . '/' . $filename, $binary);
    return '/uploads/' . $filename;
}

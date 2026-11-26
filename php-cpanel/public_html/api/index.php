<?php
declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/auth.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/JobController.php';
require_once __DIR__ . '/controllers/WalletController.php';
require_once __DIR__ . '/controllers/AdminController.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^/api#', '', $uriPath);
if ($path === '' || $path === '/index.php') {
    $path = '/';
}

try {
    $pdo = getPDO();

    if ($method === 'GET' && $path === '/bootstrap') {
        handleBootstrap($pdo);
    }

    if (handleAuthRoutes($pdo, $method, $path)) {
        exit;
    }
    if (handleJobRoutes($pdo, $method, $path)) {
        exit;
    }
    if (handleWalletRoutes($pdo, $method, $path)) {
        exit;
    }
    if (handleAdminRoutes($pdo, $method, $path)) {
        exit;
    }

    jsonResponse(['error' => 'Endpoint not found: ' . $path], 404);
} catch (Throwable $e) {
    jsonResponse(['error' => 'Server error: ' . $e->getMessage()], 500);
}

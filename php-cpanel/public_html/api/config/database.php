<?php
declare(strict_types=1);

/**
 * Viral Bolt cPanel Database & Security Configuration
 * Update DB_NAME, DB_USER, DB_PASS, and APP_JWT_SECRET after creating your MySQL database in cPanel.
 */

define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'cpanel_viralbolt');
define('DB_USER', getenv('DB_USER') ?: 'cpanel_dbuser');
define('DB_PASS', getenv('DB_PASS') ?: 'CHANGE_THIS_PASSWORD');

// Generate a long random string (64+ chars) for production JWT signing
define('APP_JWT_SECRET', getenv('APP_JWT_SECRET') ?: 'REPLACE_WITH_RANDOM_64_CHAR_HEX_SECRET_BEFORE_PRODUCTION');

// Optional fixed admin passcode (leave empty to allow first-run Admin Claim in the UI)
define('ADMIN_PASSCODE', getenv('ADMIN_PASSCODE') ?: '');

function getPDO(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    return $pdo;
}

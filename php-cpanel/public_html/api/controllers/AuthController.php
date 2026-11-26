<?php
declare(strict_types=1);

function getSettingsRow(PDO $pdo): array {
    $row = $pdo->query('SELECT * FROM settings WHERE id = 1')->fetch();
    return [
        'siteName' => $row['site_name'],
        'currencySymbol' => $row['currency_symbol'],
        'platformFeePercent' => (float)$row['platform_fee_percent'],
        'referralCommissionPercent' => (float)$row['referral_commission_percent'],
        'minJobWorkers' => (int)$row['min_job_workers'],
        'autoApproveJobs' => (bool)$row['auto_approve_jobs'],
        'noticeBanner' => $row['notice_banner'],
        'supportEmail' => $row['support_email'],
    ];
}

function formatJobRow(array $row): array {
    return [
        'id' => (int)$row['id'],
        'employerId' => (int)$row['employer_id'],
        'employerName' => $row['employer_name'] ?? 'Employer',
        'categoryId' => (int)$row['category_id'],
        'categoryName' => $row['category_name'] ?? 'General',
        'categoryColor' => $row['category_color'] ?? 'indigo',
        'title' => $row['title'],
        'targetRegion' => $row['target_region'],
        'targetUrl' => $row['target_url'],
        'steps' => json_decode($row['steps_json'] ?: '[]', true) ?: [],
        'proofRequirement' => $row['proof_requirement'],
        'requireScreenshot' => (bool)$row['require_screenshot'],
        'rewardPerWorker' => (float)$row['reward_per_worker'],
        'workersNeeded' => (int)$row['workers_needed'],
        'workersCompleted' => (int)$row['workers_completed'],
        'platformFee' => (float)$row['platform_fee'],
        'totalBudget' => (float)$row['total_budget'],
        'featured' => (bool)$row['featured'],
        'status' => $row['status'],
        'rejectionReason' => $row['rejection_reason'],
        'estimatedMinutes' => (int)$row['estimated_minutes'],
        'createdAt' => $row['created_at'],
    ];
}

function handleBootstrap(PDO $pdo): never {
    $settings = getSettingsRow($pdo);
    $categories = array_map(fn($c) => [
        'id' => (int)$c['id'],
        'name' => $c['name'],
        'slug' => $c['slug'],
        'color' => $c['color'],
        'minCpc' => (float)$c['min_cpc'],
        'description' => $c['description'],
        'active' => (bool)$c['active'],
    ], $pdo->query('SELECT * FROM categories WHERE active = 1 ORDER BY id ASC')->fetchAll());

    $gateways = array_map(fn($g) => [
        'id' => (int)$g['id'],
        'name' => $g['name'],
        'code' => $g['code'],
        'type' => $g['type'],
        'accountDetails' => $g['account_details'],
        'instructions' => $g['instructions'],
        'minAmount' => (float)$g['min_amount'],
        'maxAmount' => (float)$g['max_amount'],
        'feePercent' => (float)$g['fee_percent'],
        'color' => $g['color'],
        'active' => (bool)$g['active'],
    ], $pdo->query('SELECT * FROM gateways WHERE active = 1 ORDER BY id ASC')->fetchAll());

    $jobsSql = "SELECT j.*, u.name AS employer_name, c.name AS category_name, c.color AS category_color
                FROM jobs j
                JOIN users u ON u.id = j.employer_id
                JOIN categories c ON c.id = j.category_id
                WHERE j.status = 'active'
                ORDER BY j.featured DESC, j.id DESC";
    $jobs = array_map('formatJobRow', $pdo->query($jobsSql)->fetchAll());

    $workersCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'user'")->fetchColumn();
    $tasksPaid = (int)$pdo->query("SELECT COALESCE(SUM(tasks_completed), 0) FROM users")->fetchColumn();
    $paidOut = (float)$pdo->query("SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'approved'")->fetchColumn();

    jsonResponse([
        'settings' => $settings,
        'categories' => $categories,
        'gateways' => $gateways,
        'jobs' => $jobs,
        'stats' => [
            'activeJobsCount' => count($jobs),
            'totalWorkersCount' => $workersCount,
            'totalTasksPaid' => $tasksPaid,
            'totalPaidOutUsd' => round($paidOut, 2),
        ],
    ]);
}

function handleAuthRoutes(PDO $pdo, string $method, string $path): bool {
    if ($method === 'GET' && $path === '/auth/admin-status') {
        $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();
        jsonResponse([
            'claimed' => $adminCount > 0 || ADMIN_PASSCODE !== '',
            'hasEnvPasscode' => ADMIN_PASSCODE !== '',
        ]);
    }

    if ($method === 'POST' && $path === '/auth/claim-admin') {
        $body = getJsonBody();
        $email = strtolower(trim((string)($body['email'] ?? 'admin@viralbolt.local')));
        $password = (string)($body['password'] ?? '');
        $name = trim((string)($body['name'] ?? 'Platform Admin'));

        if (ADMIN_PASSCODE !== '') {
            if (!hash_equals(ADMIN_PASSCODE, $password)) {
                jsonResponse(['error' => 'Invalid admin passcode.'], 401);
            }
        } elseif (strlen($password) < 6) {
            jsonResponse(['error' => 'Admin password must be at least 6 characters.'], 400);
        }

        $stmt = $pdo->prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
        $stmt->execute();
        $existingAdmin = $stmt->fetch();

        if ($existingAdmin && ADMIN_PASSCODE === '') {
            jsonResponse(['error' => 'Admin account is already claimed. Please sign in.'], 409);
        }

        if (!$existingAdmin) {
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $refCode = 'ADM' . strtoupper(bin2hex(random_bytes(3)));
            $ins = $pdo->prepare('INSERT INTO users (name, username, phone, email, password_hash, country, role, status, kyc_status, referral_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $ins->execute([$name, 'admin', null, $email, $hash, 'Global', 'admin', 'active', 'verified', $refCode]);
            $adminId = (int)$pdo->lastInsertId();
            $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
            $stmt->execute([$adminId]);
            $existingAdmin = $stmt->fetch();
        }

        $token = signToken((int)$existingAdmin['id'], 'admin');
        jsonResponse(['token' => $token, 'user' => formatUserRow($existingAdmin)]);
    }

    if ($method === 'POST' && $path === '/auth/register') {
        $body = getJsonBody();
        $rawUsername = trim((string)($body['username'] ?? $body['name'] ?? ''));
        $name = trim((string)($body['name'] ?? $rawUsername));
        $phone = preg_replace('/[^\d+]/', '', trim((string)($body['phone'] ?? '')));
        $rawEmail = strtolower(trim((string)($body['email'] ?? '')));
        $password = (string)($body['password'] ?? '');
        $country = trim((string)($body['country'] ?? 'Bangladesh')) ?: 'Bangladesh';
        $refInput = strtoupper(trim((string)($body['referralCode'] ?? '')));

        if (strlen($rawUsername) < 2 || strlen($phone) < 7 || strlen($password) < 6) {
            jsonResponse(['error' => 'Enter a valid User Name (2+ chars), Phone Number (7+ digits), and 6+ character Password.'], 400);
        }

        $email = ($rawEmail !== '' && filter_var($rawEmail, FILTER_VALIDATE_EMAIL))
            ? $rawEmail
            : preg_replace('/\+/', '', $phone) . '@viralbolt.user';

        $chkPhone = $pdo->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
        $chkPhone->execute([$phone]);
        if ($chkPhone->fetch()) {
            jsonResponse(['error' => 'An account with this Phone Number already exists.'], 409);
        }

        $chkUser = $pdo->prepare('SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1');
        $chkUser->execute([strtolower($rawUsername)]);
        if ($chkUser->fetch()) {
            jsonResponse(['error' => 'This User Name is already taken.'], 409);
        }

        $chk = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $chk->execute([$email]);
        if ($chk->fetch()) {
            jsonResponse(['error' => 'An account with this email already exists.'], 409);
        }

        $referredBy = null;
        if ($refInput !== '') {
            $rStmt = $pdo->prepare('SELECT id FROM users WHERE referral_code = ? LIMIT 1');
            $rStmt->execute([$refInput]);
            $refRow = $rStmt->fetch();
            if ($refRow) {
                $referredBy = (int)$refRow['id'];
            }
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $prefix = substr(preg_replace('/[^A-Z0-9]/', '', strtoupper($rawUsername)), 0, 4) ?: 'USER';
        $myRefCode = $prefix . strtoupper(bin2hex(random_bytes(2)));
        $ins = $pdo->prepare('INSERT INTO users (name, username, phone, email, password_hash, country, role, status, kyc_status, deposit_balance, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $ins->execute([$name, $rawUsername, $phone, $email, $hash, $country, 'user', 'active', 'unverified', 5.0000, $myRefCode, $referredBy]);
        $userId = (int)$pdo->lastInsertId();

        $uStmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $uStmt->execute([$userId]);
        $user = $uStmt->fetch();

        jsonResponse(['token' => signToken($userId, 'user'), 'user' => formatUserRow($user)], 201);
    }

    if ($method === 'POST' && $path === '/auth/login') {
        $body = getJsonBody();
        $identifier = trim((string)($body['phone'] ?? $body['identifier'] ?? $body['email'] ?? ''));
        $password = (string)($body['password'] ?? '');

        if ($identifier === '' || $password === '') {
            jsonResponse(['error' => 'Phone Number (or Email) and Password are required.'], 400);
        }

        $idLower = strtolower($identifier);
        $idPhone = preg_replace('/[^\d+]/', '', $identifier);

        $stmt = $pdo->prepare('SELECT * FROM users WHERE (phone = ? AND phone IS NOT NULL AND phone <> "") OR LOWER(email) = ? OR LOWER(username) = ? LIMIT 1');
        $stmt->execute([$idPhone, $idLower, $idLower]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            jsonResponse(['error' => 'Invalid Phone Number / Email or Password.'], 401);
        }
        if ($user['status'] === 'banned') {
            jsonResponse(['error' => 'This account has been suspended by administration.'], 403);
        }

        jsonResponse(['token' => signToken((int)$user['id'], $user['role']), 'user' => formatUserRow($user)]);
    }

    if ($method === 'GET' && $path === '/auth/me') {
        $user = requireAuth($pdo);
        jsonResponse(['user' => formatUserRow($user)]);
    }

    if ($method === 'POST' && $path === '/auth/profile') {
        $user = requireAuth($pdo);
        $body = getJsonBody();
        $name = trim((string)($body['name'] ?? $user['name']));
        $country = trim((string)($body['country'] ?? $user['country']));
        $phone = isset($body['phone']) ? preg_replace('/[^\d+]/', '', trim((string)$body['phone'])) : (string)($user['phone'] ?? '');
        if ($phone !== '' && $phone !== ($user['phone'] ?? '')) {
            $chkPhone = $pdo->prepare('SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1');
            $chkPhone->execute([$phone, (int)$user['id']]);
            if ($chkPhone->fetch()) {
                jsonResponse(['error' => 'This Phone Number is already used by another account.'], 409);
            }
        }
        $upd = $pdo->prepare('UPDATE users SET name = ?, phone = ?, country = ? WHERE id = ?');
        $upd->execute([$name, $phone !== '' ? $phone : null, $country, (int)$user['id']]);
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([(int)$user['id']]);
        jsonResponse(['user' => formatUserRow($stmt->fetch())]);
    }

    if ($method === 'POST' && $path === '/auth/change-password') {
        $user = requireAuth($pdo);
        $body = getJsonBody();
        $current = (string)($body['currentPassword'] ?? '');
        $next = (string)($body['newPassword'] ?? '');
        if (!password_verify($current, $user['password_hash'])) {
            jsonResponse(['error' => 'Current password is incorrect.'], 400);
        }
        if (strlen($next) < 6) {
            jsonResponse(['error' => 'New password must be at least 6 characters.'], 400);
        }
        $upd = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $upd->execute([password_hash($next, PASSWORD_BCRYPT), (int)$user['id']]);
        jsonResponse(['ok' => true]);
    }

    return false;
}

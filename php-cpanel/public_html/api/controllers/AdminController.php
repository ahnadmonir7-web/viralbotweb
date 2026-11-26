<?php
declare(strict_types=1);

function logAdminAction(PDO $pdo, array $admin, string $action, string $details): void {
    $stmt = $pdo->prepare('INSERT INTO activity_logs (admin_id, admin_name, action, details) VALUES (?, ?, ?, ?)');
    $stmt->execute([(int)$admin['id'], (string)$admin['name'], $action, $details]);
}

function handleAdminRoutes(PDO $pdo, string $method, string $path): bool {
    if (!str_starts_with($path, '/admin')) {
        return false;
    }

    $admin = requireAdmin($pdo);

    if ($method === 'POST' && $path === '/admin/upload') {
        $b = getJsonBody();
        $imageData = trim((string)($b['imageData'] ?? ''));
        if ($imageData === '') {
            jsonResponse(['error' => 'Image data is required.'], 400);
        }
        $url = saveBase64Upload($imageData);
        jsonResponse(['url' => $url]);
    }

    if ($method === 'GET' && $path === '/admin/overview') {
        $totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'user'")->fetchColumn();
        $activeJobs = (int)$pdo->query("SELECT COUNT(*) FROM jobs WHERE status = 'active'")->fetchColumn();
        $pendingJobs = (int)$pdo->query("SELECT COUNT(*) FROM jobs WHERE status = 'pending'")->fetchColumn();
        $pendingDeposits = (int)$pdo->query("SELECT COUNT(*) FROM deposits WHERE status = 'pending'")->fetchColumn();
        $pendingDepositsAmount = (float)$pdo->query("SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status = 'pending'")->fetchColumn();
        $approvedDepositsAmount = (float)$pdo->query("SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status = 'approved'")->fetchColumn();
        $pendingWithdrawals = (int)$pdo->query("SELECT COUNT(*) FROM withdrawals WHERE status = 'pending'")->fetchColumn();
        $pendingWithdrawalsAmount = (float)$pdo->query("SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'pending'")->fetchColumn();
        $approvedWithdrawalsAmount = (float)$pdo->query("SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'approved'")->fetchColumn();
        $openTickets = (int)$pdo->query("SELECT COUNT(*) FROM tickets WHERE status IN ('open', 'answered')")->fetchColumn();
        $platformRevenue = (float)$pdo->query("SELECT COALESCE(SUM(platform_fee), 0) FROM jobs WHERE status IN ('active', 'completed', 'paused')")->fetchColumn();
        $totalUserEarnings = (float)$pdo->query("SELECT COALESCE(SUM(earning_balance), 0) FROM users WHERE role = 'user'")->fetchColumn();
        $totalUserDeposits = (float)$pdo->query("SELECT COALESCE(SUM(deposit_balance), 0) FROM users WHERE role = 'user'")->fetchColumn();
        $publishedBlogs = (int)$pdo->query('SELECT COUNT(*) FROM blog_posts WHERE published = 1')->fetchColumn();
        $publishedPages = (int)$pdo->query('SELECT COUNT(*) FROM pages WHERE published = 1')->fetchColumn();

        jsonResponse([
            'totalUsers' => $totalUsers,
            'activeJobs' => $activeJobs,
            'pendingJobs' => $pendingJobs,
            'pendingDeposits' => $pendingDeposits,
            'pendingDepositsAmount' => round($pendingDepositsAmount, 2),
            'approvedDepositsAmount' => round($approvedDepositsAmount, 2),
            'pendingWithdrawals' => $pendingWithdrawals,
            'pendingWithdrawalsAmount' => round($pendingWithdrawalsAmount, 2),
            'approvedWithdrawalsAmount' => round($approvedWithdrawalsAmount, 2),
            'openTickets' => $openTickets,
            'platformRevenue' => round($platformRevenue, 2),
            'totalUserEarnings' => round($totalUserEarnings, 2),
            'totalUserDeposits' => round($totalUserDeposits, 2),
            'publishedBlogs' => $publishedBlogs,
            'publishedPages' => $publishedPages,
        ]);
    }

    if ($method === 'GET' && $path === '/admin/activity') {
        $rows = array_map(fn($r) => [
            'id' => (int)$r['id'],
            'adminId' => (int)$r['admin_id'],
            'adminName' => $r['admin_name'],
            'action' => $r['action'],
            'details' => $r['details'],
            'createdAt' => $r['created_at'],
        ], $pdo->query('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 120')->fetchAll());
        jsonResponse(['logs' => $rows]);
    }

    if ($method === 'GET' && $path === '/admin/jobs') {
        $sql = "SELECT j.*, u.name AS employer_name, c.name AS category_name, c.color AS category_color
                FROM jobs j JOIN users u ON u.id = j.employer_id JOIN categories c ON c.id = j.category_id
                ORDER BY FIELD(j.status, 'pending', 'active', 'paused', 'completed', 'rejected'), j.id DESC";
        jsonResponse(['jobs' => array_map('formatJobRow', $pdo->query($sql)->fetchAll())]);
    }

    if ($method === 'POST' && $path === '/admin/jobs') {
        $b = getJsonBody();
        $categoryId = (int)($b['categoryId'] ?? 0);
        $title = trim((string)($b['title'] ?? ''));
        $targetRegion = trim((string)($b['targetRegion'] ?? 'Worldwide')) ?: 'Worldwide';
        $targetUrl = sanitizeUrlSafe((string)($b['targetUrl'] ?? ''));
        $steps = is_array($b['steps'] ?? null)
            ? array_values(array_filter(array_map('trim', $b['steps'])))
            : array_values(array_filter(array_map('trim', explode("\n", (string)($b['stepsText'] ?? '')))));
        $proofRequirement = trim((string)($b['proofRequirement'] ?? ''));
        $requireScreenshot = !empty($b['requireScreenshot']) ? 1 : 0;
        $rewardPerWorker = max(0.01, round((float)($b['rewardPerWorker'] ?? 0.1), 4));
        $workersNeeded = max(1, (int)($b['workersNeeded'] ?? 10));
        $estimatedMinutes = max(1, (int)($b['estimatedMinutes'] ?? 3));
        $featured = !empty($b['featured']) ? 1 : 0;

        $cStmt = $pdo->prepare('SELECT id FROM categories WHERE id = ? LIMIT 1');
        $cStmt->execute([$categoryId]);
        if (!$cStmt->fetch() || strlen($title) < 4 || empty($steps) || strlen($proofRequirement) < 4) {
            jsonResponse(['error' => 'Category, title, steps, and proof requirement are required.'], 400);
        }

        $totalBudget = round($rewardPerWorker * $workersNeeded, 4);
        $ins = $pdo->prepare('INSERT INTO jobs (employer_id, category_id, title, target_region, target_url, steps_json, proof_requirement, require_screenshot, reward_per_worker, workers_needed, platform_fee, total_budget, featured, status, estimated_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $ins->execute([
            (int)$admin['id'],
            $categoryId,
            $title,
            $targetRegion,
            $targetUrl,
            json_encode($steps, JSON_UNESCAPED_UNICODE),
            $proofRequirement,
            $requireScreenshot,
            $rewardPerWorker,
            $workersNeeded,
            0.0,
            $totalBudget,
            $featured,
            'active',
            $estimatedMinutes,
        ]);
        $jobId = (int)$pdo->lastInsertId();
        logAdminAction($pdo, $admin, 'Create Job', "Created official campaign #$jobId: $title");

        $jStmt = $pdo->prepare("SELECT j.*, u.name AS employer_name, c.name AS category_name, c.color AS category_color
                                FROM jobs j JOIN users u ON u.id = j.employer_id JOIN categories c ON c.id = j.category_id
                                WHERE j.id = ?");
        $jStmt->execute([$jobId]);
        jsonResponse(['job' => formatJobRow($jStmt->fetch())], 201);
    }

    if ($method === 'PUT' && preg_match('#^/admin/jobs/(\d+)$#', $path, $m)) {
        $jobId = (int)$m[1];
        $jStmt = $pdo->prepare('SELECT * FROM jobs WHERE id = ? LIMIT 1');
        $jStmt->execute([$jobId]);
        $existing = $jStmt->fetch();
        if (!$existing) {
            jsonResponse(['error' => 'Job not found.'], 404);
        }
        $b = getJsonBody();
        $catId = !empty($b['categoryId']) ? (int)$b['categoryId'] : (int)$existing['category_id'];
        $title = trim((string)($b['title'] ?? $existing['title']));
        $region = trim((string)($b['targetRegion'] ?? $existing['target_region']));
        $url = array_key_exists('targetUrl', $b) ? sanitizeUrlSafe((string)$b['targetUrl']) : $existing['target_url'];
        $stepsJson = is_array($b['steps'] ?? null)
            ? json_encode(array_values(array_filter(array_map('trim', $b['steps']))), JSON_UNESCAPED_UNICODE)
            : $existing['steps_json'];
        $proofReq = trim((string)($b['proofRequirement'] ?? $existing['proof_requirement']));
        $reqShot = array_key_exists('requireScreenshot', $b) ? (!empty($b['requireScreenshot']) ? 1 : 0) : (int)$existing['require_screenshot'];
        $reward = array_key_exists('rewardPerWorker', $b) ? max(0.01, round((float)$b['rewardPerWorker'], 4)) : (float)$existing['reward_per_worker'];
        $workersNeeded = array_key_exists('workersNeeded', $b) ? max((int)$existing['workers_completed'], (int)$b['workersNeeded']) : (int)$existing['workers_needed'];
        $featured = array_key_exists('featured', $b) ? (!empty($b['featured']) ? 1 : 0) : (int)$existing['featured'];
        $status = in_array($b['status'] ?? '', ['pending', 'active', 'paused', 'completed', 'rejected'], true) ? $b['status'] : $existing['status'];

        $pdo->prepare('UPDATE jobs SET category_id = ?, title = ?, target_region = ?, target_url = ?, steps_json = ?, proof_requirement = ?, require_screenshot = ?, reward_per_worker = ?, workers_needed = ?, featured = ?, status = ? WHERE id = ?')
            ->execute([$catId, $title, $region, $url, $stepsJson, $proofReq, $reqShot, $reward, $workersNeeded, $featured, $status, $jobId]);
        logAdminAction($pdo, $admin, 'Edit Job', "Updated campaign #$jobId: $title");

        $outStmt = $pdo->prepare("SELECT j.*, u.name AS employer_name, c.name AS category_name, c.color AS category_color
                                  FROM jobs j JOIN users u ON u.id = j.employer_id JOIN categories c ON c.id = j.category_id
                                  WHERE j.id = ?");
        $outStmt->execute([$jobId]);
        jsonResponse(['job' => formatJobRow($outStmt->fetch())]);
    }

    if ($method === 'POST' && preg_match('#^/admin/jobs/(\d+)/decision$#', $path, $m)) {
        $jobId = (int)$m[1];
        $body = getJsonBody();
        $action = (string)($body['action'] ?? '');
        $reason = trim((string)($body['reason'] ?? ''));

        $stmt = $pdo->prepare('SELECT * FROM jobs WHERE id = ? LIMIT 1');
        $stmt->execute([$jobId]);
        $job = $stmt->fetch();
        if (!$job) {
            jsonResponse(['error' => 'Job not found.'], 404);
        }

        if ($action === 'approve') {
            $pdo->prepare("UPDATE jobs SET status = 'active', rejection_reason = NULL WHERE id = ?")->execute([$jobId]);
        } elseif ($action === 'pause') {
            $nextSt = $job['status'] === 'paused' ? 'active' : 'paused';
            $pdo->prepare('UPDATE jobs SET status = ? WHERE id = ?')->execute([$nextSt, $jobId]);
        } elseif ($action === 'reject') {
            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE jobs SET status = 'rejected', rejection_reason = ? WHERE id = ?")->execute([$reason, $jobId]);
                if ($job['status'] === 'pending') {
                    $refund = (float)$job['total_budget'];
                    $pdo->prepare('UPDATE users SET deposit_balance = deposit_balance + ? WHERE id = ?')->execute([$refund, (int)$job['employer_id']]);
                    $pdo->prepare('INSERT INTO transactions (user_id, type, wallet, amount, description) VALUES (?, ?, ?, ?, ?)')
                        ->execute([(int)$job['employer_id'], 'job_refund', 'deposit', $refund, "Refund for rejected Job #$jobId"]);
                }
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                jsonResponse(['error' => $e->getMessage()], 400);
            }
        } elseif ($action === 'toggle_feature') {
            $pdo->prepare('UPDATE jobs SET featured = NOT featured WHERE id = ?')->execute([$jobId]);
        } elseif ($action === 'delete') {
            $pdo->prepare('DELETE FROM jobs WHERE id = ?')->execute([$jobId]);
        } else {
            jsonResponse(['error' => 'Invalid action.'], 400);
        }
        logAdminAction($pdo, $admin, 'Job Action', "$action on Job #$jobId");
        jsonResponse(['ok' => true]);
    }

    if ($method === 'GET' && $path === '/admin/categories') {
        $rows = array_map(fn($c) => [
            'id' => (int)$c['id'],
            'name' => $c['name'],
            'slug' => $c['slug'],
            'color' => $c['color'],
            'minCpc' => (float)$c['min_cpc'],
            'description' => $c['description'],
            'active' => (bool)$c['active'],
        ], $pdo->query('SELECT * FROM categories ORDER BY id ASC')->fetchAll());
        jsonResponse(['categories' => $rows]);
    }

    if ($method === 'POST' && $path === '/admin/categories') {
        $b = getJsonBody();
        $name = trim((string)($b['name'] ?? ''));
        $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $name), '-')) . '-' . rand(10, 99);
        $color = trim((string)($b['color'] ?? 'indigo'));
        $minCpc = max(0.01, (float)($b['minCpc'] ?? 0.05));
        $desc = trim((string)($b['description'] ?? ''));
        $pdo->prepare('INSERT INTO categories (name, slug, color, min_cpc, description, active) VALUES (?, ?, ?, ?, ?, 1)')
            ->execute([$name, $slug, $color, $minCpc, $desc]);
        logAdminAction($pdo, $admin, 'Add Category', "Created category \"$name\"");
        jsonResponse(['ok' => true], 201);
    }

    if ($method === 'PUT' && preg_match('#^/admin/categories/(\d+)$#', $path, $m)) {
        $b = getJsonBody();
        $pdo->prepare('UPDATE categories SET name = ?, color = ?, min_cpc = ?, description = ?, active = ? WHERE id = ?')
            ->execute([trim((string)$b['name']), trim((string)$b['color']), (float)$b['minCpc'], trim((string)$b['description']), !empty($b['active']) ? 1 : 0, (int)$m[1]]);
        jsonResponse(['ok' => true]);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/categories/(\d+)$#', $path, $m)) {
        $pdo->prepare('DELETE FROM categories WHERE id = ?')->execute([(int)$m[1]]);
        jsonResponse(['ok' => true]);
    }

    if ($method === 'GET' && $path === '/admin/deposits') {
        $rows = array_map(fn($d) => [
            'id' => (int)$d['id'],
            'userId' => (int)$d['user_id'],
            'userName' => $d['user_name'],
            'userEmail' => $d['user_email'],
            'gatewayId' => (int)$d['gateway_id'],
            'gatewayName' => $d['gateway_name'],
            'amount' => (float)$d['amount'],
            'trxId' => $d['trx_id'],
            'screenshotUrl' => $d['screenshot_url'],
            'status' => $d['status'],
            'adminNote' => $d['admin_note'],
            'createdAt' => $d['created_at'],
            'processedAt' => $d['processed_at'],
        ], $pdo->query('SELECT d.*, u.name AS user_name, u.email AS user_email FROM deposits d JOIN users u ON u.id = d.user_id ORDER BY d.id DESC')->fetchAll());
        jsonResponse(['deposits' => $rows]);
    }

    if ($method === 'POST' && $path === '/admin/deposits/manual') {
        $b = getJsonBody();
        $userId = (int)($b['userId'] ?? 0);
        $gatewayId = (int)($b['gatewayId'] ?? 0);
        $amount = round((float)($b['amount'] ?? 0), 2);
        $trxId = trim((string)($b['trxId'] ?? '')) ?: ('ADM-' . substr((string)time(), -6));
        $note = trim((string)($b['note'] ?? 'Manual Admin Deposit'));
        $wallet = ($b['wallet'] ?? 'deposit') === 'earning' ? 'earning' : 'deposit';

        $uStmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $uStmt->execute([$userId]);
        $user = $uStmt->fetch();
        if (!$user) {
            jsonResponse(['error' => 'Selected user not found.'], 404);
        }
        if ($amount <= 0) {
            jsonResponse(['error' => 'Enter a positive deposit amount.'], 400);
        }

        $gStmt = $pdo->prepare('SELECT * FROM gateways WHERE id = ? LIMIT 1');
        $gStmt->execute([$gatewayId]);
        $gw = $gStmt->fetch();
        $gwName = $gw ? $gw['name'] : trim((string)($b['gatewayName'] ?? 'Admin Manual Credit'));

        $pdo->beginTransaction();
        try {
            $ins = $pdo->prepare("INSERT INTO deposits (user_id, gateway_id, gateway_name, amount, trx_id, status, admin_note, processed_at) VALUES (?, ?, ?, ?, ?, 'approved', ?, NOW())");
            $ins->execute([$userId, $gw ? (int)$gw['id'] : 0, $gwName, $amount, $trxId, $note]);
            $depId = (int)$pdo->lastInsertId();

            $col = $wallet === 'earning' ? 'earning_balance' : 'deposit_balance';
            $pdo->prepare("UPDATE users SET $col = $col + ? WHERE id = ?")->execute([$amount, $userId]);
            $pdo->prepare('INSERT INTO transactions (user_id, type, wallet, amount, description) VALUES (?, ?, ?, ?, ?)')
                ->execute([$userId, 'deposit', $wallet, $amount, "Manual Deposit via $gwName ($trxId)"]);
            logAdminAction($pdo, $admin, 'Manual Deposit', "Credited \$$amount ($wallet) to {$user['name']} via $gwName");
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            jsonResponse(['error' => $e->getMessage()], 400);
        }
        jsonResponse(['ok' => true, 'depositId' => $depId], 201);
    }

    if ($method === 'POST' && preg_match('#^/admin/deposits/(\d+)/decision$#', $path, $m)) {
        $depId = (int)$m[1];
        $b = getJsonBody();
        $decision = (string)($b['decision'] ?? '');
        $note = trim((string)($b['note'] ?? ''));

        $dStmt = $pdo->prepare('SELECT * FROM deposits WHERE id = ? LIMIT 1');
        $dStmt->execute([$depId]);
        $dep = $dStmt->fetch();
        if (!$dep || $dep['status'] !== 'pending') {
            jsonResponse(['error' => 'Pending deposit not found.'], 404);
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE deposits SET status = ?, admin_note = ?, processed_at = NOW() WHERE id = ?')
                ->execute([$decision, $note, $depId]);
            if ($decision === 'approved') {
                $pdo->prepare('UPDATE users SET deposit_balance = deposit_balance + ? WHERE id = ?')
                    ->execute([(float)$dep['amount'], (int)$dep['user_id']]);
                $pdo->prepare('INSERT INTO transactions (user_id, type, wallet, amount, description) VALUES (?, ?, ?, ?, ?)')
                    ->execute([(int)$dep['user_id'], 'deposit', 'deposit', (float)$dep['amount'], "Approved Deposit via {$dep['gateway_name']} ({$dep['trx_id']})"]);
            }
            logAdminAction($pdo, $admin, 'Deposit Decision', "$decision deposit #$depId (\${$dep['amount']})");
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            jsonResponse(['error' => $e->getMessage()], 400);
        }
        jsonResponse(['ok' => true]);
    }

    if ($method === 'GET' && $path === '/admin/withdrawals') {
        $rows = array_map(fn($w) => [
            'id' => (int)$w['id'],
            'userId' => (int)$w['user_id'],
            'userName' => $w['user_name'],
            'userEmail' => $w['user_email'],
            'gatewayId' => (int)$w['gateway_id'],
            'gatewayName' => $w['gateway_name'],
            'amount' => (float)$w['amount'],
            'feeAmount' => (float)$w['fee_amount'],
            'netAmount' => (float)$w['net_amount'],
            'accountNumber' => $w['account_number'],
            'status' => $w['status'],
            'adminNote' => $w['admin_note'],
            'createdAt' => $w['created_at'],
            'processedAt' => $w['processed_at'],
        ], $pdo->query('SELECT w.*, u.name AS user_name, u.email AS user_email FROM withdrawals w JOIN users u ON u.id = w.user_id ORDER BY w.id DESC')->fetchAll());
        jsonResponse(['withdrawals' => $rows]);
    }

    if ($method === 'POST' && $path === '/admin/withdrawals/manual') {
        $b = getJsonBody();
        $userId = (int)($b['userId'] ?? 0);
        $gatewayId = (int)($b['gatewayId'] ?? 0);
        $amount = round((float)($b['amount'] ?? 0), 2);
        $accountNumber = trim((string)($b['accountNumber'] ?? ''));
        $note = trim((string)($b['note'] ?? 'Manual Admin Payout'));

        $uStmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $uStmt->execute([$userId]);
        $user = $uStmt->fetch();
        if (!$user) {
            jsonResponse(['error' => 'Selected user not found.'], 404);
        }
        if ($amount <= 0) {
            jsonResponse(['error' => 'Enter a positive withdrawal amount.'], 400);
        }
        if ((float)$user['earning_balance'] < $amount) {
            jsonResponse(['error' => 'User does not have enough Earning Balance for this payout.'], 400);
        }
        if (strlen($accountNumber) < 3) {
            jsonResponse(['error' => 'Enter a receiving account or reference.'], 400);
        }

        $gStmt = $pdo->prepare('SELECT * FROM gateways WHERE id = ? LIMIT 1');
        $gStmt->execute([$gatewayId]);
        $gw = $gStmt->fetch();
        $gwName = $gw ? $gw['name'] : 'Manual Payout';
        $feePercent = $gw ? (float)$gw['fee_percent'] : 0.0;
        $feeAmount = round($amount * ($feePercent / 100), 2);
        $netAmount = round($amount - $feeAmount, 2);

        $pdo->beginTransaction();
        try {
            $ded = $pdo->prepare('UPDATE users SET earning_balance = earning_balance - ? WHERE id = ? AND earning_balance >= ?');
            $ded->execute([$amount, $userId, $amount]);
            if ($ded->rowCount() === 0) {
                throw new RuntimeException('Insufficient Earning Balance.');
            }
            $ins = $pdo->prepare("INSERT INTO withdrawals (user_id, gateway_id, gateway_name, amount, fee_amount, net_amount, account_number, status, admin_note, processed_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW())");
            $ins->execute([$userId, $gw ? (int)$gw['id'] : 0, $gwName, $amount, $feeAmount, $netAmount, $accountNumber, $note]);
            $wdId = (int)$pdo->lastInsertId();

            $pdo->prepare('INSERT INTO transactions (user_id, type, wallet, amount, description) VALUES (?, ?, ?, ?, ?)')
                ->execute([$userId, 'withdraw', 'earning', -$amount, "Manual Payout #$wdId via $gwName ($accountNumber)"]);
            logAdminAction($pdo, $admin, 'Manual Payout', "Issued \$$amount payout to {$user['name']} via $gwName");
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            jsonResponse(['error' => $e->getMessage()], 400);
        }
        jsonResponse(['ok' => true, 'withdrawalId' => $wdId], 201);
    }

    if ($method === 'POST' && preg_match('#^/admin/withdrawals/(\d+)/decision$#', $path, $m)) {
        $wdId = (int)$m[1];
        $b = getJsonBody();
        $decision = (string)($b['decision'] ?? '');
        $note = trim((string)($b['note'] ?? ''));

        $wStmt = $pdo->prepare('SELECT * FROM withdrawals WHERE id = ? LIMIT 1');
        $wStmt->execute([$wdId]);
        $wd = $wStmt->fetch();
        if (!$wd || $wd['status'] !== 'pending') {
            jsonResponse(['error' => 'Pending withdrawal not found.'], 404);
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE withdrawals SET status = ?, admin_note = ?, processed_at = NOW() WHERE id = ?')
                ->execute([$decision, $note, $wdId]);
            if ($decision === 'rejected') {
                $pdo->prepare('UPDATE users SET earning_balance = earning_balance + ? WHERE id = ?')
                    ->execute([(float)$wd['amount'], (int)$wd['user_id']]);
                $pdo->prepare('INSERT INTO transactions (user_id, type, wallet, amount, description) VALUES (?, ?, ?, ?, ?)')
                    ->execute([(int)$wd['user_id'], 'admin_adjust', 'earning', (float)$wd['amount'], "Refunded rejected withdrawal #$wdId"]);
            }
            logAdminAction($pdo, $admin, 'Withdrawal Decision', "$decision payout #$wdId (\${$wd['amount']})");
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            jsonResponse(['error' => $e->getMessage()], 400);
        }
        jsonResponse(['ok' => true]);
    }

    if ($method === 'GET' && $path === '/admin/users') {
        $users = array_map('formatUserRow', $pdo->query('SELECT * FROM users ORDER BY id DESC')->fetchAll());
        jsonResponse(['users' => $users]);
    }

    if ($method === 'GET' && preg_match('#^/admin/users/(\d+)/activity$#', $path, $m)) {
        $uid = (int)$m[1];
        $txStmt = $pdo->prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 25');
        $txStmt->execute([$uid]);
        $transactions = array_map(fn($t) => [
            'id' => (int)$t['id'],
            'userId' => (int)$t['user_id'],
            'type' => $t['type'],
            'wallet' => $t['wallet'],
            'amount' => (float)$t['amount'],
            'description' => $t['description'],
            'createdAt' => $t['created_at'],
        ], $txStmt->fetchAll());

        $pStmt = $pdo->prepare('SELECT p.*, j.title AS job_title, u.name AS worker_name FROM job_proofs p JOIN jobs j ON j.id = p.job_id JOIN users u ON u.id = p.worker_id WHERE p.worker_id = ? ORDER BY p.id DESC LIMIT 15');
        $pStmt->execute([$uid]);
        $proofs = array_map(fn($r) => [
            'id' => (int)$r['id'],
            'jobId' => (int)$r['job_id'],
            'jobTitle' => $r['job_title'],
            'workerId' => (int)$r['worker_id'],
            'workerName' => $r['worker_name'],
            'employerId' => (int)$r['employer_id'],
            'rewardAmount' => (float)$r['reward_amount'],
            'proofText' => $r['proof_text'],
            'screenshotUrl' => $r['screenshot_url'],
            'status' => $r['status'],
            'reviewNote' => $r['review_note'],
            'createdAt' => $r['created_at'],
            'reviewedAt' => $r['reviewed_at'],
        ], $pStmt->fetchAll());

        jsonResponse(['transactions' => $transactions, 'proofs' => $proofs]);
    }

    if ($method === 'POST' && $path === '/admin/users') {
        $b = getJsonBody();
        $username = trim((string)($b['username'] ?? $b['name'] ?? ''));
        $name = trim((string)($b['name'] ?? $username)) ?: $username;
        $phone = preg_replace('/[^\d+]/', '', trim((string)($b['phone'] ?? '')));
        $rawEmail = strtolower(trim((string)($b['email'] ?? '')));
        $password = (string)($b['password'] ?? '');
        $country = trim((string)($b['country'] ?? 'Bangladesh')) ?: 'Bangladesh';
        $role = ($b['role'] ?? 'user') === 'admin' ? 'admin' : 'user';
        $kycStatus = in_array($b['kycStatus'] ?? '', ['unverified', 'pending', 'verified', 'rejected'], true) ? $b['kycStatus'] : 'unverified';
        $earningBalance = max(0.0, (float)($b['earningBalance'] ?? 0));
        $depositBalance = max(0.0, (float)($b['depositBalance'] ?? 0));

        if (strlen($username) < 2 || strlen($password) < 6 || ($phone === '' && $rawEmail === '')) {
            jsonResponse(['error' => 'Name/Username, Password (6+ chars), and Phone or Email are required.'], 400);
        }
        $email = ($rawEmail !== '' && filter_var($rawEmail, FILTER_VALIDATE_EMAIL))
            ? $rawEmail
            : preg_replace('/\+/', '', $phone) . '@miniworkers.user';

        if ($phone !== '') {
            $c1 = $pdo->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
            $c1->execute([$phone]);
            if ($c1->fetch()) jsonResponse(['error' => 'Phone number already exists.'], 409);
        }
        $c2 = $pdo->prepare('SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1');
        $c2->execute([strtolower($username)]);
        if ($c2->fetch()) jsonResponse(['error' => 'Username already taken.'], 409);

        $c3 = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $c3->execute([$email]);
        if ($c3->fetch()) jsonResponse(['error' => 'Email already exists.'], 409);

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $prefix = substr(preg_replace('/[^A-Z0-9]/', '', strtoupper($username)), 0, 4) ?: 'USER';
        $refCode = $prefix . strtoupper(bin2hex(random_bytes(2)));

        $ins = $pdo->prepare("INSERT INTO users (name, username, phone, email, password_hash, country, role, status, kyc_status, earning_balance, deposit_balance, referral_code) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)");
        $ins->execute([$name, $username, $phone !== '' ? $phone : null, $email, $hash, $country, $role, $kycStatus, $earningBalance, $depositBalance, $refCode]);
        $newId = (int)$pdo->lastInsertId();
        logAdminAction($pdo, $admin, 'Create User', "Created user $name (@$username)");

        $uStmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $uStmt->execute([$newId]);
        jsonResponse(['user' => formatUserRow($uStmt->fetch())], 201);
    }

    if ($method === 'POST' && preg_match('#^/admin/users/(\d+)/update$#', $path, $m)) {
        $uid = (int)$m[1];
        $b = getJsonBody();
        $uStmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $uStmt->execute([$uid]);
        $existing = $uStmt->fetch();
        if (!$existing) {
            jsonResponse(['error' => 'User not found.'], 404);
        }

        if (isset($b['name']) && strlen(trim((string)$b['name'])) >= 2) {
            $pdo->prepare('UPDATE users SET name = ? WHERE id = ?')->execute([trim((string)$b['name']), $uid]);
        }
        if (isset($b['username']) && strlen(trim((string)$b['username'])) >= 2) {
            $nextU = trim((string)$b['username']);
            $chk = $pdo->prepare('SELECT id FROM users WHERE LOWER(username) = ? AND id <> ? LIMIT 1');
            $chk->execute([strtolower($nextU), $uid]);
            if ($chk->fetch()) jsonResponse(['error' => 'Username already taken.'], 409);
            $pdo->prepare('UPDATE users SET username = ? WHERE id = ?')->execute([$nextU, $uid]);
        }
        if (array_key_exists('phone', $b)) {
            $nextP = preg_replace('/[^\d+]/', '', trim((string)$b['phone']));
            if ($nextP !== '') {
                $chk = $pdo->prepare('SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1');
                $chk->execute([$nextP, $uid]);
                if ($chk->fetch()) jsonResponse(['error' => 'Phone number already exists.'], 409);
            }
            $pdo->prepare('UPDATE users SET phone = ? WHERE id = ?')->execute([$nextP !== '' ? $nextP : null, $uid]);
        }
        if (isset($b['email']) && filter_var(trim((string)$b['email']), FILTER_VALIDATE_EMAIL)) {
            $nextE = strtolower(trim((string)$b['email']));
            $chk = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1');
            $chk->execute([$nextE, $uid]);
            if ($chk->fetch()) jsonResponse(['error' => 'Email already exists.'], 409);
            $pdo->prepare('UPDATE users SET email = ? WHERE id = ?')->execute([$nextE, $uid]);
        }
        if (isset($b['country']) && trim((string)$b['country']) !== '') {
            $pdo->prepare('UPDATE users SET country = ? WHERE id = ?')->execute([trim((string)$b['country']), $uid]);
        }
        if (isset($b['role']) && in_array($b['role'], ['user', 'admin'], true) && $uid !== (int)$admin['id']) {
            $pdo->prepare('UPDATE users SET role = ? WHERE id = ?')->execute([$b['role'], $uid]);
        }
        if (isset($b['status']) && in_array($b['status'], ['active', 'banned'], true)) {
            $pdo->prepare('UPDATE users SET status = ? WHERE id = ? AND id != ?')->execute([$b['status'], $uid, (int)$admin['id']]);
        }
        if (isset($b['kycStatus']) && in_array($b['kycStatus'], ['unverified', 'pending', 'verified', 'rejected'], true)) {
            $pdo->prepare('UPDATE users SET kyc_status = ? WHERE id = ?')->execute([$b['kycStatus'], $uid]);
        }
        if (isset($b['newPassword']) && strlen((string)$b['newPassword']) >= 6) {
            $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash((string)$b['newPassword'], PASSWORD_BCRYPT), $uid]);
        }
        if (isset($b['adjustAmount']) && is_numeric($b['adjustAmount']) && (float)$b['adjustAmount'] !== 0.0) {
            $amt = (float)$b['adjustAmount'];
            $wallet = ($b['adjustWallet'] ?? 'deposit') === 'earning' ? 'earning' : 'deposit';
            $col = $wallet === 'earning' ? 'earning_balance' : 'deposit_balance';
            $pdo->prepare("UPDATE users SET $col = GREATEST(0, $col + ?) WHERE id = ?")->execute([$amt, $uid]);
            $pdo->prepare('INSERT INTO transactions (user_id, type, wallet, amount, description) VALUES (?, ?, ?, ?, ?)')
                ->execute([$uid, 'admin_adjust', $wallet, $amt, trim((string)($b['adjustNote'] ?? 'Admin balance adjustment'))]);
        }
        logAdminAction($pdo, $admin, 'Update User', "Updated account #$uid ({$existing['name']})");
        jsonResponse(['ok' => true]);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/users/(\d+)$#', $path, $m)) {
        $uid = (int)$m[1];
        if ($uid === (int)$admin['id']) {
            jsonResponse(['error' => 'You cannot delete your own active Admin account.'], 400);
        }
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]);
        logAdminAction($pdo, $admin, 'Delete User', "Removed account #$uid");
        jsonResponse(['ok' => true]);
    }

    if ($method === 'GET' && $path === '/admin/gateways') {
        $rows = array_map(fn($g) => [
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
        ], $pdo->query('SELECT * FROM gateways ORDER BY id ASC')->fetchAll());
        jsonResponse(['gateways' => $rows]);
    }

    if ($method === 'POST' && $path === '/admin/gateways') {
        $b = getJsonBody();
        $pdo->prepare('INSERT INTO gateways (name, code, type, account_details, instructions, min_amount, max_amount, fee_percent, color, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
            ->execute([$b['name'], strtolower(preg_replace('/[^a-z0-9]/i', '', $b['name'])), $b['type'], $b['accountDetails'], $b['instructions'], (float)$b['minAmount'], (float)$b['maxAmount'], (float)$b['feePercent'], $b['color'] ?? 'indigo']);
        logAdminAction($pdo, $admin, 'Add Gateway', "Added gateway \"{$b['name']}\"");
        jsonResponse(['ok' => true], 201);
    }

    if ($method === 'PUT' && preg_match('#^/admin/gateways/(\d+)$#', $path, $m)) {
        $b = getJsonBody();
        $pdo->prepare('UPDATE gateways SET name = ?, type = ?, account_details = ?, instructions = ?, min_amount = ?, max_amount = ?, fee_percent = ?, color = ?, active = ? WHERE id = ?')
            ->execute([$b['name'], $b['type'], $b['accountDetails'], $b['instructions'], (float)$b['minAmount'], (float)$b['maxAmount'], (float)$b['feePercent'], $b['color'] ?? 'indigo', !empty($b['active']) ? 1 : 0, (int)$m[1]]);
        logAdminAction($pdo, $admin, 'Update Gateway', "Updated gateway \"{$b['name']}\"");
        jsonResponse(['ok' => true]);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/gateways/(\d+)$#', $path, $m)) {
        $pdo->prepare('DELETE FROM gateways WHERE id = ?')->execute([(int)$m[1]]);
        logAdminAction($pdo, $admin, 'Delete Gateway', "Deleted gateway #{$m[1]}");
        jsonResponse(['ok' => true]);
    }

    if ($method === 'GET' && $path === '/admin/tickets') {
        $rows = $pdo->query('SELECT t.*, u.name AS user_name, u.email AS user_email FROM tickets t JOIN users u ON u.id = t.user_id ORDER BY t.id DESC')->fetchAll();
        $tickets = [];
        foreach ($rows as $t) {
            $rStmt = $pdo->prepare('SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY id ASC');
            $rStmt->execute([(int)$t['id']]);
            $replies = array_map(fn($r) => [
                'id' => (int)$r['id'],
                'ticketId' => (int)$r['ticket_id'],
                'senderId' => (int)$r['sender_id'],
                'senderName' => $r['sender_name'],
                'senderRole' => $r['sender_role'],
                'message' => $r['message'],
                'createdAt' => $r['created_at'],
            ], $rStmt->fetchAll());
            $tickets[] = [
                'id' => (int)$t['id'],
                'userId' => (int)$t['user_id'],
                'userName' => $t['user_name'],
                'userEmail' => $t['user_email'],
                'subject' => $t['subject'],
                'category' => $t['category'],
                'priority' => $t['priority'],
                'status' => $t['status'],
                'createdAt' => $t['created_at'],
                'updatedAt' => $t['updated_at'],
                'replies' => $replies,
            ];
        }
        jsonResponse(['tickets' => $tickets]);
    }

    if ($method === 'POST' && preg_match('#^/admin/tickets/(\d+)/status$#', $path, $m)) {
        $b = getJsonBody();
        $status = (string)($b['status'] ?? 'resolved');
        if (!in_array($status, ['open', 'answered', 'resolved', 'closed'], true)) {
            jsonResponse(['error' => 'Invalid status.'], 400);
        }
        $pdo->prepare('UPDATE tickets SET status = ? WHERE id = ?')->execute([$status, (int)$m[1]]);
        jsonResponse(['ok' => true]);
    }

    // Blog CMS Routes
    if ($method === 'GET' && $path === '/admin/blog') {
        $posts = array_map('formatBlogPostRow', $pdo->query('SELECT * FROM blog_posts ORDER BY id DESC')->fetchAll());
        jsonResponse(['posts' => $posts]);
    }

    if ($method === 'POST' && $path === '/admin/blog') {
        $b = getJsonBody();
        $title = trim((string)($b['title'] ?? ''));
        $content = trim((string)($b['content'] ?? ''));
        if (strlen($title) < 3 || strlen($content) < 10) {
            jsonResponse(['error' => 'Blog title and content are required.'], 400);
        }
        $slugBase = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $title), '-')) ?: 'post';
        $slug = $slugBase . '-' . rand(100, 999);
        $category = trim((string)($b['category'] ?? 'Updates')) ?: 'Updates';
        $excerpt = trim((string)($b['excerpt'] ?? substr($content, 0, 140)));
        $cover = sanitizeUrlSafe((string)($b['coverImageUrl'] ?? '')) ?: '/assets/images/category_social.jpg';
        $author = trim((string)($b['authorName'] ?? $admin['name']));
        $featured = !empty($b['featured']) ? 1 : 0;
        $published = array_key_exists('published', $b) ? (!empty($b['published']) ? 1 : 0) : 1;

        $pdo->prepare('INSERT INTO blog_posts (title, slug, category, excerpt, content, cover_image_url, author_name, featured, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$title, $slug, $category, $excerpt, $content, $cover, $author, $featured, $published]);
        $pid = (int)$pdo->lastInsertId();
        logAdminAction($pdo, $admin, 'Create Blog Post', "Published/saved article \"$title\"");

        $pStmt = $pdo->prepare('SELECT * FROM blog_posts WHERE id = ?');
        $pStmt->execute([$pid]);
        jsonResponse(['post' => formatBlogPostRow($pStmt->fetch())], 201);
    }

    if ($method === 'PUT' && preg_match('#^/admin/blog/(\d+)$#', $path, $m)) {
        $pid = (int)$m[1];
        $pStmt = $pdo->prepare('SELECT * FROM blog_posts WHERE id = ? LIMIT 1');
        $pStmt->execute([$pid]);
        $existing = $pStmt->fetch();
        if (!$existing) {
            jsonResponse(['error' => 'Blog post not found.'], 404);
        }
        $b = getJsonBody();
        $title = trim((string)($b['title'] ?? $existing['title']));
        $category = trim((string)($b['category'] ?? $existing['category']));
        $excerpt = trim((string)($b['excerpt'] ?? $existing['excerpt']));
        $content = trim((string)($b['content'] ?? $existing['content']));
        $cover = array_key_exists('coverImageUrl', $b) ? (sanitizeUrlSafe((string)$b['coverImageUrl']) ?: $existing['cover_image_url']) : $existing['cover_image_url'];
        $author = trim((string)($b['authorName'] ?? $existing['author_name']));
        $featured = array_key_exists('featured', $b) ? (!empty($b['featured']) ? 1 : 0) : (int)$existing['featured'];
        $published = array_key_exists('published', $b) ? (!empty($b['published']) ? 1 : 0) : (int)$existing['published'];

        $pdo->prepare('UPDATE blog_posts SET title = ?, category = ?, excerpt = ?, content = ?, cover_image_url = ?, author_name = ?, featured = ?, published = ? WHERE id = ?')
            ->execute([$title, $category, $excerpt, $content, $cover, $author, $featured, $published, $pid]);
        logAdminAction($pdo, $admin, 'Update Blog Post', "Updated article \"$title\"");

        $outStmt = $pdo->prepare('SELECT * FROM blog_posts WHERE id = ?');
        $outStmt->execute([$pid]);
        jsonResponse(['post' => formatBlogPostRow($outStmt->fetch())]);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/blog/(\d+)$#', $path, $m)) {
        $pdo->prepare('DELETE FROM blog_posts WHERE id = ?')->execute([(int)$m[1]]);
        logAdminAction($pdo, $admin, 'Delete Blog Post', "Deleted article #{$m[1]}");
        jsonResponse(['ok' => true]);
    }

    // Custom Pages CMS Routes
    if ($method === 'GET' && $path === '/admin/pages') {
        $pages = array_map('formatPageRow', $pdo->query('SELECT * FROM pages ORDER BY id ASC')->fetchAll());
        jsonResponse(['pages' => $pages]);
    }

    if ($method === 'POST' && $path === '/admin/pages') {
        $b = getJsonBody();
        $title = trim((string)($b['title'] ?? ''));
        $content = trim((string)($b['content'] ?? ''));
        if (strlen($title) < 2 || strlen($content) < 5) {
            jsonResponse(['error' => 'Page title and content are required.'], 400);
        }
        $rawSlug = trim((string)($b['slug'] ?? $title));
        $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9-]+/', '-', $rawSlug), '-')) ?: ('page-' . time());
        $chk = $pdo->prepare('SELECT id FROM pages WHERE slug = ? LIMIT 1');
        $chk->execute([$slug]);
        if ($chk->fetch()) {
            jsonResponse(['error' => 'A page with this URL slug already exists.'], 409);
        }
        $summary = trim((string)($b['summary'] ?? ''));
        $inHeader = !empty($b['showInHeader']) ? 1 : 0;
        $inFooter = array_key_exists('showInFooter', $b) ? (!empty($b['showInFooter']) ? 1 : 0) : 1;
        $published = array_key_exists('published', $b) ? (!empty($b['published']) ? 1 : 0) : 1;

        $pdo->prepare('INSERT INTO pages (title, slug, summary, content, show_in_header, show_in_footer, published) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$title, $slug, $summary, $content, $inHeader, $inFooter, $published]);
        $pgId = (int)$pdo->lastInsertId();
        logAdminAction($pdo, $admin, 'Create CMS Page', "Created page /$slug");

        $outStmt = $pdo->prepare('SELECT * FROM pages WHERE id = ?');
        $outStmt->execute([$pgId]);
        jsonResponse(['page' => formatPageRow($outStmt->fetch())], 201);
    }

    if ($method === 'PUT' && preg_match('#^/admin/pages/(\d+)$#', $path, $m)) {
        $pgId = (int)$m[1];
        $pStmt = $pdo->prepare('SELECT * FROM pages WHERE id = ? LIMIT 1');
        $pStmt->execute([$pgId]);
        $existing = $pStmt->fetch();
        if (!$existing) {
            jsonResponse(['error' => 'Page not found.'], 404);
        }
        $b = getJsonBody();
        $title = trim((string)($b['title'] ?? $existing['title']));
        $slug = $existing['slug'];
        if (!empty($b['slug'])) {
            $nextSlug = strtolower(trim(preg_replace('/[^a-zA-Z0-9-]+/', '-', (string)$b['slug']), '-'));
            if ($nextSlug !== '') {
                $chk = $pdo->prepare('SELECT id FROM pages WHERE slug = ? AND id <> ? LIMIT 1');
                $chk->execute([$nextSlug, $pgId]);
                if (!$chk->fetch()) {
                    $slug = $nextSlug;
                }
            }
        }
        $summary = trim((string)($b['summary'] ?? $existing['summary']));
        $content = trim((string)($b['content'] ?? $existing['content']));
        $inHeader = array_key_exists('showInHeader', $b) ? (!empty($b['showInHeader']) ? 1 : 0) : (int)$existing['show_in_header'];
        $inFooter = array_key_exists('showInFooter', $b) ? (!empty($b['showInFooter']) ? 1 : 0) : (int)$existing['show_in_footer'];
        $published = array_key_exists('published', $b) ? (!empty($b['published']) ? 1 : 0) : (int)$existing['published'];

        $pdo->prepare('UPDATE pages SET title = ?, slug = ?, summary = ?, content = ?, show_in_header = ?, show_in_footer = ?, published = ? WHERE id = ?')
            ->execute([$title, $slug, $summary, $content, $inHeader, $inFooter, $published, $pgId]);
        logAdminAction($pdo, $admin, 'Update CMS Page', "Updated page \"$title\"");

        $outStmt = $pdo->prepare('SELECT * FROM pages WHERE id = ?');
        $outStmt->execute([$pgId]);
        jsonResponse(['page' => formatPageRow($outStmt->fetch())]);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/pages/(\d+)$#', $path, $m)) {
        $pdo->prepare('DELETE FROM pages WHERE id = ?')->execute([(int)$m[1]]);
        logAdminAction($pdo, $admin, 'Delete CMS Page', "Deleted page #{$m[1]}");
        jsonResponse(['ok' => true]);
    }

    if ($method === 'GET' && $path === '/admin/settings') {
        jsonResponse(['settings' => getSettingsRow($pdo)]);
    }

    if ($method === 'PUT' && $path === '/admin/settings') {
        $b = getJsonBody();
        $cur = getSettingsRow($pdo);
        $validThemes = ['teal', 'indigo', 'violet', 'emerald', 'rose', 'amber', 'sky'];
        $accentTheme = in_array($b['accentTheme'] ?? '', $validThemes, true) ? $b['accentTheme'] : $cur['accentTheme'];

        $pdo->prepare('UPDATE settings SET site_name = ?, tagline = ?, logo_url = ?, accent_theme = ?, currency_symbol = ?, platform_fee_percent = ?, referral_commission_percent = ?, min_job_workers = ?, min_withdraw_amount = ?, auto_approve_jobs = ?, allow_registration = ?, maintenance_mode = ?, maintenance_message = ?, notice_banner = ?, support_email = ?, hero_kicker = ?, hero_title = ?, hero_subtitle = ?, hero_primary_cta = ?, hero_secondary_cta = ?, hero_image_url = ?, show_stats_strip = ?, show_how_it_works = ?, show_blog_section = ?, founder_name = ?, founder_role = ?, founder_quote = ?, footer_text = ? WHERE id = 1')
            ->execute([
                trim((string)($b['siteName'] ?? $cur['siteName'])),
                trim((string)($b['tagline'] ?? $cur['tagline'])),
                array_key_exists('logoUrl', $b) ? sanitizeUrlSafe((string)$b['logoUrl']) : $cur['logoUrl'],
                $accentTheme,
                trim((string)($b['currencySymbol'] ?? $cur['currencySymbol'])),
                max(0.0, (float)($b['platformFeePercent'] ?? $cur['platformFeePercent'])),
                max(0.0, (float)($b['referralCommissionPercent'] ?? $cur['referralCommissionPercent'])),
                max(1, (int)($b['minJobWorkers'] ?? $cur['minJobWorkers'])),
                max(0.5, (float)($b['minWithdrawAmount'] ?? $cur['minWithdrawAmount'])),
                !empty($b['autoApproveJobs']) ? 1 : 0,
                array_key_exists('allowRegistration', $b) ? (!empty($b['allowRegistration']) ? 1 : 0) : ($cur['allowRegistration'] ? 1 : 0),
                array_key_exists('maintenanceMode', $b) ? (!empty($b['maintenanceMode']) ? 1 : 0) : ($cur['maintenanceMode'] ? 1 : 0),
                trim((string)($b['maintenanceMessage'] ?? $cur['maintenanceMessage'])),
                trim((string)($b['noticeBanner'] ?? $cur['noticeBanner'])),
                trim((string)($b['supportEmail'] ?? $cur['supportEmail'])),
                trim((string)($b['heroKicker'] ?? $cur['heroKicker'])),
                trim((string)($b['heroTitle'] ?? $cur['heroTitle'])),
                trim((string)($b['heroSubtitle'] ?? $cur['heroSubtitle'])),
                trim((string)($b['heroPrimaryCta'] ?? $cur['heroPrimaryCta'])),
                trim((string)($b['heroSecondaryCta'] ?? $cur['heroSecondaryCta'])),
                array_key_exists('heroImageUrl', $b) ? (sanitizeUrlSafe((string)$b['heroImageUrl']) ?: $cur['heroImageUrl']) : $cur['heroImageUrl'],
                array_key_exists('showStatsStrip', $b) ? (!empty($b['showStatsStrip']) ? 1 : 0) : ($cur['showStatsStrip'] ? 1 : 0),
                array_key_exists('showHowItWorks', $b) ? (!empty($b['showHowItWorks']) ? 1 : 0) : ($cur['showHowItWorks'] ? 1 : 0),
                array_key_exists('showBlogSection', $b) ? (!empty($b['showBlogSection']) ? 1 : 0) : ($cur['showBlogSection'] ? 1 : 0),
                trim((string)($b['founderName'] ?? $cur['founderName'])),
                trim((string)($b['founderRole'] ?? $cur['founderRole'])),
                trim((string)($b['founderQuote'] ?? $cur['founderQuote'])),
                trim((string)($b['footerText'] ?? $cur['footerText'])),
            ]);
        logAdminAction($pdo, $admin, 'Update Website Settings', 'Saved platform & CMS settings');
        jsonResponse(['settings' => getSettingsRow($pdo)]);
    }

    return false;
}

<?php
declare(strict_types=1);

function handleAdminRoutes(PDO $pdo, string $method, string $path): bool {
    if (!str_starts_with($path, '/admin')) {
        return false;
    }

    $admin = requireAdmin($pdo);

    if ($method === 'GET' && $path === '/admin/overview') {
        $totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'user'")->fetchColumn();
        $pendingJobs = (int)$pdo->query("SELECT COUNT(*) FROM jobs WHERE status = 'pending'")->fetchColumn();
        $pendingDeposits = (int)$pdo->query("SELECT COUNT(*) FROM deposits WHERE status = 'pending'")->fetchColumn();
        $pendingDepositsAmount = (float)$pdo->query("SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status = 'pending'")->fetchColumn();
        $pendingWithdrawals = (int)$pdo->query("SELECT COUNT(*) FROM withdrawals WHERE status = 'pending'")->fetchColumn();
        $pendingWithdrawalsAmount = (float)$pdo->query("SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'pending'")->fetchColumn();
        $openTickets = (int)$pdo->query("SELECT COUNT(*) FROM tickets WHERE status IN ('open', 'answered')")->fetchColumn();
        $platformRevenue = (float)$pdo->query("SELECT COALESCE(SUM(platform_fee), 0) FROM jobs WHERE status IN ('active', 'completed', 'paused')")->fetchColumn();

        jsonResponse([
            'totalUsers' => $totalUsers,
            'pendingJobs' => $pendingJobs,
            'pendingDeposits' => $pendingDeposits,
            'pendingDepositsAmount' => round($pendingDepositsAmount, 2),
            'pendingWithdrawals' => $pendingWithdrawals,
            'pendingWithdrawalsAmount' => round($pendingWithdrawalsAmount, 2),
            'openTickets' => $openTickets,
            'platformRevenue' => round($platformRevenue, 2),
        ]);
    }

    if ($method === 'GET' && $path === '/admin/jobs') {
        $sql = "SELECT j.*, u.name AS employer_name, c.name AS category_name, c.color AS category_color
                FROM jobs j JOIN users u ON u.id = j.employer_id JOIN categories c ON c.id = j.category_id
                ORDER BY FIELD(j.status, 'pending', 'active', 'paused', 'completed', 'rejected'), j.id DESC";
        jsonResponse(['jobs' => array_map('formatJobRow', $pdo->query($sql)->fetchAll())]);
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

    if ($method === 'POST' && preg_match('#^/admin/users/(\d+)/update$#', $path, $m)) {
        $uid = (int)$m[1];
        $b = getJsonBody();
        if (isset($b['status']) && in_array($b['status'], ['active', 'banned'], true)) {
            $pdo->prepare('UPDATE users SET status = ? WHERE id = ? AND id != ?')->execute([$b['status'], $uid, (int)$admin['id']]);
        }
        if (isset($b['kycStatus']) && in_array($b['kycStatus'], ['unverified', 'pending', 'verified', 'rejected'], true)) {
            $pdo->prepare('UPDATE users SET kyc_status = ? WHERE id = ?')->execute([$b['kycStatus'], $uid]);
        }
        if (isset($b['adjustAmount']) && is_numeric($b['adjustAmount']) && (float)$b['adjustAmount'] !== 0.0) {
            $amt = (float)$b['adjustAmount'];
            $wallet = ($b['adjustWallet'] ?? 'deposit') === 'earning' ? 'earning' : 'deposit';
            $col = $wallet === 'earning' ? 'earning_balance' : 'deposit_balance';
            $pdo->prepare("UPDATE users SET $col = GREATEST(0, $col + ?) WHERE id = ?")->execute([$amt, $uid]);
            $pdo->prepare('INSERT INTO transactions (user_id, type, wallet, amount, description) VALUES (?, ?, ?, ?, ?)')
                ->execute([$uid, 'admin_adjust', $wallet, $amt, trim((string)($b['adjustNote'] ?? 'Admin balance adjustment'))]);
        }
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
        jsonResponse(['ok' => true], 201);
    }

    if ($method === 'PUT' && preg_match('#^/admin/gateways/(\d+)$#', $path, $m)) {
        $b = getJsonBody();
        $pdo->prepare('UPDATE gateways SET name = ?, type = ?, account_details = ?, instructions = ?, min_amount = ?, max_amount = ?, fee_percent = ?, color = ?, active = ? WHERE id = ?')
            ->execute([$b['name'], $b['type'], $b['accountDetails'], $b['instructions'], (float)$b['minAmount'], (float)$b['maxAmount'], (float)$b['feePercent'], $b['color'] ?? 'indigo', !empty($b['active']) ? 1 : 0, (int)$m[1]]);
        jsonResponse(['ok' => true]);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/gateways/(\d+)$#', $path, $m)) {
        $pdo->prepare('DELETE FROM gateways WHERE id = ?')->execute([(int)$m[1]]);
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

    if ($method === 'GET' && $path === '/admin/settings') {
        jsonResponse(['settings' => getSettingsRow($pdo)]);
    }

    if ($method === 'PUT' && $path === '/admin/settings') {
        $b = getJsonBody();
        $pdo->prepare('UPDATE settings SET site_name = ?, currency_symbol = ?, platform_fee_percent = ?, referral_commission_percent = ?, min_job_workers = ?, auto_approve_jobs = ?, notice_banner = ?, support_email = ? WHERE id = 1')
            ->execute([
                trim((string)$b['siteName']),
                trim((string)$b['currencySymbol']),
                (float)$b['platformFeePercent'],
                (float)$b['referralCommissionPercent'],
                max(1, (int)$b['minJobWorkers']),
                !empty($b['autoApproveJobs']) ? 1 : 0,
                trim((string)$b['noticeBanner']),
                trim((string)$b['supportEmail']),
            ]);
        jsonResponse(['settings' => getSettingsRow($pdo)]);
    }

    return false;
}

<?php
declare(strict_types=1);

function handleWalletRoutes(PDO $pdo, string $method, string $path): bool {
    if ($method === 'GET' && $path === '/wallet/overview') {
        $user = requireAuth($pdo);
        $uid = (int)$user['id'];

        $depStmt = $pdo->prepare('SELECT * FROM deposits WHERE user_id = ? ORDER BY id DESC');
        $depStmt->execute([$uid]);
        $deposits = array_map(fn($d) => [
            'id' => (int)$d['id'],
            'userId' => (int)$d['user_id'],
            'userName' => $user['name'],
            'userEmail' => $user['email'],
            'gatewayId' => (int)$d['gateway_id'],
            'gatewayName' => $d['gateway_name'],
            'amount' => (float)$d['amount'],
            'trxId' => $d['trx_id'],
            'screenshotUrl' => $d['screenshot_url'],
            'status' => $d['status'],
            'adminNote' => $d['admin_note'],
            'createdAt' => $d['created_at'],
            'processedAt' => $d['processed_at'],
        ], $depStmt->fetchAll());

        $wdStmt = $pdo->prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY id DESC');
        $wdStmt->execute([$uid]);
        $withdrawals = array_map(fn($w) => [
            'id' => (int)$w['id'],
            'userId' => (int)$w['user_id'],
            'userName' => $user['name'],
            'userEmail' => $user['email'],
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
        ], $wdStmt->fetchAll());

        $txStmt = $pdo->prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 100');
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

        jsonResponse([
            'deposits' => $deposits,
            'withdrawals' => $withdrawals,
            'transactions' => $transactions,
        ]);
    }

    if ($method === 'POST' && $path === '/wallet/deposit') {
        $user = requireAuth($pdo);
        $body = getJsonBody();
        $gatewayId = (int)($body['gatewayId'] ?? 0);
        $amount = round((float)($body['amount'] ?? 0), 2);
        $trxId = trim((string)($body['trxId'] ?? ''));
        $screenshotData = (string)($body['screenshotData'] ?? '');

        $gStmt = $pdo->prepare('SELECT * FROM gateways WHERE id = ? AND active = 1 LIMIT 1');
        $gStmt->execute([$gatewayId]);
        $gw = $gStmt->fetch();
        if (!$gw || $gw['type'] === 'withdraw') {
            jsonResponse(['error' => 'Invalid deposit gateway.'], 400);
        }
        if ($amount < (float)$gw['min_amount'] || $amount > (float)$gw['max_amount']) {
            jsonResponse(['error' => "Amount must be between {$gw['min_amount']} and {$gw['max_amount']}."], 400);
        }
        if (strlen($trxId) < 4) {
            jsonResponse(['error' => 'Valid Transaction ID is required.'], 400);
        }

        $screenshotUrl = $screenshotData !== '' ? saveBase64Upload($screenshotData) : null;
        $ins = $pdo->prepare('INSERT INTO deposits (user_id, gateway_id, gateway_name, amount, trx_id, screenshot_url) VALUES (?, ?, ?, ?, ?, ?)');
        $ins->execute([(int)$user['id'], $gatewayId, $gw['name'], $amount, $trxId, $screenshotUrl]);

        jsonResponse(['ok' => true, 'depositId' => (int)$pdo->lastInsertId()], 201);
    }

    if ($method === 'POST' && $path === '/wallet/withdraw') {
        $user = requireAuth($pdo);
        $body = getJsonBody();
        $gatewayId = (int)($body['gatewayId'] ?? 0);
        $amount = round((float)($body['amount'] ?? 0), 2);
        $accountNumber = trim((string)($body['accountNumber'] ?? ''));

        $gStmt = $pdo->prepare('SELECT * FROM gateways WHERE id = ? AND active = 1 LIMIT 1');
        $gStmt->execute([$gatewayId]);
        $gw = $gStmt->fetch();
        if (!$gw || $gw['type'] === 'deposit') {
            jsonResponse(['error' => 'Invalid withdrawal gateway.'], 400);
        }
        if ($amount < (float)$gw['min_amount'] || $amount > (float)$gw['max_amount']) {
            jsonResponse(['error' => "Amount must be between {$gw['min_amount']} and {$gw['max_amount']}."], 400);
        }
        if (strlen($accountNumber) < 5) {
            jsonResponse(['error' => 'Valid payout account/wallet is required.'], 400);
        }
        if ((float)$user['earning_balance'] < $amount) {
            jsonResponse(['error' => 'Insufficient Earning Balance.'], 400);
        }

        $fee = round($amount * ((float)$gw['fee_percent'] / 100), 2);
        $net = round($amount - $fee, 2);

        $pdo->beginTransaction();
        try {
            $ded = $pdo->prepare('UPDATE users SET earning_balance = earning_balance - ? WHERE id = ? AND earning_balance >= ?');
            $ded->execute([$amount, (int)$user['id'], $amount]);
            if ($ded->rowCount() === 0) {
                throw new RuntimeException('Insufficient Earning Balance.');
            }
            $ins = $pdo->prepare('INSERT INTO withdrawals (user_id, gateway_id, gateway_name, amount, fee_amount, net_amount, account_number) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $ins->execute([(int)$user['id'], $gatewayId, $gw['name'], $amount, $fee, $net, $accountNumber]);
            $wdId = (int)$pdo->lastInsertId();

            $pdo->prepare('INSERT INTO transactions (user_id, type, wallet, amount, description) VALUES (?, ?, ?, ?, ?)')
                ->execute([(int)$user['id'], 'withdraw', 'earning', -$amount, "Withdrawal #$wdId via {$gw['name']}"]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            jsonResponse(['error' => $e->getMessage()], 400);
        }

        $uStmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $uStmt->execute([(int)$user['id']]);
        jsonResponse(['ok' => true, 'user' => formatUserRow($uStmt->fetch())], 201);
    }

    if ($method === 'POST' && $path === '/wallet/transfer') {
        $user = requireAuth($pdo);
        $body = getJsonBody();
        $amount = round((float)($body['amount'] ?? 0), 2);
        if ($amount < 0.5) {
            jsonResponse(['error' => 'Minimum transfer amount is $0.50.'], 400);
        }

        $pdo->beginTransaction();
        try {
            $ded = $pdo->prepare('UPDATE users SET earning_balance = earning_balance - ?, deposit_balance = deposit_balance + ? WHERE id = ? AND earning_balance >= ?');
            $ded->execute([$amount, $amount, (int)$user['id'], $amount]);
            if ($ded->rowCount() === 0) {
                throw new RuntimeException('Insufficient Earning Balance.');
            }
            $pdo->prepare('INSERT INTO transactions (user_id, type, wallet, amount, description) VALUES (?, ?, ?, ?, ?)')
                ->execute([(int)$user['id'], 'transfer', 'deposit', $amount, 'Transferred Earning Balance to Deposit Balance']);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            jsonResponse(['error' => $e->getMessage()], 400);
        }

        $uStmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $uStmt->execute([(int)$user['id']]);
        jsonResponse(['user' => formatUserRow($uStmt->fetch())]);
    }

    if ($method === 'GET' && $path === '/referrals') {
        $user = requireAuth($pdo);
        $stmt = $pdo->prepare('SELECT id, name, country, tasks_completed, created_at FROM users WHERE referred_by = ? ORDER BY id DESC');
        $stmt->execute([(int)$user['id']]);
        $referred = array_map(fn($r) => [
            'id' => (int)$r['id'],
            'name' => $r['name'],
            'country' => $r['country'],
            'tasksCompleted' => (int)$r['tasks_completed'],
            'createdAt' => $r['created_at'],
        ], $stmt->fetchAll());
        jsonResponse(['referredUsers' => $referred]);
    }

    if ($method === 'POST' && $path === '/kyc') {
        $user = requireAuth($pdo);
        $body = getJsonBody();
        $docData = (string)($body['documentData'] ?? '');
        $note = trim((string)($body['note'] ?? ''));
        if ($docData === '') {
            jsonResponse(['error' => 'ID document image is required.'], 400);
        }
        $url = saveBase64Upload($docData);
        $pdo->prepare("UPDATE users SET kyc_status = 'pending', kyc_document_url = ?, kyc_note = ? WHERE id = ?")
            ->execute([$url, $note, (int)$user['id']]);
        $uStmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $uStmt->execute([(int)$user['id']]);
        jsonResponse(['user' => formatUserRow($uStmt->fetch())]);
    }

    if ($method === 'GET' && $path === '/tickets') {
        $user = requireAuth($pdo);
        $stmt = $pdo->prepare('SELECT t.*, u.name AS user_name, u.email AS user_email FROM tickets t JOIN users u ON u.id = t.user_id WHERE t.user_id = ? ORDER BY t.id DESC');
        $stmt->execute([(int)$user['id']]);
        $tickets = [];
        foreach ($stmt->fetchAll() as $t) {
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

    if ($method === 'POST' && $path === '/tickets') {
        $user = requireAuth($pdo);
        $body = getJsonBody();
        $subject = trim((string)($body['subject'] ?? ''));
        $category = trim((string)($body['category'] ?? 'General'));
        $priority = in_array($body['priority'] ?? '', ['low', 'medium', 'high'], true) ? $body['priority'] : 'medium';
        $message = trim((string)($body['message'] ?? ''));
        if (strlen($subject) < 3 || strlen($message) < 5) {
            jsonResponse(['error' => 'Subject and message are required.'], 400);
        }
        $pdo->beginTransaction();
        try {
            $pdo->prepare('INSERT INTO tickets (user_id, subject, category, priority) VALUES (?, ?, ?, ?)')
                ->execute([(int)$user['id'], $subject, $category, $priority]);
            $tid = (int)$pdo->lastInsertId();
            $pdo->prepare('INSERT INTO ticket_replies (ticket_id, sender_id, sender_name, sender_role, message) VALUES (?, ?, ?, ?, ?)')
                ->execute([$tid, (int)$user['id'], $user['name'], $user['role'], $message]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            jsonResponse(['error' => $e->getMessage()], 400);
        }
        jsonResponse(['ok' => true, 'ticketId' => $tid], 201);
    }

    if ($method === 'POST' && preg_match('#^/tickets/(\d+)/reply$#', $path, $m)) {
        $user = requireAuth($pdo);
        $tid = (int)$m[1];
        $body = getJsonBody();
        $message = trim((string)($body['message'] ?? ''));
        if ($message === '') {
            jsonResponse(['error' => 'Message cannot be empty.'], 400);
        }
        $tStmt = $pdo->prepare('SELECT * FROM tickets WHERE id = ? LIMIT 1');
        $tStmt->execute([$tid]);
        $ticket = $tStmt->fetch();
        if (!$ticket || ((int)$ticket['user_id'] !== (int)$user['id'] && $user['role'] !== 'admin')) {
            jsonResponse(['error' => 'Ticket not found.'], 404);
        }
        $pdo->prepare('INSERT INTO ticket_replies (ticket_id, sender_id, sender_name, sender_role, message) VALUES (?, ?, ?, ?, ?)')
            ->execute([$tid, (int)$user['id'], $user['name'], $user['role'], $message]);
        $nextStatus = $user['role'] === 'admin' ? 'answered' : 'open';
        $pdo->prepare('UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?')->execute([$nextStatus, $tid]);
        jsonResponse(['ok' => true]);
    }

    return false;
}

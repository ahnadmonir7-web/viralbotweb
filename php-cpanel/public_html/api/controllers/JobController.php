<?php
declare(strict_types=1);

function handleJobRoutes(PDO $pdo, string $method, string $path): bool {
    if ($method === 'GET' && $path === '/jobs') {
        $sql = "SELECT j.*, u.name AS employer_name, c.name AS category_name, c.color AS category_color
                FROM jobs j
                JOIN users u ON u.id = j.employer_id
                JOIN categories c ON c.id = j.category_id
                WHERE j.status = 'active'
                ORDER BY j.featured DESC, j.id DESC";
        $jobs = array_map('formatJobRow', $pdo->query($sql)->fetchAll());
        jsonResponse(['jobs' => $jobs]);
    }

    if ($method === 'GET' && $path === '/my-jobs') {
        $user = requireAuth($pdo);
        $stmt = $pdo->prepare("SELECT j.*, u.name AS employer_name, c.name AS category_name, c.color AS category_color
                               FROM jobs j
                               JOIN users u ON u.id = j.employer_id
                               JOIN categories c ON c.id = j.category_id
                               WHERE j.employer_id = ?
                               ORDER BY j.id DESC");
        $stmt->execute([(int)$user['id']]);
        jsonResponse(['jobs' => array_map('formatJobRow', $stmt->fetchAll())]);
    }

    if ($method === 'POST' && $path === '/jobs') {
        $user = requireAuth($pdo);
        $body = getJsonBody();
        $settings = getSettingsRow($pdo);
        if ($settings['maintenanceMode']) {
            jsonResponse(['error' => $settings['maintenanceMessage'] ?: 'Maintenance mode is active.'], 503);
        }

        $categoryId = (int)($body['categoryId'] ?? 0);
        $title = trim((string)($body['title'] ?? ''));
        $targetRegion = trim((string)($body['targetRegion'] ?? 'Worldwide'));
        $targetUrl = trim((string)($body['targetUrl'] ?? ''));
        $steps = array_values(array_filter(array_map('trim', (array)($body['steps'] ?? []))));
        $proofRequirement = trim((string)($body['proofRequirement'] ?? ''));
        $requireScreenshot = !empty($body['requireScreenshot']);
        $rewardPerWorker = round((float)($body['rewardPerWorker'] ?? 0), 4);
        $workersNeeded = (int)($body['workersNeeded'] ?? 0);
        $estimatedMinutes = max(1, (int)($body['estimatedMinutes'] ?? 3));

        $catStmt = $pdo->prepare('SELECT * FROM categories WHERE id = ? AND active = 1 LIMIT 1');
        $catStmt->execute([$categoryId]);
        $cat = $catStmt->fetch();
        if (!$cat) {
            jsonResponse(['error' => 'Valid active category is required.'], 400);
        }
        if (strlen($title) < 5 || empty($steps) || strlen($proofRequirement) < 5) {
            jsonResponse(['error' => 'Title, steps, and proof requirement are required.'], 400);
        }
        if ($workersNeeded < $settings['minJobWorkers']) {
            jsonResponse(['error' => 'Minimum workers needed is ' . $settings['minJobWorkers']], 400);
        }
        if ($rewardPerWorker < (float)$cat['min_cpc']) {
            jsonResponse(['error' => 'Minimum reward for this category is $' . $cat['min_cpc']], 400);
        }

        $baseCost = round($rewardPerWorker * $workersNeeded, 4);
        $platformFee = round($baseCost * ($settings['platformFeePercent'] / 100), 4);
        $totalBudget = round($baseCost + $platformFee, 4);

        if ((float)$user['deposit_balance'] < $totalBudget) {
            jsonResponse(['error' => 'Insufficient Deposit Balance. Please deposit funds or transfer from Earning Balance.'], 400);
        }

        $status = $settings['autoApproveJobs'] ? 'active' : 'pending';

        $pdo->beginTransaction();
        try {
            $deduct = $pdo->prepare('UPDATE users SET deposit_balance = deposit_balance - ? WHERE id = ? AND deposit_balance >= ?');
            $deduct->execute([$totalBudget, (int)$user['id'], $totalBudget]);
            if ($deduct->rowCount() === 0) {
                throw new RuntimeException('Insufficient Deposit Balance.');
            }

            $ins = $pdo->prepare('INSERT INTO jobs (employer_id, category_id, title, target_region, target_url, steps_json, proof_requirement, require_screenshot, reward_per_worker, workers_needed, platform_fee, total_budget, status, estimated_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $ins->execute([
                (int)$user['id'],
                $categoryId,
                $title,
                $targetRegion,
                $targetUrl,
                json_encode($steps, JSON_UNESCAPED_UNICODE),
                $proofRequirement,
                $requireScreenshot ? 1 : 0,
                $rewardPerWorker,
                $workersNeeded,
                $platformFee,
                $totalBudget,
                $status,
                $estimatedMinutes,
            ]);
            $jobId = (int)$pdo->lastInsertId();

            $tx = $pdo->prepare('INSERT INTO transactions (user_id, type, wallet, amount, description) VALUES (?, ?, ?, ?, ?)');
            $tx->execute([(int)$user['id'], 'job_spend', 'deposit', -$totalBudget, "Campaign #$jobId: $title"]);

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            jsonResponse(['error' => $e->getMessage()], 400);
        }

        $jStmt = $pdo->prepare("SELECT j.*, u.name AS employer_name, c.name AS category_name, c.color AS category_color
                                FROM jobs j JOIN users u ON u.id = j.employer_id JOIN categories c ON c.id = j.category_id
                                WHERE j.id = ?");
        $jStmt->execute([$jobId]);
        $uStmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $uStmt->execute([(int)$user['id']]);

        jsonResponse(['job' => formatJobRow($jStmt->fetch()), 'user' => formatUserRow($uStmt->fetch())], 201);
    }

    if ($method === 'PATCH' && preg_match('#^/jobs/(\d+)/status$#', $path, $m)) {
        $user = requireAuth($pdo);
        $jobId = (int)$m[1];
        $body = getJsonBody();
        $nextStatus = (string)($body['status'] ?? '');
        if (!in_array($nextStatus, ['active', 'paused'], true)) {
            jsonResponse(['error' => 'Invalid status toggle.'], 400);
        }
        $jStmt = $pdo->prepare('SELECT * FROM jobs WHERE id = ? AND employer_id = ?');
        $jStmt->execute([$jobId, (int)$user['id']]);
        $job = $jStmt->fetch();
        if (!$job || !in_array($job['status'], ['active', 'paused'], true)) {
            jsonResponse(['error' => 'Job cannot be toggled right now.'], 400);
        }
        $pdo->prepare('UPDATE jobs SET status = ? WHERE id = ?')->execute([$nextStatus, $jobId]);
        jsonResponse(['ok' => true, 'status' => $nextStatus]);
    }

    if ($method === 'POST' && preg_match('#^/jobs/(\d+)/proofs$#', $path, $m)) {
        $user = requireAuth($pdo);
        $settings = getSettingsRow($pdo);
        if ($settings['maintenanceMode']) {
            jsonResponse(['error' => $settings['maintenanceMessage'] ?: 'Task submissions are paused during maintenance.'], 503);
        }
        $jobId = (int)$m[1];
        $body = getJsonBody();
        $proofText = trim((string)($body['proofText'] ?? ''));
        $screenshotData = (string)($body['screenshotData'] ?? '');

        $jStmt = $pdo->prepare('SELECT * FROM jobs WHERE id = ? LIMIT 1');
        $jStmt->execute([$jobId]);
        $job = $jStmt->fetch();

        if (!$job || $job['status'] !== 'active') {
            jsonResponse(['error' => 'This job is no longer accepting submissions.'], 400);
        }
        if ((int)$job['employer_id'] === (int)$user['id']) {
            jsonResponse(['error' => 'You cannot complete your own job campaign.'], 400);
        }
        if ((int)$job['workers_completed'] >= (int)$job['workers_needed']) {
            jsonResponse(['error' => 'All worker slots for this job are full.'], 400);
        }
        if (strlen($proofText) < 4) {
            jsonResponse(['error' => 'Please enter valid proof details.'], 400);
        }
        if ((bool)$job['require_screenshot'] && $screenshotData === '') {
            jsonResponse(['error' => 'Screenshot proof is required for this task.'], 400);
        }

        $dup = $pdo->prepare('SELECT id FROM job_proofs WHERE job_id = ? AND worker_id = ? LIMIT 1');
        $dup->execute([$jobId, (int)$user['id']]);
        if ($dup->fetch()) {
            jsonResponse(['error' => 'You already submitted proof for this job.'], 409);
        }

        $screenshotUrl = $screenshotData !== '' ? saveBase64Upload($screenshotData) : null;

        $pdo->beginTransaction();
        try {
            $ins = $pdo->prepare('INSERT INTO job_proofs (job_id, worker_id, employer_id, reward_amount, proof_text, screenshot_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $ins->execute([$jobId, (int)$user['id'], (int)$job['employer_id'], (float)$job['reward_per_worker'], $proofText, $screenshotUrl, 'pending']);
            $proofId = (int)$pdo->lastInsertId();

            $pdo->prepare("UPDATE jobs SET workers_completed = workers_completed + 1, status = IF(workers_completed + 1 >= workers_needed, 'completed', status) WHERE id = ?")
                ->execute([$jobId]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Failed to submit proof: ' . $e->getMessage()], 400);
        }

        jsonResponse(['ok' => true, 'proofId' => $proofId], 201);
    }

    if ($method === 'GET' && $path === '/my-proofs') {
        $user = requireAuth($pdo);
        $stmt = $pdo->prepare("SELECT p.*, j.title AS job_title, u.name AS worker_name
                               FROM job_proofs p
                               JOIN jobs j ON j.id = p.job_id
                               JOIN users u ON u.id = p.worker_id
                               WHERE p.worker_id = ?
                               ORDER BY p.id DESC");
        $stmt->execute([(int)$user['id']]);
        $rows = array_map(fn($r) => [
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
        ], $stmt->fetchAll());
        jsonResponse(['proofs' => $rows]);
    }

    if ($method === 'GET' && preg_match('#^/jobs/(\d+)/proofs$#', $path, $m)) {
        $user = requireAuth($pdo);
        $jobId = (int)$m[1];
        $stmt = $pdo->prepare("SELECT p.*, j.title AS job_title, u.name AS worker_name
                               FROM job_proofs p
                               JOIN jobs j ON j.id = p.job_id
                               JOIN users u ON u.id = p.worker_id
                               WHERE p.job_id = ? AND (p.employer_id = ? OR ? = 'admin')
                               ORDER BY p.id DESC");
        $stmt->execute([$jobId, (int)$user['id'], $user['role']]);
        $rows = array_map(fn($r) => [
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
        ], $stmt->fetchAll());
        jsonResponse(['proofs' => $rows]);
    }

    if ($method === 'POST' && preg_match('#^/proofs/(\d+)/review$#', $path, $m)) {
        $user = requireAuth($pdo);
        $proofId = (int)$m[1];
        $body = getJsonBody();
        $decision = (string)($body['decision'] ?? '');
        $note = trim((string)($body['note'] ?? ''));

        if (!in_array($decision, ['approved', 'rejected'], true)) {
            jsonResponse(['error' => 'Decision must be approved or rejected.'], 400);
        }

        $pStmt = $pdo->prepare('SELECT p.*, j.title AS job_title FROM job_proofs p JOIN jobs j ON j.id = p.job_id WHERE p.id = ? LIMIT 1');
        $pStmt->execute([$proofId]);
        $proof = $pStmt->fetch();
        if (!$proof) {
            jsonResponse(['error' => 'Proof not found.'], 404);
        }
        if ((int)$proof['employer_id'] !== (int)$user['id'] && $user['role'] !== 'admin') {
            jsonResponse(['error' => 'Forbidden.'], 403);
        }
        if ($proof['status'] !== 'pending') {
            jsonResponse(['error' => 'Proof already reviewed.'], 400);
        }

        $settings = getSettingsRow($pdo);
        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE job_proofs SET status = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?')
                ->execute([$decision, $note, $proofId]);

            if ($decision === 'approved') {
                $reward = (float)$proof['reward_amount'];
                $workerId = (int)$proof['worker_id'];
                $pdo->prepare('UPDATE users SET earning_balance = earning_balance + ?, tasks_completed = tasks_completed + 1 WHERE id = ?')
                    ->execute([$reward, $workerId]);
                $pdo->prepare('INSERT INTO transactions (user_id, type, wallet, amount, description) VALUES (?, ?, ?, ?, ?)')
                    ->execute([$workerId, 'earning', 'earning', $reward, "Task #{$proof['job_id']} Approved: {$proof['job_title']}"]);

                // Referral Commission
                $wStmt = $pdo->prepare('SELECT referred_by, name FROM users WHERE id = ?');
                $wStmt->execute([$workerId]);
                $wRow = $wStmt->fetch();
                if ($wRow && !empty($wRow['referred_by']) && $settings['referralCommissionPercent'] > 0) {
                    $comm = round($reward * ($settings['referralCommissionPercent'] / 100), 4);
                    if ($comm > 0) {
                        $refId = (int)$wRow['referred_by'];
                        $pdo->prepare('UPDATE users SET earning_balance = earning_balance + ?, referral_earned = referral_earned + ? WHERE id = ?')
                            ->execute([$comm, $comm, $refId]);
                        $pdo->prepare('INSERT INTO transactions (user_id, type, wallet, amount, description) VALUES (?, ?, ?, ?, ?)')
                            ->execute([$refId, 'referral', 'earning', $comm, "Referral commission from {$wRow['name']}"]);
                    }
                }
            } else {
                // Free the slot if rejected
                $pdo->prepare("UPDATE jobs SET workers_completed = GREATEST(0, workers_completed - 1), status = IF(status = 'completed', 'active', status) WHERE id = ?")
                    ->execute([(int)$proof['job_id']]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            jsonResponse(['error' => $e->getMessage()], 400);
        }

        jsonResponse(['ok' => true]);
    }

    return false;
}

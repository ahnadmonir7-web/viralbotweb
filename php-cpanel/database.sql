-- Viral Bolt Micro-Job Marketplace — MySQL Schema & Seed Data
-- Compatible with MySQL 5.7+ / 8.0+ & MariaDB 10.4+ (cPanel phpMyAdmin)

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `username` VARCHAR(80) NOT NULL UNIQUE,
  `phone` VARCHAR(30) NULL UNIQUE,
  `email` VARCHAR(190) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `country` VARCHAR(80) NOT NULL DEFAULT 'Global',
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `status` ENUM('active', 'banned') NOT NULL DEFAULT 'active',
  `kyc_status` ENUM('unverified', 'pending', 'verified', 'rejected') NOT NULL DEFAULT 'unverified',
  `kyc_document_url` VARCHAR(500) NULL,
  `kyc_note` VARCHAR(255) NULL,
  `earning_balance` DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  `deposit_balance` DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  `referral_code` VARCHAR(32) NOT NULL UNIQUE,
  `referred_by` INT UNSIGNED NULL,
  `referral_earned` DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  `tasks_completed` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_users_referred_by` (`referred_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `slug` VARCHAR(120) NOT NULL UNIQUE,
  `color` VARCHAR(30) NOT NULL DEFAULT 'indigo',
  `min_cpc` DECIMAL(10,4) NOT NULL DEFAULT 0.0300,
  `description` VARCHAR(255) NOT NULL DEFAULT '',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `jobs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employer_id` INT UNSIGNED NOT NULL,
  `category_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `target_region` VARCHAR(120) NOT NULL DEFAULT 'Worldwide',
  `target_url` VARCHAR(500) NOT NULL DEFAULT '',
  `steps_json` TEXT NOT NULL,
  `proof_requirement` TEXT NOT NULL,
  `require_screenshot` TINYINT(1) NOT NULL DEFAULT 1,
  `reward_per_worker` DECIMAL(10,4) NOT NULL,
  `workers_needed` INT UNSIGNED NOT NULL,
  `workers_completed` INT UNSIGNED NOT NULL DEFAULT 0,
  `platform_fee` DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  `total_budget` DECIMAL(12,4) NOT NULL,
  `featured` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('pending', 'active', 'paused', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
  `rejection_reason` VARCHAR(255) NULL,
  `estimated_minutes` INT UNSIGNED NOT NULL DEFAULT 3,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_jobs_status` (`status`),
  INDEX `idx_jobs_category` (`category_id`),
  INDEX `idx_jobs_employer` (`employer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `job_proofs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `job_id` INT UNSIGNED NOT NULL,
  `worker_id` INT UNSIGNED NOT NULL,
  `employer_id` INT UNSIGNED NOT NULL,
  `reward_amount` DECIMAL(10,4) NOT NULL,
  `proof_text` TEXT NOT NULL,
  `screenshot_url` VARCHAR(500) NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `review_note` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_job_worker` (`job_id`, `worker_id`),
  INDEX `idx_proofs_employer` (`employer_id`),
  INDEX `idx_proofs_worker` (`worker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gateways` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `type` ENUM('deposit', 'withdraw', 'both') NOT NULL DEFAULT 'both',
  `account_details` VARCHAR(255) NOT NULL,
  `instructions` TEXT NOT NULL,
  `min_amount` DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  `max_amount` DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
  `fee_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `color` VARCHAR(30) NOT NULL DEFAULT 'indigo',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `deposits` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `gateway_id` INT UNSIGNED NOT NULL,
  `gateway_name` VARCHAR(120) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `trx_id` VARCHAR(120) NOT NULL,
  `screenshot_url` VARCHAR(500) NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `admin_note` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_deposits_user` (`user_id`),
  INDEX `idx_deposits_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `gateway_id` INT UNSIGNED NOT NULL,
  `gateway_name` VARCHAR(120) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `fee_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `net_amount` DECIMAL(12,2) NOT NULL,
  `account_number` VARCHAR(190) NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `admin_note` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_withdrawals_user` (`user_id`),
  INDEX `idx_withdrawals_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `type` ENUM('earning', 'deposit', 'withdraw', 'job_spend', 'job_refund', 'referral', 'transfer', 'admin_adjust') NOT NULL,
  `wallet` ENUM('earning', 'deposit') NOT NULL,
  `amount` DECIMAL(12,4) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tickets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `subject` VARCHAR(200) NOT NULL,
  `category` VARCHAR(80) NOT NULL DEFAULT 'General',
  `priority` ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  `status` ENUM('open', 'answered', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tickets_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ticket_replies` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ticket_id` INT UNSIGNED NOT NULL,
  `sender_id` INT UNSIGNED NOT NULL,
  `sender_name` VARCHAR(120) NOT NULL,
  `sender_role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `message` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_replies_ticket` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `blog_posts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(220) NOT NULL,
  `slug` VARCHAR(220) NOT NULL UNIQUE,
  `category` VARCHAR(80) NOT NULL DEFAULT 'Updates',
  `excerpt` VARCHAR(400) NOT NULL DEFAULT '',
  `content` TEXT NOT NULL,
  `cover_image_url` VARCHAR(500) NOT NULL DEFAULT '/assets/images/category_social.jpg',
  `author_name` VARCHAR(120) NOT NULL DEFAULT 'MiniWorkers Team',
  `featured` TINYINT(1) NOT NULL DEFAULT 0,
  `published` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pages` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(160) NOT NULL UNIQUE,
  `summary` VARCHAR(300) NOT NULL DEFAULT '',
  `content` TEXT NOT NULL,
  `show_in_header` TINYINT(1) NOT NULL DEFAULT 0,
  `show_in_footer` TINYINT(1) NOT NULL DEFAULT 1,
  `published` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_id` INT UNSIGNED NOT NULL,
  `admin_name` VARCHAR(120) NOT NULL,
  `action` VARCHAR(120) NOT NULL,
  `details` VARCHAR(500) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  `site_name` VARCHAR(120) NOT NULL DEFAULT 'MiniWorkers',
  `tagline` VARCHAR(255) NOT NULL DEFAULT 'Human-Verified Micro-Jobs · Fast Multi-Gateway Payouts',
  `logo_url` VARCHAR(500) NOT NULL DEFAULT '',
  `accent_theme` ENUM('teal', 'indigo', 'violet', 'emerald', 'rose', 'amber', 'sky') NOT NULL DEFAULT 'teal',
  `currency_symbol` VARCHAR(10) NOT NULL DEFAULT '$',
  `platform_fee_percent` DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  `referral_commission_percent` DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  `min_job_workers` INT UNSIGNED NOT NULL DEFAULT 10,
  `min_withdraw_amount` DECIMAL(10,2) NOT NULL DEFAULT 2.00,
  `auto_approve_jobs` TINYINT(1) NOT NULL DEFAULT 0,
  `allow_registration` TINYINT(1) NOT NULL DEFAULT 1,
  `maintenance_mode` TINYINT(1) NOT NULL DEFAULT 0,
  `maintenance_message` VARCHAR(300) NOT NULL DEFAULT 'Platform maintenance is underway. Submissions will resume shortly.',
  `notice_banner` TEXT NOT NULL,
  `support_email` VARCHAR(190) NOT NULL DEFAULT 'support@miniworkers.example',
  `hero_kicker` VARCHAR(255) NOT NULL DEFAULT 'Human-Verified Micro-Jobs · Instant Task Proofs · Multi-Gateway Payouts',
  `hero_title` VARCHAR(255) NOT NULL DEFAULT 'Complete small digital tasks daily or launch real-human campaigns.',
  `hero_subtitle` TEXT NOT NULL,
  `hero_primary_cta` VARCHAR(80) NOT NULL DEFAULT 'Start Earning Free',
  `hero_secondary_cta` VARCHAR(80) NOT NULL DEFAULT 'Explore Live Tasks',
  `hero_image_url` VARCHAR(500) NOT NULL DEFAULT '/assets/images/hero_workspace.jpg',
  `show_stats_strip` TINYINT(1) NOT NULL DEFAULT 1,
  `show_how_it_works` TINYINT(1) NOT NULL DEFAULT 1,
  `show_blog_section` TINYINT(1) NOT NULL DEFAULT 1,
  `founder_name` VARCHAR(120) NOT NULL DEFAULT 'Tariq Ahmed',
  `founder_role` VARCHAR(160) NOT NULL DEFAULT 'Marketplace Operations · Dhaka & Global',
  `founder_quote` TEXT NOT NULL,
  `footer_text` VARCHAR(255) NOT NULL DEFAULT 'All rights reserved. Built for verified micro-jobs and fast payouts.'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `settings` (`id`, `site_name`, `tagline`, `logo_url`, `accent_theme`, `currency_symbol`, `platform_fee_percent`, `referral_commission_percent`, `min_job_workers`, `min_withdraw_amount`, `auto_approve_jobs`, `allow_registration`, `maintenance_mode`, `maintenance_message`, `notice_banner`, `support_email`, `hero_kicker`, `hero_title`, `hero_subtitle`, `hero_primary_cta`, `hero_secondary_cta`, `hero_image_url`, `show_stats_strip`, `show_how_it_works`, `show_blog_section`, `founder_name`, `founder_role`, `founder_quote`, `footer_text`)
VALUES (
  1,
  'MiniWorkers',
  'Human-Verified Micro-Jobs · Fast Multi-Gateway Payouts',
  '',
  'teal',
  '$',
  5.00,
  5.00,
  10,
  2.00,
  0,
  1,
  0,
  'Platform maintenance is underway. Submissions will resume shortly.',
  'Welcome to MiniWorkers! Complete verified micro-tasks daily or launch human-powered campaigns with instant proof tracking.',
  'support@miniworkers.example',
  'Human-Verified Micro-Jobs · Instant Task Proofs · Multi-Gateway Payouts',
  'Complete small digital tasks daily or launch real-human campaigns.',
  'Workers earn steady payouts for social engagement, app testing, and web research. Employers pay only for approved proofs—never bots.',
  'Start Earning Free',
  'Explore Live Tasks',
  '/assets/images/hero_workspace.jpg',
  1,
  1,
  1,
  'Tariq Ahmed',
  'Marketplace Operations · Dhaka & Global',
  'Every campaign budget is held safely until employers review worker screenshots, and our support ticket team resolves any proof dispute within 24 hours.',
  'All rights reserved. Built for verified micro-jobs and fast payouts.'
)
ON DUPLICATE KEY UPDATE `id` = 1;

INSERT INTO `categories` (`id`, `name`, `slug`, `color`, `min_cpc`, `description`, `active`) VALUES
(1, 'YouTube & Video', 'youtube-video', 'rose', 0.0400, 'Watch time, channel subscriptions, and genuine video comments.', 1),
(2, 'Social Media', 'social-media', 'indigo', 0.0300, 'Follows, shares, page likes, and community engagement.', 1),
(3, 'App Testing & Signups', 'app-testing', 'emerald', 0.1200, 'Install Android/iOS apps, test onboarding flows, and report UI bugs.', 1),
(4, 'Website Visit & SEO', 'website-seo', 'sky', 0.0400, 'Organic search clicks, article reading, and dwell-time verification.', 1),
(5, 'Surveys & Feedback', 'surveys', 'amber', 0.1500, 'Short product questionnaires and UX feedback polls.', 1),
(6, 'Data Entry & Writing', 'data-entry', 'violet', 0.1000, 'Categorize listings, verify contacts, or write short reviews.', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `gateways` (`id`, `name`, `code`, `type`, `account_details`, `instructions`, `min_amount`, `max_amount`, `fee_percent`, `color`, `active`) VALUES
(1, 'bKash (Personal / Merchant)', 'bkash', 'both', '01700-000000 (Send Money)', 'Send funds via bKash Send Money, then enter your 10-digit TrxID and upload a screenshot.', 2.00, 500.00, 2.00, 'rose', 1),
(2, 'Nagad Wallet', 'nagad', 'both', '01800-000000 (Personal)', 'Transfer via Nagad App and submit your Transaction ID below for fast verification.', 2.00, 500.00, 1.50, 'amber', 1),
(3, 'Binance Pay / USDT (TRC20)', 'usdt', 'both', 'Binance Pay ID: 284910442 · TRC20: TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', 'Send exact USDT amount via Binance Pay or TRC20 network and paste the Order/Tx Hash.', 5.00, 5000.00, 1.00, 'emerald', 1),
(4, 'PayPal Instant', 'paypal', 'both', 'billing@miniworkers.example', 'Send as Goods/Services or enter your PayPal email for withdrawals.', 5.00, 2000.00, 3.50, 'sky', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `users` (`id`, `name`, `username`, `phone`, `email`, `password_hash`, `country`, `role`, `status`, `kyc_status`, `earning_balance`, `deposit_balance`, `referral_code`, `referral_earned`, `tasks_completed`) VALUES
(101, 'Arif Rahman', 'arif_rahman', '01711000001', 'arif@demo.com', '$6$spfE2oIMtx1xjUnl$uAtq6517KyR8eNxqb5BaDVY5NpfG5YTkyQNXxvL7f0yamrLkTyiF80hn6qVflvBf7OQHZjGRkaopP.9yaBds7/', 'Bangladesh', 'user', 'active', 'verified', 18.4500, 42.0000, 'ARIF2026', 2.3500, 34),
(102, 'Nadia Islam', 'nadia_islam', '01811000002', 'nadia@demo.com', '$6$spfE2oIMtx1xjUnl$uAtq6517KyR8eNxqb5BaDVY5NpfG5YTkyQNXxvL7f0yamrLkTyiF80hn6qVflvBf7OQHZjGRkaopP.9yaBds7/', 'Bangladesh', 'user', 'active', 'unverified', 6.2000, 15.0000, 'NADIA88', 0.0000, 12)
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

INSERT INTO `jobs` (`id`, `employer_id`, `category_id`, `title`, `target_region`, `target_url`, `steps_json`, `proof_requirement`, `require_screenshot`, `reward_per_worker`, `workers_needed`, `workers_completed`, `platform_fee`, `total_budget`, `featured`, `status`, `estimated_minutes`) VALUES
(201, 101, 1, 'Watch 3-Minute Tech Review Video & Leave Constructive Comment', 'Worldwide', 'https://youtube.com', '["Open YouTube and search for Minimal Desk Setup Tour 2026.","Watch at least 3 minutes of the video without skipping.","Like the video and write a genuine 1-sentence comment."]', 'Provide your YouTube handle and upload a screenshot showing 3:00+ watch time.', 1, 0.1200, 120, 78, 0.7200, 15.1200, 1, 'active', 4),
(202, 101, 3, 'Test Habit Tracker Mobile Web App & Submit Onboarding Feedback', 'Asia & Europe', 'https://example.com/habit-app', '["Visit the test link and create a free demo workspace.","Add 2 sample daily habits and mark one complete.","Note any layout issues on your screen size."]', 'Submit the email username you tested with plus 2 sentences of honest UX feedback.', 1, 0.3500, 60, 31, 1.0500, 22.0500, 1, 'active', 6),
(203, 102, 2, 'Follow Design Studio Instagram Page & Save Latest Carousel Post', 'Worldwide', 'https://instagram.com', '["Open the target Instagram profile using the provided link.","Tap Follow and like the pinned branding carousel.","Save the post to your bookmarks."]', 'Enter your Instagram username and attach a screenshot confirming Follow + Save.', 1, 0.0800, 200, 144, 0.8000, 16.8000, 0, 'active', 2),
(204, 101, 4, 'Read Cloud Hosting Comparison Article & Find Promo Code', 'Worldwide', 'https://example.com/cloud-guide', '["Search Google for Best Shared cPanel Hosting Guide 2026.","Scroll slowly through the full article (at least 90 seconds).","Locate the summary box at the bottom."]', 'Paste the last 3 words of the summary box and the article URL.', 0, 0.0900, 150, 64, 0.6800, 14.1800, 0, 'active', 3),
(205, 102, 5, '5-Question E-Commerce Checkout Experience Survey', 'Bangladesh, India, USA', 'https://example.com/survey', '["Open the short 5-question form.","Answer all questions thoughtfully based on your shopping habits.","Copy the completion code shown on the final screen."]', 'Paste the 8-character completion code from the thank-you screen.', 0, 0.2500, 80, 45, 1.0000, 21.0000, 1, 'active', 4),
(206, 101, 6, 'Verify 5 Local Cafe Opening Hours from Official Websites', 'Worldwide', 'https://example.com/directory', '["Open the 5 listed cafe links from the task brief.","Check current Friday opening and closing hours.","Format cleanly as Name: 08:00 - 22:00."]', 'Paste the formatted 5-line schedule in the proof box.', 0, 0.4000, 40, 18, 0.8000, 16.8000, 0, 'active', 7)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

INSERT INTO `blog_posts` (`id`, `title`, `slug`, `category`, `excerpt`, `content`, `cover_image_url`, `author_name`, `featured`, `published`) VALUES
(401, 'How to Get 100% Proof Approval Rate on Micro-Tasks', 'how-to-get-100-proof-approval-rate', 'Worker Tips', 'Follow these 4 practical screenshot and verification habits to get your submissions approved quickly without rejections.', 'Read every step carefully before clicking Start Task.\n\n1. Capture clear screenshots showing timestamps or usernames requested.\n2. Avoid duplicate or cropped screenshots.\n3. Wait the full watch or read duration before submitting proof.', '/assets/images/category_social.jpg', 'MiniWorkers Editorial', 1, 1),
(402, 'Launching High-Retention Video & App Testing Campaigns', 'launching-high-retention-campaigns', 'Employer Guide', 'Learn how to structure clear task briefs and realistic per-task rewards so verified workers complete your campaign in hours.', 'Employers on MiniWorkers get the best results when steps are specific and measurable.\n\nKeep instructions to 3-4 concise steps and specify exact proof requirements such as handle name or onboarding screenshot.', '/assets/images/category_apps.jpg', 'Tariq Ahmed', 0, 1),
(403, 'Fast Withdrawals via bKash, Nagad & Binance USDT', 'fast-withdrawals-bkash-nagad-usdt', 'Payments', 'A quick breakdown of payout verification times, minimum withdrawal amounts, and referral commission payouts.', 'Workers can withdraw Earning Balance through any active gateway configured in the Admin Panel.\n\nDouble-check your wallet number or TRC20 address before submitting.', '/assets/images/hero_workspace.jpg', 'Finance Desk', 0, 1)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

INSERT INTO `pages` (`id`, `title`, `slug`, `summary`, `content`, `show_in_header`, `show_in_footer`, `published`) VALUES
(501, 'About Us', 'about', 'How MiniWorkers connects verified workers with real-human campaigns worldwide.', 'MiniWorkers is a micro-job marketplace connecting real community workers with businesses seeking authentic engagement, app testing, and research feedback.', 0, 1, 1),
(502, 'Terms & Rules', 'terms', 'Marketplace fair-use rules for workers and employers.', '1. One account per person/device.\n2. Fake or edited screenshots result in immediate rejection and account suspension.\n3. Employers must review valid proofs within 72 hours.', 0, 1, 1),
(503, 'Payout Policy', 'payout-policy', 'Schedule, wallet transfer options, and gateway fee transparency.', 'Earning Balance is eligible for withdrawal across bKash, Nagad, Binance Pay / USDT, and PayPal once the minimum threshold is met.', 0, 1, 1)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

COMMIT;

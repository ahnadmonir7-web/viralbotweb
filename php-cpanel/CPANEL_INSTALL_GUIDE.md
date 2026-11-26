# Viral Bolt — cPanel Deployment Guide (HTML5 + CSS + Tailwind + Bootstrap 5 + JS + PHP 8 + MySQL)

This package is 100% ready for standard **cPanel Shared Hosting / VPS** (Apache + PHP 8.0+ + MySQL/MariaDB + phpMyAdmin).

## Folder Structure inside Package
- `database.sql` — MySQL schema + seed categories, payment gateways, demo user (`01711000001` or `arif@demo.com` / `worker123`), and sample micro-jobs.
- `public_html/` — Upload **all files inside this folder** directly into your cPanel `public_html/` directory:
  - `index.html` — Clean HTML5 + Bootstrap 5 + Tailwind CSS application
  - `assets/css/style.css` — Custom CSS variables & theme styles
  - `assets/js/*.js` — Modular JavaScript (`api.js`, `marketplace.js`, `dashboard.js`, `admin.js`, `main.js`)
  - `assets/images/*.jpg` — Marketplace & category imagery
  - `.htaccess` — Apache rewrite rules forwarding `/api/*` to PHP and preserving `Authorization: Bearer` headers
  - `api/` — PHP 8 PDO MySQL backend (`config/database.php`, `helpers/auth.php`, `controllers/*`, `index.php`)

---

## Step-by-Step cPanel Deployment

1. **Create MySQL Database & User**
   - Log into **cPanel** → **MySQL® Databases**.
   - Create a database (e.g., `cpaneluser_viralbolt`).
   - Create a MySQL user with a strong password.
   - Under **Add User to Database**, assign that user to the database with **ALL PRIVILEGES**.

2. **Import `database.sql` in phpMyAdmin**
   - Open **cPanel → phpMyAdmin**.
   - Click your new database name on the left panel.
   - Click the **Import** tab → choose `database.sql` → click **Import / Go**.

3. **Upload `public_html` Contents**
   - Open **cPanel → File Manager** → open `public_html/` (enable **Show Hidden Files (dotfiles)** in File Manager Settings so `.htaccess` is visible).
   - Upload all contents from `public_html/` of this ZIP into your server's `public_html/`.
   - Ensure `public_html/api/` permissions are `0755` for folders and `0644` for files.

4. **Connect PHP to Your MySQL Database**
   - Edit `public_html/api/config/database.php` in File Manager:
     - `DB_HOST`: `localhost`
     - `DB_NAME`: your cPanel database name
     - `DB_USER`: your cPanel MySQL username
     - `DB_PASS`: your MySQL password
     - `APP_JWT_SECRET`: replace with a random 64-character secret key.

5. **Claim Your Admin Account**
   - Visit `https://yourdomain.com`.
   - Click **Sign In** → switch to the **Admin Panel** tab → enter your email and choose your Admin password (6+ chars) → click **Claim & Open Admin Panel**.
   - From the Admin Panel you can manage Jobs, Categories, Deposits, Withdrawals, Users/KYC, Payment Gateways, Support Tickets, and Site Settings!

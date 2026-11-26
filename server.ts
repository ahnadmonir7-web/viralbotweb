import 'dotenv/config';
import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  allocateId,
  hashPassword,
  loadDatabase,
  sanitizeUser,
  saveDatabase,
  UPLOAD_DIR,
  verifyPassword,
  type DatabaseState,
  type StoredUser,
} from './src/server/db.ts';

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

interface AuthedRequest extends Request {
  authUser?: StoredUser;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): string {
  const pad = input.length % 4;
  const normalized = (input + (pad ? '='.repeat(4 - pad) : '')).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function signToken(userId: number, role: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: userId,
      role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    })
  );
  const sig = base64UrlEncode(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

function verifyToken(token?: string): { sub: number; role: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = base64UrlEncode(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as { sub: number; role: string; exp: number };
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: parsed.sub, role: parsed.role };
  } catch {
    return null;
  }
}

function saveBase64Image(dataUrl: string): string {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new Error('Only PNG, JPG, or WEBP images are supported.');
  }
  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > 2 * 1024 * 1024) {
    throw new Error('Image must be valid and under 2MB.');
  }
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  const filename = `${crypto.randomUUID()}.${ext}`;
  const targetPath = path.resolve(UPLOAD_DIR, filename);
  if (!targetPath.startsWith(UPLOAD_DIR + path.sep)) {
    throw new Error('Invalid upload path.');
  }
  fs.writeFileSync(targetPath, buffer);
  return `/uploads/${filename}`;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const claims = verifyToken(match?.[1]);
  if (!claims) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const db = loadDatabase();
  const user = db.users.find((u) => u.id === claims.sub);
  if (!user) {
    res.status(401).json({ error: 'Account not found.' });
    return;
  }
  if (user.status === 'banned') {
    res.status(403).json({ error: 'Account has been suspended.' });
    return;
  }
  req.authUser = user;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.authUser?.role !== 'admin') {
      res.status(403).json({ error: 'Administrator permission required.' });
      return;
    }
    next();
  });
}

async function startServer() {
  const app = express();
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '4mb' }));

  // Serve uploaded proof/KYC screenshots safely
  app.use('/uploads', express.static(UPLOAD_DIR));

  function logAdminAction(
    db: ReturnType<typeof loadDatabase>,
    admin: { id: number; name: string },
    action: string,
    details: string
  ) {
    db.activityLogs.unshift({
      id: allocateId(db),
      adminId: admin.id,
      adminName: admin.name,
      action,
      details,
      createdAt: new Date().toISOString(),
    });
    if (db.activityLogs.length > 100) {
      db.activityLogs = db.activityLogs.slice(0, 100);
    }
  }

  function sanitizeUrl(raw: unknown): string {
    const val = String(raw || '').trim();
    if (!val) return '';
    if (val.startsWith('/') || /^https?:\/\//i.test(val)) {
      return val;
    }
    return '';
  }

  // Public Bootstrap
  app.get('/api/bootstrap', (_req, res) => {
    const db = loadDatabase();
    const activeJobs = db.jobs
      .filter((j) => j.status === 'active')
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.id - a.id);
    const publishedPosts = db.blogPosts
      .filter((p) => p.published)
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.id - a.id);
    const publishedPages = db.pages.filter((p) => p.published);
    const workersCount = db.users.filter((u) => u.role === 'user').length;
    const totalTasksPaid = db.users.reduce((sum, u) => sum + u.tasksCompleted, 0);
    const totalPaidOutUsd = db.withdrawals
      .filter((w) => w.status === 'approved')
      .reduce((sum, w) => sum + w.amount, 0);

    res.json({
      settings: db.settings,
      categories: db.categories.filter((c) => c.active),
      gateways: db.gateways.filter((g) => g.active),
      jobs: activeJobs,
      blogPosts: publishedPosts,
      pages: publishedPages,
      stats: {
        activeJobsCount: activeJobs.length,
        totalWorkersCount: workersCount,
        totalTasksPaid,
        totalPaidOutUsd: Number(totalPaidOutUsd.toFixed(2)),
      },
    });
  });

  // Auth Routes
  app.get('/api/auth/admin-status', (_req, res) => {
    const db = loadDatabase();
    const hasEnvPasscode = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
    const hasAdminUser = db.users.some((u) => u.role === 'admin');
    res.json({
      claimed: db.adminClaimed || hasAdminUser || hasEnvPasscode,
      hasEnvPasscode,
    });
  });

  app.post('/api/auth/claim-admin', (req, res) => {
    const db = loadDatabase();
    const email = String(req.body?.email || 'admin@miniworkers.local').trim().toLowerCase();
    const password = (req.body?.password || '') as string;
    const name = String(req.body?.name || 'Platform Admin').trim() || 'Platform Admin';
    const envPass = (process.env.ADMIN_PASSCODE || '').trim();

    if (envPass) {
      if (password !== envPass) {
        res.status(401).json({ error: 'Invalid admin passcode.' });
        return;
      }
    } else {
      if (db.adminClaimed || db.users.some((u) => u.role === 'admin')) {
        res.status(409).json({ error: 'Admin account is already claimed. Please sign in.' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Admin password must be at least 6 characters.' });
        return;
      }
    }

    let adminUser = db.users.find((u) => u.role === 'admin');
    if (!adminUser) {
      const id = allocateId(db);
      adminUser = {
        id,
        name,
        username: 'admin',
        phone: '',
        email,
        country: 'Global',
        role: 'admin',
        status: 'active',
        kycStatus: 'verified',
        earningBalance: 0,
        depositBalance: 0,
        referralCode: `ADM${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        referredBy: null,
        referralEarned: 0,
        tasksCompleted: 0,
        createdAt: new Date().toISOString(),
        passwordHash: hashPassword(password),
      };
      db.users.push(adminUser);
      db.adminClaimed = true;
      saveDatabase(db);
    }

    const token = signToken(adminUser.id, 'admin');
    res.json({ token, user: sanitizeUser(adminUser) });
  });

  app.post('/api/auth/register', (req, res) => {
    const db = loadDatabase();
    if (!db.settings.allowRegistration) {
      res.status(403).json({ error: 'New user registration is currently paused by administration.' });
      return;
    }
    const rawUsername = String(req.body?.username || req.body?.name || '').trim();
    const name = String(req.body?.name || rawUsername).trim();
    const phone = String(req.body?.phone || '').replace(/[^\d+]/g, '').trim();
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const country = String(req.body?.country || 'Bangladesh').trim() || 'Bangladesh';
    const refInput = String(req.body?.referralCode || '').trim().toUpperCase();

    if (name.length < 2 || rawUsername.length < 2 || password.length < 6) {
      res.status(400).json({ error: 'Enter a valid Full Name, Username (2+ chars), and 6+ character Password.' });
      return;
    }

    if (!rawEmail.includes('@') && phone.length < 7) {
      res.status(400).json({ error: 'Enter a valid Email Address (or Phone Number).' });
      return;
    }

    const normalizedUsername = rawUsername.toLowerCase().replace(/\s+/g, '_');
    const email = rawEmail && rawEmail.includes('@') ? rawEmail : `${phone.replace(/\+/g, '')}@miniworkers.user`;

    if (phone && db.users.some((u) => u.phone && u.phone === phone)) {
      res.status(409).json({ error: 'An account with this Phone Number already exists.' });
      return;
    }
    if (db.users.some((u) => u.username.toLowerCase() === normalizedUsername)) {
      res.status(409).json({ error: 'This Username is already taken.' });
      return;
    }
    if (db.users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'An account with this Email Address already exists.' });
      return;
    }

    const referrer = refInput ? db.users.find((u) => u.referralCode === refInput) : undefined;
    const id = allocateId(db);
    const prefix = rawUsername.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'USER';
    const newUser: StoredUser = {
      id,
      name,
      username: rawUsername,
      phone,
      email,
      country,
      role: 'user',
      status: 'active',
      kycStatus: 'unverified',
      earningBalance: 0,
      depositBalance: 5.0,
      referralCode: `${prefix}${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      referredBy: referrer ? referrer.id : null,
      referralEarned: 0,
      tasksCompleted: 0,
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(password),
    };
    db.users.push(newUser);
    db.transactions.unshift({
      id: allocateId(db),
      userId: id,
      type: 'deposit',
      wallet: 'deposit',
      amount: 5.0,
      description: 'Welcome Campaign Starter Credit',
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);

    res.status(201).json({
      token: signToken(newUser.id, newUser.role),
      user: sanitizeUser(newUser),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const db = loadDatabase();
    const identifier = String(req.body?.phone || req.body?.identifier || req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    const idLower = identifier.toLowerCase();
    const idPhone = identifier.replace(/[^\d+]/g, '');

    const user = db.users.find(
      (u) =>
        (idPhone && u.phone === idPhone) ||
        u.email.toLowerCase() === idLower ||
        u.username.toLowerCase() === idLower
    );
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid Email / Username or Password.' });
      return;
    }
    if (user.status === 'banned') {
      res.status(403).json({ error: 'Your account has been suspended.' });
      return;
    }
    res.json({
      token: signToken(user.id, user.role),
      user: sanitizeUser(user),
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: sanitizeUser(req.authUser!) });
  });

  app.post('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const user = db.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    user.name = String(req.body?.name || user.name).trim() || user.name;
    if (req.body?.phone) {
      user.phone = String(req.body.phone).replace(/[^\d+]/g, '').trim() || user.phone;
    }
    user.country = String(req.body?.country || user.country).trim() || user.country;
    saveDatabase(db);
    res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const user = db.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const current = String(req.body?.currentPassword || '');
    const next = String(req.body?.newPassword || '');
    if (!verifyPassword(current, user.passwordHash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    if (next.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }
    user.passwordHash = hashPassword(next);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // Jobs & Proofs
  app.get('/api/jobs', (_req, res) => {
    const db = loadDatabase();
    const activeJobs = db.jobs
      .filter((j) => j.status === 'active')
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.id - a.id);
    res.json({ jobs: activeJobs });
  });

  app.get('/api/my-jobs', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const jobs = db.jobs.filter((j) => j.employerId === req.authUser!.id).sort((a, b) => b.id - a.id);
    res.json({ jobs });
  });

  app.post('/api/jobs', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    if (db.settings.maintenanceMode && req.authUser!.role !== 'admin') {
      res.status(503).json({ error: db.settings.maintenanceMessage || 'Maintenance mode is active.' });
      return;
    }
    const user = db.users.find((u) => u.id === req.authUser!.id)!;
    const categoryId = Number(req.body?.categoryId || 0);
    const title = String(req.body?.title || '').trim();
    const targetRegion = String(req.body?.targetRegion || 'Worldwide').trim() || 'Worldwide';
    const targetUrl = String(req.body?.targetUrl || '').trim();
    const steps = Array.isArray(req.body?.steps)
      ? req.body.steps.map((s: unknown) => String(s).trim()).filter(Boolean)
      : [];
    const proofRequirement = String(req.body?.proofRequirement || '').trim();
    const requireScreenshot = Boolean(req.body?.requireScreenshot);
    const rewardPerWorker = Number(Number(req.body?.rewardPerWorker || 0).toFixed(4));
    const workersNeeded = Math.floor(Number(req.body?.workersNeeded || 0));
    const estimatedMinutes = Math.max(1, Math.floor(Number(req.body?.estimatedMinutes || 3)));

    const category = db.categories.find((c) => c.id === categoryId && c.active);
    if (!category) {
      res.status(400).json({ error: 'Please select an active job category.' });
      return;
    }
    if (title.length < 5 || steps.length === 0 || proofRequirement.length < 5) {
      res.status(400).json({ error: 'Title, steps, and proof requirement are required.' });
      return;
    }
    if (workersNeeded < db.settings.minJobWorkers) {
      res.status(400).json({ error: `Minimum workers needed is ${db.settings.minJobWorkers}.` });
      return;
    }
    if (rewardPerWorker < category.minCpc) {
      res.status(400).json({ error: `Minimum reward for ${category.name} is $${category.minCpc}.` });
      return;
    }

    const baseCost = Number((rewardPerWorker * workersNeeded).toFixed(4));
    const platformFee = Number((baseCost * (db.settings.platformFeePercent / 100)).toFixed(4));
    const totalBudget = Number((baseCost + platformFee).toFixed(4));

    if (user.depositBalance < totalBudget) {
      res.status(400).json({ error: 'Insufficient Deposit Balance. Deposit funds or transfer from Earning Balance.' });
      return;
    }

    user.depositBalance = Number((user.depositBalance - totalBudget).toFixed(4));
    const jobId = allocateId(db);
    const job = {
      id: jobId,
      employerId: user.id,
      employerName: user.name,
      categoryId: category.id,
      categoryName: category.name,
      categoryColor: category.color,
      title,
      targetRegion,
      targetUrl,
      steps,
      proofRequirement,
      requireScreenshot,
      rewardPerWorker,
      workersNeeded,
      workersCompleted: 0,
      platformFee,
      totalBudget,
      featured: false,
      status: db.settings.autoApproveJobs ? ('active' as const) : ('pending' as const),
      estimatedMinutes,
      createdAt: new Date().toISOString(),
    };
    db.jobs.unshift(job);
    db.transactions.unshift({
      id: allocateId(db),
      userId: user.id,
      type: 'job_spend',
      wallet: 'deposit',
      amount: -totalBudget,
      description: `Campaign #${jobId}: ${title}`,
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);
    res.status(201).json({ job, user: sanitizeUser(user) });
  });

  app.patch('/api/jobs/:id/status', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const jobId = Number(req.params.id);
    const nextStatus = req.body?.status;
    if (nextStatus !== 'active' && nextStatus !== 'paused') {
      res.status(400).json({ error: 'Invalid status.' });
      return;
    }
    const job = db.jobs.find((j) => j.id === jobId && j.employerId === req.authUser!.id);
    if (!job || (job.status !== 'active' && job.status !== 'paused')) {
      res.status(400).json({ error: 'Job cannot be toggled right now.' });
      return;
    }
    job.status = nextStatus;
    saveDatabase(db);
    res.json({ ok: true, status: nextStatus });
  });

  app.post('/api/jobs/:id/proofs', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    if (db.settings.maintenanceMode && req.authUser!.role !== 'admin') {
      res.status(503).json({ error: db.settings.maintenanceMessage || 'Maintenance mode is active.' });
      return;
    }
    const jobId = Number(req.params.id);
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== 'active') {
      res.status(400).json({ error: 'This job is no longer accepting submissions.' });
      return;
    }
    if (job.employerId === req.authUser!.id) {
      res.status(400).json({ error: 'You cannot submit work to your own campaign.' });
      return;
    }
    if (job.workersCompleted >= job.workersNeeded) {
      res.status(400).json({ error: 'All worker slots are already filled.' });
      return;
    }
    if (db.proofs.some((p) => p.jobId === jobId && p.workerId === req.authUser!.id)) {
      res.status(409).json({ error: 'You already submitted proof for this job.' });
      return;
    }

    const proofText = String(req.body?.proofText || '').trim();
    const screenshotData = String(req.body?.screenshotData || '').trim();
    if (proofText.length < 4) {
      res.status(400).json({ error: 'Please provide complete proof details.' });
      return;
    }
    if (job.requireScreenshot && !screenshotData) {
      res.status(400).json({ error: 'A screenshot attachment is required for this job.' });
      return;
    }

    let screenshotUrl: string | undefined;
    if (screenshotData) {
      try {
        screenshotUrl = saveBase64Image(screenshotData);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
    }

    const proofId = allocateId(db);
    db.proofs.unshift({
      id: proofId,
      jobId: job.id,
      jobTitle: job.title,
      workerId: req.authUser!.id,
      workerName: req.authUser!.name,
      employerId: job.employerId,
      rewardAmount: job.rewardPerWorker,
      proofText,
      screenshotUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    job.workersCompleted += 1;
    if (job.workersCompleted >= job.workersNeeded) {
      job.status = 'completed';
    }
    saveDatabase(db);
    res.status(201).json({ ok: true, proofId });
  });

  app.get('/api/my-proofs', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const proofs = db.proofs.filter((p) => p.workerId === req.authUser!.id).sort((a, b) => b.id - a.id);
    res.json({ proofs });
  });

  app.get('/api/jobs/:id/proofs', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const jobId = Number(req.params.id);
    const proofs = db.proofs
      .filter((p) => p.jobId === jobId && (p.employerId === req.authUser!.id || req.authUser!.role === 'admin'))
      .sort((a, b) => b.id - a.id);
    res.json({ proofs });
  });

  app.post('/api/proofs/:id/review', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const proofId = Number(req.params.id);
    const decision = req.body?.decision;
    const note = String(req.body?.note || '').trim();
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ error: 'Decision must be approved or rejected.' });
      return;
    }

    const proof = db.proofs.find((p) => p.id === proofId);
    if (!proof) {
      res.status(404).json({ error: 'Proof not found.' });
      return;
    }
    if (proof.employerId !== req.authUser!.id && req.authUser!.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    if (proof.status !== 'pending') {
      res.status(400).json({ error: 'Proof has already been reviewed.' });
      return;
    }

    proof.status = decision;
    proof.reviewNote = note;
    proof.reviewedAt = new Date().toISOString();

    if (decision === 'approved') {
      const worker = db.users.find((u) => u.id === proof.workerId);
      if (worker) {
        worker.earningBalance = Number((worker.earningBalance + proof.rewardAmount).toFixed(4));
        worker.tasksCompleted += 1;
        db.transactions.unshift({
          id: allocateId(db),
          userId: worker.id,
          type: 'earning',
          wallet: 'earning',
          amount: proof.rewardAmount,
          description: `Task #${proof.jobId} Approved: ${proof.jobTitle}`,
          createdAt: new Date().toISOString(),
        });

        if (worker.referredBy && db.settings.referralCommissionPercent > 0) {
          const referrer = db.users.find((u) => u.id === worker.referredBy);
          const comm = Number((proof.rewardAmount * (db.settings.referralCommissionPercent / 100)).toFixed(4));
          if (referrer && comm > 0) {
            referrer.earningBalance = Number((referrer.earningBalance + comm).toFixed(4));
            referrer.referralEarned = Number((referrer.referralEarned + comm).toFixed(4));
            db.transactions.unshift({
              id: allocateId(db),
              userId: referrer.id,
              type: 'referral',
              wallet: 'earning',
              amount: comm,
              description: `Referral commission from ${worker.name}`,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    } else {
      const job = db.jobs.find((j) => j.id === proof.jobId);
      if (job) {
        job.workersCompleted = Math.max(0, job.workersCompleted - 1);
        if (job.status === 'completed') {
          job.status = 'active';
        }
      }
    }

    saveDatabase(db);
    res.json({ ok: true });
  });

  // Wallet, Deposit, Withdraw, Transfer, Referrals, KYC, Tickets
  app.get('/api/wallet/overview', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const uid = req.authUser!.id;
    res.json({
      deposits: db.deposits.filter((d) => d.userId === uid).sort((a, b) => b.id - a.id),
      withdrawals: db.withdrawals.filter((w) => w.userId === uid).sort((a, b) => b.id - a.id),
      transactions: db.transactions.filter((t) => t.userId === uid).sort((a, b) => b.id - a.id).slice(0, 100),
    });
  });

  app.post('/api/wallet/deposit', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const gatewayId = Number(req.body?.gatewayId || 0);
    const amount = Number(Number(req.body?.amount || 0).toFixed(2));
    const trxId = String(req.body?.trxId || '').trim();
    const screenshotData = String(req.body?.screenshotData || '').trim();

    const gw = db.gateways.find((g) => g.id === gatewayId && g.active && g.type !== 'withdraw');
    if (!gw) {
      res.status(400).json({ error: 'Select a valid deposit gateway.' });
      return;
    }
    if (amount < gw.minAmount || amount > gw.maxAmount) {
      res.status(400).json({ error: `Deposit amount must be between $${gw.minAmount} and $${gw.maxAmount}.` });
      return;
    }
    if (trxId.length < 4) {
      res.status(400).json({ error: 'Please enter a valid Transaction ID.' });
      return;
    }

    let screenshotUrl: string | undefined;
    if (screenshotData) {
      try {
        screenshotUrl = saveBase64Image(screenshotData);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
    }

    const depositId = allocateId(db);
    db.deposits.unshift({
      id: depositId,
      userId: req.authUser!.id,
      userName: req.authUser!.name,
      userEmail: req.authUser!.email,
      gatewayId: gw.id,
      gatewayName: gw.name,
      amount,
      trxId,
      screenshotUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);
    res.status(201).json({ ok: true, depositId });
  });

  app.post('/api/wallet/withdraw', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;
    const gatewayId = Number(req.body?.gatewayId || 0);
    const amount = Number(Number(req.body?.amount || 0).toFixed(2));
    const accountNumber = String(req.body?.accountNumber || '').trim();

    const gw = db.gateways.find((g) => g.id === gatewayId && g.active && g.type !== 'deposit');
    if (!gw) {
      res.status(400).json({ error: 'Select a valid withdrawal gateway.' });
      return;
    }
    const minRequired = Math.max(gw.minAmount, db.settings.minWithdrawAmount || 0);
    if (amount < minRequired || amount > gw.maxAmount) {
      res.status(400).json({ error: `Withdrawal amount must be between $${minRequired} and $${gw.maxAmount}.` });
      return;
    }
    if (accountNumber.length < 5) {
      res.status(400).json({ error: 'Please enter your receiving account or wallet address.' });
      return;
    }
    if (user.earningBalance < amount) {
      res.status(400).json({ error: 'Insufficient Earning Balance.' });
      return;
    }

    const feeAmount = Number((amount * (gw.feePercent / 100)).toFixed(2));
    const netAmount = Number((amount - feeAmount).toFixed(2));
    user.earningBalance = Number((user.earningBalance - amount).toFixed(4));

    const wdId = allocateId(db);
    db.withdrawals.unshift({
      id: wdId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      gatewayId: gw.id,
      gatewayName: gw.name,
      amount,
      feeAmount,
      netAmount,
      accountNumber,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    db.transactions.unshift({
      id: allocateId(db),
      userId: user.id,
      type: 'withdraw',
      wallet: 'earning',
      amount: -amount,
      description: `Withdrawal #${wdId} via ${gw.name}`,
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);
    res.status(201).json({ ok: true, user: sanitizeUser(user) });
  });

  app.post('/api/wallet/transfer', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;
    const amount = Number(Number(req.body?.amount || 0).toFixed(2));
    if (amount < 0.5) {
      res.status(400).json({ error: 'Minimum transfer amount is $0.50.' });
      return;
    }
    if (user.earningBalance < amount) {
      res.status(400).json({ error: 'Insufficient Earning Balance.' });
      return;
    }
    user.earningBalance = Number((user.earningBalance - amount).toFixed(4));
    user.depositBalance = Number((user.depositBalance + amount).toFixed(4));
    db.transactions.unshift({
      id: allocateId(db),
      userId: user.id,
      type: 'transfer',
      wallet: 'deposit',
      amount,
      description: 'Transferred Earning Balance to Deposit Balance',
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);
    res.json({ user: sanitizeUser(user) });
  });

  app.get('/api/referrals', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const referredUsers = db.users
      .filter((u) => u.referredBy === req.authUser!.id)
      .map((u) => ({
        id: u.id,
        name: u.name,
        country: u.country,
        tasksCompleted: u.tasksCompleted,
        createdAt: u.createdAt,
      }));
    res.json({ referredUsers });
  });

  app.post('/api/kyc', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;
    const documentData = String(req.body?.documentData || '').trim();
    const note = String(req.body?.note || '').trim();
    if (!documentData) {
      res.status(400).json({ error: 'Please attach an ID document image.' });
      return;
    }
    try {
      user.kycDocumentUrl = saveBase64Image(documentData);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    user.kycStatus = 'pending';
    user.kycNote = note;
    saveDatabase(db);
    res.json({ user: sanitizeUser(user) });
  });

  app.get('/api/tickets', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const tickets = db.tickets.filter((t) => t.userId === req.authUser!.id).sort((a, b) => b.id - a.id);
    res.json({ tickets });
  });

  app.post('/api/tickets', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const subject = String(req.body?.subject || '').trim();
    const category = String(req.body?.category || 'General').trim() || 'General';
    const priority = ['low', 'medium', 'high'].includes(req.body?.priority) ? req.body.priority : 'medium';
    const message = String(req.body?.message || '').trim();
    if (subject.length < 3 || message.length < 5) {
      res.status(400).json({ error: 'Subject and message are required.' });
      return;
    }
    const ticketId = allocateId(db);
    const now = new Date().toISOString();
    db.tickets.unshift({
      id: ticketId,
      userId: req.authUser!.id,
      userName: req.authUser!.name,
      userEmail: req.authUser!.email,
      subject,
      category,
      priority,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      replies: [
        {
          id: allocateId(db),
          ticketId,
          senderId: req.authUser!.id,
          senderName: req.authUser!.name,
          senderRole: req.authUser!.role,
          message,
          createdAt: now,
        },
      ],
    });
    saveDatabase(db);
    res.status(201).json({ ok: true, ticketId });
  });

  app.post('/api/tickets/:id/reply', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const ticketId = Number(req.params.id);
    const message = String(req.body?.message || '').trim();
    if (!message) {
      res.status(400).json({ error: 'Reply message cannot be empty.' });
      return;
    }
    const ticket = db.tickets.find((t) => t.id === ticketId);
    if (!ticket || (ticket.userId !== req.authUser!.id && req.authUser!.role !== 'admin')) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }
    const now = new Date().toISOString();
    ticket.replies.push({
      id: allocateId(db),
      ticketId,
      senderId: req.authUser!.id,
      senderName: req.authUser!.name,
      senderRole: req.authUser!.role,
      message,
      createdAt: now,
    });
    ticket.status = req.authUser!.role === 'admin' ? 'answered' : 'open';
    ticket.updatedAt = now;
    saveDatabase(db);
    res.json({ ok: true });
  });

  // Admin Routes
  app.post('/api/admin/upload', requireAdmin, (req: AuthedRequest, res) => {
    const imageData = String(req.body?.imageData || '').trim();
    if (!imageData) {
      res.status(400).json({ error: 'Image data is required.' });
      return;
    }
    try {
      const url = saveBase64Image(imageData);
      res.json({ url });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const db = loadDatabase();
    const pendingDepositsList = db.deposits.filter((d) => d.status === 'pending');
    const approvedDepositsList = db.deposits.filter((d) => d.status === 'approved');
    const pendingWithdrawalsList = db.withdrawals.filter((w) => w.status === 'pending');
    const approvedWithdrawalsList = db.withdrawals.filter((w) => w.status === 'approved');
    const platformRevenue = db.jobs
      .filter((j) => j.status === 'active' || j.status === 'completed' || j.status === 'paused')
      .reduce((sum, j) => sum + j.platformFee, 0);
    const totalUserEarnings = db.users
      .filter((u) => u.role === 'user')
      .reduce((sum, u) => sum + u.earningBalance, 0);
    const totalUserDeposits = db.users
      .filter((u) => u.role === 'user')
      .reduce((sum, u) => sum + u.depositBalance, 0);

    res.json({
      totalUsers: db.users.filter((u) => u.role === 'user').length,
      activeJobs: db.jobs.filter((j) => j.status === 'active').length,
      pendingJobs: db.jobs.filter((j) => j.status === 'pending').length,
      pendingDeposits: pendingDepositsList.length,
      pendingDepositsAmount: Number(pendingDepositsList.reduce((s, d) => s + d.amount, 0).toFixed(2)),
      approvedDepositsAmount: Number(approvedDepositsList.reduce((s, d) => s + d.amount, 0).toFixed(2)),
      pendingWithdrawals: pendingWithdrawalsList.length,
      pendingWithdrawalsAmount: Number(pendingWithdrawalsList.reduce((s, w) => s + w.amount, 0).toFixed(2)),
      approvedWithdrawalsAmount: Number(approvedWithdrawalsList.reduce((s, w) => s + w.amount, 0).toFixed(2)),
      openTickets: db.tickets.filter((t) => t.status === 'open' || t.status === 'answered').length,
      platformRevenue: Number(platformRevenue.toFixed(2)),
      totalUserEarnings: Number(totalUserEarnings.toFixed(2)),
      totalUserDeposits: Number(totalUserDeposits.toFixed(2)),
      publishedBlogs: db.blogPosts.filter((b) => b.published).length,
      publishedPages: db.pages.filter((p) => p.published).length,
    });
  });

  app.get('/api/admin/activity', requireAdmin, (_req, res) => {
    const db = loadDatabase();
    res.json({ logs: db.activityLogs });
  });

  app.get('/api/admin/jobs', requireAdmin, (_req, res) => {
    const db = loadDatabase();
    const order = { pending: 0, active: 1, paused: 2, completed: 3, rejected: 4 };
    const jobs = [...db.jobs].sort((a, b) => order[a.status] - order[b.status] || b.id - a.id);
    res.json({ jobs });
  });

  app.post('/api/admin/jobs', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const categoryId = Number(req.body?.categoryId || 0);
    const title = String(req.body?.title || '').trim();
    const targetRegion = String(req.body?.targetRegion || 'Worldwide').trim() || 'Worldwide';
    const targetUrl = sanitizeUrl(req.body?.targetUrl);
    const steps = Array.isArray(req.body?.steps)
      ? req.body.steps.map((s: unknown) => String(s).trim()).filter(Boolean)
      : String(req.body?.stepsText || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
    const proofRequirement = String(req.body?.proofRequirement || '').trim();
    const requireScreenshot = Boolean(req.body?.requireScreenshot);
    const rewardPerWorker = Math.max(0.01, Number(Number(req.body?.rewardPerWorker || 0.1).toFixed(4)));
    const workersNeeded = Math.max(1, Math.floor(Number(req.body?.workersNeeded || 10)));
    const estimatedMinutes = Math.max(1, Math.floor(Number(req.body?.estimatedMinutes || 3)));
    const featured = Boolean(req.body?.featured);

    const category = db.categories.find((c) => c.id === categoryId);
    if (!category || title.length < 4 || steps.length === 0 || proofRequirement.length < 4) {
      res.status(400).json({ error: 'Category, title, steps, and proof requirement are required.' });
      return;
    }

    const baseCost = Number((rewardPerWorker * workersNeeded).toFixed(4));
    const jobId = allocateId(db);
    const job = {
      id: jobId,
      employerId: req.authUser!.id,
      employerName: db.settings.siteName || req.authUser!.name,
      categoryId: category.id,
      categoryName: category.name,
      categoryColor: category.color,
      title,
      targetRegion,
      targetUrl,
      steps,
      proofRequirement,
      requireScreenshot,
      rewardPerWorker,
      workersNeeded,
      workersCompleted: 0,
      platformFee: 0,
      totalBudget: baseCost,
      featured,
      status: 'active' as const,
      estimatedMinutes,
      createdAt: new Date().toISOString(),
    };
    db.jobs.unshift(job);
    logAdminAction(db, req.authUser!, 'Create Job', `Created official campaign #${jobId}: ${title}`);
    saveDatabase(db);
    res.status(201).json({ job });
  });

  app.put('/api/admin/jobs/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const job = db.jobs.find((j) => j.id === Number(req.params.id));
    if (!job) {
      res.status(404).json({ error: 'Job not found.' });
      return;
    }
    if (req.body?.categoryId) {
      const cat = db.categories.find((c) => c.id === Number(req.body.categoryId));
      if (cat) {
        job.categoryId = cat.id;
        job.categoryName = cat.name;
        job.categoryColor = cat.color;
      }
    }
    job.title = String(req.body?.title || job.title).trim();
    job.targetRegion = String(req.body?.targetRegion ?? job.targetRegion).trim();
    if (req.body?.targetUrl !== undefined) {
      job.targetUrl = sanitizeUrl(req.body.targetUrl);
    }
    if (Array.isArray(req.body?.steps)) {
      job.steps = req.body.steps.map((s: unknown) => String(s).trim()).filter(Boolean);
    }
    job.proofRequirement = String(req.body?.proofRequirement ?? job.proofRequirement).trim();
    if (req.body?.requireScreenshot !== undefined) job.requireScreenshot = Boolean(req.body.requireScreenshot);
    if (req.body?.rewardPerWorker !== undefined) {
      job.rewardPerWorker = Math.max(0.01, Number(Number(req.body.rewardPerWorker).toFixed(4)));
    }
    if (req.body?.workersNeeded !== undefined) {
      job.workersNeeded = Math.max(job.workersCompleted, Math.floor(Number(req.body.workersNeeded)));
    }
    if (['pending', 'active', 'paused', 'completed', 'rejected'].includes(req.body?.status)) {
      job.status = req.body.status;
    }
    if (req.body?.featured !== undefined) job.featured = Boolean(req.body.featured);

    logAdminAction(db, req.authUser!, 'Edit Job', `Updated campaign #${job.id}: ${job.title}`);
    saveDatabase(db);
    res.json({ job });
  });

  app.post('/api/admin/jobs/:id/decision', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const jobId = Number(req.params.id);
    const action = req.body?.action;
    const reason = String(req.body?.reason || '').trim();
    const idx = db.jobs.findIndex((j) => j.id === jobId);
    if (idx === -1) {
      res.status(404).json({ error: 'Job not found.' });
      return;
    }
    const job = db.jobs[idx];

    if (action === 'approve') {
      job.status = 'active';
      job.rejectionReason = undefined;
    } else if (action === 'pause') {
      job.status = job.status === 'paused' ? 'active' : 'paused';
    } else if (action === 'reject') {
      const wasPending = job.status === 'pending';
      job.status = 'rejected';
      job.rejectionReason = reason;
      if (wasPending) {
        const emp = db.users.find((u) => u.id === job.employerId);
        if (emp) {
          emp.depositBalance = Number((emp.depositBalance + job.totalBudget).toFixed(4));
          db.transactions.unshift({
            id: allocateId(db),
            userId: emp.id,
            type: 'job_refund',
            wallet: 'deposit',
            amount: job.totalBudget,
            description: `Refund for rejected Job #${job.id}`,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } else if (action === 'toggle_feature') {
      job.featured = !job.featured;
    } else if (action === 'delete') {
      db.jobs.splice(idx, 1);
    } else {
      res.status(400).json({ error: 'Invalid action.' });
      return;
    }
    logAdminAction(db, req.authUser!, 'Job Action', `${action} on Job #${jobId}`);
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.get('/api/admin/categories', requireAdmin, (_req, res) => {
    const db = loadDatabase();
    res.json({ categories: db.categories });
  });

  app.post('/api/admin/categories', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    db.categories.push({
      id: allocateId(db),
      name,
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.floor(Math.random() * 90 + 10)}`,
      color: String(req.body?.color || 'indigo'),
      minCpc: Math.max(0.01, Number(req.body?.minCpc || 0.05)),
      description: String(req.body?.description || ''),
      active: true,
    });
    logAdminAction(db, req.authUser!, 'Add Category', `Created category "${name}"`);
    saveDatabase(db);
    res.status(201).json({ ok: true });
  });

  app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const db = loadDatabase();
    const cat = db.categories.find((c) => c.id === Number(req.params.id));
    if (!cat) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    cat.name = String(req.body?.name || cat.name).trim();
    cat.color = String(req.body?.color || cat.color);
    cat.minCpc = Math.max(0.01, Number(req.body?.minCpc ?? cat.minCpc));
    cat.description = String(req.body?.description ?? cat.description);
    cat.active = Boolean(req.body?.active ?? cat.active);
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const db = loadDatabase();
    db.categories = db.categories.filter((c) => c.id !== Number(req.params.id));
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.get('/api/admin/deposits', requireAdmin, (_req, res) => {
    const db = loadDatabase();
    res.json({ deposits: [...db.deposits].sort((a, b) => b.id - a.id) });
  });

  app.post('/api/admin/deposits/manual', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const userId = Number(req.body?.userId || 0);
    const gatewayId = Number(req.body?.gatewayId || 0);
    const amount = Number(Number(req.body?.amount || 0).toFixed(2));
    const trxId = String(req.body?.trxId || '').trim() || `ADM-${Date.now().toString().slice(-6)}`;
    const note = String(req.body?.note || 'Manual Admin Deposit').trim();
    const targetWallet = req.body?.wallet === 'earning' ? 'earning' : 'deposit';

    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'Selected user not found.' });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Enter a positive deposit amount.' });
      return;
    }
    const gw = db.gateways.find((g) => g.id === gatewayId);
    const gatewayName = gw ? gw.name : String(req.body?.gatewayName || 'Admin Manual Credit');

    const now = new Date().toISOString();
    const depId = allocateId(db);
    db.deposits.unshift({
      id: depId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      gatewayId: gw ? gw.id : 0,
      gatewayName,
      amount,
      trxId,
      status: 'approved',
      adminNote: note,
      createdAt: now,
      processedAt: now,
    });

    if (targetWallet === 'earning') {
      user.earningBalance = Number((user.earningBalance + amount).toFixed(4));
    } else {
      user.depositBalance = Number((user.depositBalance + amount).toFixed(4));
    }
    db.transactions.unshift({
      id: allocateId(db),
      userId: user.id,
      type: 'deposit',
      wallet: targetWallet,
      amount,
      description: `Manual Deposit via ${gatewayName} (${trxId})`,
      createdAt: now,
    });
    logAdminAction(
      db,
      req.authUser!,
      'Manual Deposit',
      `Credited $${amount.toFixed(2)} (${targetWallet}) to ${user.name} via ${gatewayName}`
    );
    saveDatabase(db);
    res.status(201).json({ ok: true, depositId: depId });
  });

  app.post('/api/admin/deposits/:id/decision', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const dep = db.deposits.find((d) => d.id === Number(req.params.id));
    if (!dep || dep.status !== 'pending') {
      res.status(404).json({ error: 'Pending deposit not found.' });
      return;
    }
    const decision = req.body?.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ error: 'Invalid decision.' });
      return;
    }
    dep.status = decision;
    dep.adminNote = String(req.body?.note || '').trim();
    dep.processedAt = new Date().toISOString();

    if (decision === 'approved') {
      const user = db.users.find((u) => u.id === dep.userId);
      if (user) {
        user.depositBalance = Number((user.depositBalance + dep.amount).toFixed(4));
        db.transactions.unshift({
          id: allocateId(db),
          userId: user.id,
          type: 'deposit',
          wallet: 'deposit',
          amount: dep.amount,
          description: `Approved Deposit via ${dep.gatewayName} (${dep.trxId})`,
          createdAt: new Date().toISOString(),
        });
      }
    }
    logAdminAction(db, req.authUser!, 'Deposit Decision', `${decision} deposit #${dep.id} ($${dep.amount})`);
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.get('/api/admin/withdrawals', requireAdmin, (_req, res) => {
    const db = loadDatabase();
    res.json({ withdrawals: [...db.withdrawals].sort((a, b) => b.id - a.id) });
  });

  app.post('/api/admin/withdrawals/manual', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const userId = Number(req.body?.userId || 0);
    const gatewayId = Number(req.body?.gatewayId || 0);
    const amount = Number(Number(req.body?.amount || 0).toFixed(2));
    const accountNumber = String(req.body?.accountNumber || '').trim();
    const note = String(req.body?.note || 'Manual Admin Payout').trim();

    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'Selected user not found.' });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Enter a positive withdrawal amount.' });
      return;
    }
    if (user.earningBalance < amount) {
      res.status(400).json({ error: 'User does not have enough Earning Balance for this payout.' });
      return;
    }
    if (accountNumber.length < 3) {
      res.status(400).json({ error: 'Enter a receiving account or reference.' });
      return;
    }

    const gw = db.gateways.find((g) => g.id === gatewayId);
    const gatewayName = gw ? gw.name : 'Manual Payout';
    const feePercent = gw ? gw.feePercent : 0;
    const feeAmount = Number((amount * (feePercent / 100)).toFixed(2));
    const netAmount = Number((amount - feeAmount).toFixed(2));

    user.earningBalance = Number((user.earningBalance - amount).toFixed(4));
    const now = new Date().toISOString();
    const wdId = allocateId(db);

    db.withdrawals.unshift({
      id: wdId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      gatewayId: gw ? gw.id : 0,
      gatewayName,
      amount,
      feeAmount,
      netAmount,
      accountNumber,
      status: 'approved',
      adminNote: note,
      createdAt: now,
      processedAt: now,
    });
    db.transactions.unshift({
      id: allocateId(db),
      userId: user.id,
      type: 'withdraw',
      wallet: 'earning',
      amount: -amount,
      description: `Manual Payout #${wdId} via ${gatewayName} (${accountNumber})`,
      createdAt: now,
    });
    logAdminAction(
      db,
      req.authUser!,
      'Manual Payout',
      `Issued $${amount.toFixed(2)} payout to ${user.name} via ${gatewayName}`
    );
    saveDatabase(db);
    res.status(201).json({ ok: true, withdrawalId: wdId });
  });

  app.post('/api/admin/withdrawals/:id/decision', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const wd = db.withdrawals.find((w) => w.id === Number(req.params.id));
    if (!wd || wd.status !== 'pending') {
      res.status(404).json({ error: 'Pending withdrawal not found.' });
      return;
    }
    const decision = req.body?.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ error: 'Invalid decision.' });
      return;
    }
    wd.status = decision;
    wd.adminNote = String(req.body?.note || '').trim();
    wd.processedAt = new Date().toISOString();

    if (decision === 'rejected') {
      const user = db.users.find((u) => u.id === wd.userId);
      if (user) {
        user.earningBalance = Number((user.earningBalance + wd.amount).toFixed(4));
        db.transactions.unshift({
          id: allocateId(db),
          userId: user.id,
          type: 'admin_adjust',
          wallet: 'earning',
          amount: wd.amount,
          description: `Refunded rejected withdrawal #${wd.id}`,
          createdAt: new Date().toISOString(),
        });
      }
    }
    logAdminAction(db, req.authUser!, 'Withdrawal Decision', `${decision} payout #${wd.id} ($${wd.amount})`);
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.get('/api/admin/users', requireAdmin, (_req, res) => {
    const db = loadDatabase();
    res.json({ users: db.users.map(sanitizeUser).sort((a, b) => b.id - a.id) });
  });

  app.get('/api/admin/users/:id/activity', requireAdmin, (req, res) => {
    const db = loadDatabase();
    const uid = Number(req.params.id);
    const transactions = db.transactions.filter((t) => t.userId === uid).sort((a, b) => b.id - a.id).slice(0, 25);
    const proofs = db.proofs.filter((p) => p.workerId === uid).sort((a, b) => b.id - a.id).slice(0, 15);
    res.json({ transactions, proofs });
  });

  app.post('/api/admin/users', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const name = String(req.body?.name || '').trim();
    const username = String(req.body?.username || name).trim();
    const phone = String(req.body?.phone || '').replace(/[^\d+]/g, '').trim();
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const country = String(req.body?.country || 'Bangladesh').trim() || 'Bangladesh';
    const role = req.body?.role === 'admin' ? 'admin' : 'user';
    const kycStatus = ['unverified', 'pending', 'verified', 'rejected'].includes(req.body?.kycStatus)
      ? req.body.kycStatus
      : 'unverified';
    const earningBalance = Math.max(0, Number(req.body?.earningBalance || 0));
    const depositBalance = Math.max(0, Number(req.body?.depositBalance || 0));

    if (username.length < 2 || password.length < 6 || (!phone && !rawEmail)) {
      res.status(400).json({ error: 'Name/Username, Password (6+ chars), and Phone or Email are required.' });
      return;
    }
    const email = rawEmail && rawEmail.includes('@') ? rawEmail : `${phone.replace(/\+/g, '')}@miniworkers.user`;
    if (phone && db.users.some((u) => u.phone === phone)) {
      res.status(409).json({ error: 'Phone number already exists.' });
      return;
    }
    if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      res.status(409).json({ error: 'Username already taken.' });
      return;
    }
    if (db.users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'Email already exists.' });
      return;
    }

    const prefix = username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'USER';
    const newUser: StoredUser = {
      id: allocateId(db),
      name: name || username,
      username,
      phone,
      email,
      country,
      role,
      status: 'active',
      kycStatus,
      earningBalance,
      depositBalance,
      referralCode: `${prefix}${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      referredBy: null,
      referralEarned: 0,
      tasksCompleted: 0,
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(password),
    };
    db.users.push(newUser);
    logAdminAction(db, req.authUser!, 'Create User', `Created user ${newUser.name} (@${newUser.username})`);
    saveDatabase(db);
    res.status(201).json({ user: sanitizeUser(newUser) });
  });

  app.post('/api/admin/users/:id/update', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const user = db.users.find((u) => u.id === Number(req.params.id));
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (typeof req.body?.name === 'string' && req.body.name.trim().length >= 2) {
      user.name = req.body.name.trim();
    }
    if (typeof req.body?.username === 'string' && req.body.username.trim().length >= 2) {
      const nextU = req.body.username.trim();
      if (db.users.some((u) => u.id !== user.id && u.username.toLowerCase() === nextU.toLowerCase())) {
        res.status(409).json({ error: 'Username already taken by another user.' });
        return;
      }
      user.username = nextU;
    }
    if (typeof req.body?.phone === 'string') {
      const nextP = req.body.phone.replace(/[^\d+]/g, '').trim();
      if (nextP && db.users.some((u) => u.id !== user.id && u.phone === nextP)) {
        res.status(409).json({ error: 'Phone number already exists.' });
        return;
      }
      user.phone = nextP;
    }
    if (typeof req.body?.email === 'string' && req.body.email.includes('@')) {
      const nextE = req.body.email.trim().toLowerCase();
      if (db.users.some((u) => u.id !== user.id && u.email === nextE)) {
        res.status(409).json({ error: 'Email already used by another user.' });
        return;
      }
      user.email = nextE;
    }
    if (typeof req.body?.country === 'string' && req.body.country.trim()) {
      user.country = req.body.country.trim();
    }
    if ((req.body?.role === 'user' || req.body?.role === 'admin') && user.id !== req.authUser!.id) {
      user.role = req.body.role;
    }
    if (req.body?.status === 'active' || req.body?.status === 'banned') {
      if (user.id !== req.authUser!.id) {
        user.status = req.body.status;
      }
    }
    if (['unverified', 'pending', 'verified', 'rejected'].includes(req.body?.kycStatus)) {
      user.kycStatus = req.body.kycStatus;
    }
    if (typeof req.body?.newPassword === 'string' && req.body.newPassword.length >= 6) {
      user.passwordHash = hashPassword(req.body.newPassword);
    }
    const adjustAmount = Number(req.body?.adjustAmount || 0);
    if (adjustAmount !== 0 && Number.isFinite(adjustAmount)) {
      const wallet = req.body?.adjustWallet === 'earning' ? 'earning' : 'deposit';
      if (wallet === 'earning') {
        user.earningBalance = Math.max(0, Number((user.earningBalance + adjustAmount).toFixed(4)));
      } else {
        user.depositBalance = Math.max(0, Number((user.depositBalance + adjustAmount).toFixed(4)));
      }
      db.transactions.unshift({
        id: allocateId(db),
        userId: user.id,
        type: 'admin_adjust',
        wallet,
        amount: adjustAmount,
        description: String(req.body?.adjustNote || 'Admin balance adjustment'),
        createdAt: new Date().toISOString(),
      });
    }
    logAdminAction(db, req.authUser!, 'Update User', `Updated profile/account for ${user.name} (#${user.id})`);
    saveDatabase(db);
    res.json({ ok: true, user: sanitizeUser(user) });
  });

  app.delete('/api/admin/users/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const uid = Number(req.params.id);
    if (uid === req.authUser!.id) {
      res.status(400).json({ error: 'You cannot delete your own active Admin account.' });
      return;
    }
    const idx = db.users.findIndex((u) => u.id === uid);
    if (idx === -1) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const [removed] = db.users.splice(idx, 1);
    logAdminAction(db, req.authUser!, 'Delete User', `Removed account #${uid} (${removed.name})`);
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.get('/api/admin/gateways', requireAdmin, (_req, res) => {
    const db = loadDatabase();
    res.json({ gateways: db.gateways });
  });

  app.post('/api/admin/gateways', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'Gateway name is required.' });
      return;
    }
    db.gateways.push({
      id: allocateId(db),
      name,
      code: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      type: ['deposit', 'withdraw', 'both'].includes(req.body?.type) ? req.body.type : 'both',
      accountDetails: String(req.body?.accountDetails || ''),
      instructions: String(req.body?.instructions || ''),
      minAmount: Number(req.body?.minAmount || 1),
      maxAmount: Number(req.body?.maxAmount || 1000),
      feePercent: Number(req.body?.feePercent || 0),
      color: String(req.body?.color || 'indigo'),
      active: true,
    });
    logAdminAction(db, req.authUser!, 'Add Gateway', `Added payment gateway "${name}"`);
    saveDatabase(db);
    res.status(201).json({ ok: true });
  });

  app.put('/api/admin/gateways/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const gw = db.gateways.find((g) => g.id === Number(req.params.id));
    if (!gw) {
      res.status(404).json({ error: 'Gateway not found.' });
      return;
    }
    gw.name = String(req.body?.name || gw.name).trim();
    gw.type = ['deposit', 'withdraw', 'both'].includes(req.body?.type) ? req.body.type : gw.type;
    gw.accountDetails = String(req.body?.accountDetails ?? gw.accountDetails);
    gw.instructions = String(req.body?.instructions ?? gw.instructions);
    gw.minAmount = Number(req.body?.minAmount ?? gw.minAmount);
    gw.maxAmount = Number(req.body?.maxAmount ?? gw.maxAmount);
    gw.feePercent = Number(req.body?.feePercent ?? gw.feePercent);
    gw.color = String(req.body?.color || gw.color);
    gw.active = Boolean(req.body?.active ?? gw.active);
    logAdminAction(db, req.authUser!, 'Update Gateway', `Updated payment gateway "${gw.name}"`);
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.delete('/api/admin/gateways/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    db.gateways = db.gateways.filter((g) => g.id !== Number(req.params.id));
    logAdminAction(db, req.authUser!, 'Delete Gateway', `Deleted gateway #${req.params.id}`);
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.get('/api/admin/tickets', requireAdmin, (_req, res) => {
    const db = loadDatabase();
    res.json({ tickets: [...db.tickets].sort((a, b) => b.id - a.id) });
  });

  app.post('/api/admin/tickets/:id/status', requireAdmin, (req, res) => {
    const db = loadDatabase();
    const ticket = db.tickets.find((t) => t.id === Number(req.params.id));
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }
    if (['open', 'answered', 'resolved', 'closed'].includes(req.body?.status)) {
      ticket.status = req.body.status;
      ticket.updatedAt = new Date().toISOString();
    }
    saveDatabase(db);
    res.json({ ok: true });
  });

  // Blog CMS Routes
  app.get('/api/admin/blog', requireAdmin, (_req, res) => {
    const db = loadDatabase();
    res.json({ posts: [...db.blogPosts].sort((a, b) => b.id - a.id) });
  });

  app.post('/api/admin/blog', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    if (title.length < 3 || content.length < 10) {
      res.status(400).json({ error: 'Blog title and content are required.' });
      return;
    }
    const now = new Date().toISOString();
    const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'post';
    const post = {
      id: allocateId(db),
      title,
      slug: `${slugBase}-${Math.floor(Math.random() * 900 + 100)}`,
      category: String(req.body?.category || 'Updates').trim() || 'Updates',
      excerpt: String(req.body?.excerpt || content.slice(0, 140)).trim(),
      content,
      coverImageUrl: sanitizeUrl(req.body?.coverImageUrl) || '/src/assets/images/category_social_media_1795645722524.jpg',
      authorName: String(req.body?.authorName || req.authUser!.name).trim(),
      featured: Boolean(req.body?.featured),
      published: req.body?.published !== undefined ? Boolean(req.body.published) : true,
      createdAt: now,
      updatedAt: now,
    };
    db.blogPosts.unshift(post);
    logAdminAction(db, req.authUser!, 'Create Blog Post', `Published/saved article "${post.title}"`);
    saveDatabase(db);
    res.status(201).json({ post });
  });

  app.put('/api/admin/blog/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const post = db.blogPosts.find((p) => p.id === Number(req.params.id));
    if (!post) {
      res.status(404).json({ error: 'Blog post not found.' });
      return;
    }
    post.title = String(req.body?.title || post.title).trim();
    post.category = String(req.body?.category ?? post.category).trim();
    post.excerpt = String(req.body?.excerpt ?? post.excerpt).trim();
    post.content = String(req.body?.content ?? post.content).trim();
    if (req.body?.coverImageUrl !== undefined) {
      post.coverImageUrl = sanitizeUrl(req.body.coverImageUrl) || post.coverImageUrl;
    }
    if (req.body?.authorName !== undefined) post.authorName = String(req.body.authorName).trim();
    if (req.body?.featured !== undefined) post.featured = Boolean(req.body.featured);
    if (req.body?.published !== undefined) post.published = Boolean(req.body.published);
    post.updatedAt = new Date().toISOString();
    logAdminAction(db, req.authUser!, 'Update Blog Post', `Updated article "${post.title}"`);
    saveDatabase(db);
    res.json({ post });
  });

  app.delete('/api/admin/blog/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    db.blogPosts = db.blogPosts.filter((p) => p.id !== Number(req.params.id));
    logAdminAction(db, req.authUser!, 'Delete Blog Post', `Deleted article #${req.params.id}`);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // Custom Pages CMS Routes
  app.get('/api/admin/pages', requireAdmin, (_req, res) => {
    const db = loadDatabase();
    res.json({ pages: db.pages });
  });

  app.post('/api/admin/pages', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    if (title.length < 2 || content.length < 5) {
      res.status(400).json({ error: 'Page title and content are required.' });
      return;
    }
    const rawSlug = String(req.body?.slug || title)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '');
    const slug = rawSlug || `page-${Date.now()}`;
    if (db.pages.some((p) => p.slug === slug)) {
      res.status(409).json({ error: 'A page with this URL slug already exists.' });
      return;
    }
    const page = {
      id: allocateId(db),
      title,
      slug,
      summary: String(req.body?.summary || '').trim(),
      content,
      showInHeader: Boolean(req.body?.showInHeader),
      showInFooter: req.body?.showInFooter !== undefined ? Boolean(req.body.showInFooter) : true,
      published: req.body?.published !== undefined ? Boolean(req.body.published) : true,
      updatedAt: new Date().toISOString(),
    };
    db.pages.push(page);
    logAdminAction(db, req.authUser!, 'Create CMS Page', `Created page /${page.slug}`);
    saveDatabase(db);
    res.status(201).json({ page });
  });

  app.put('/api/admin/pages/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const page = db.pages.find((p) => p.id === Number(req.params.id));
    if (!page) {
      res.status(404).json({ error: 'Page not found.' });
      return;
    }
    page.title = String(req.body?.title || page.title).trim();
    if (typeof req.body?.slug === 'string' && req.body.slug.trim()) {
      const nextSlug = req.body.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-|-$/g, '');
      if (nextSlug && !db.pages.some((p) => p.id !== page.id && p.slug === nextSlug)) {
        page.slug = nextSlug;
      }
    }
    page.summary = String(req.body?.summary ?? page.summary).trim();
    page.content = String(req.body?.content ?? page.content).trim();
    if (req.body?.showInHeader !== undefined) page.showInHeader = Boolean(req.body.showInHeader);
    if (req.body?.showInFooter !== undefined) page.showInFooter = Boolean(req.body.showInFooter);
    if (req.body?.published !== undefined) page.published = Boolean(req.body.published);
    page.updatedAt = new Date().toISOString();
    logAdminAction(db, req.authUser!, 'Update CMS Page', `Updated page "${page.title}"`);
    saveDatabase(db);
    res.json({ page });
  });

  app.delete('/api/admin/pages/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    db.pages = db.pages.filter((p) => p.id !== Number(req.params.id));
    logAdminAction(db, req.authUser!, 'Delete CMS Page', `Deleted page #${req.params.id}`);
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.get('/api/admin/settings', requireAdmin, (_req, res) => {
    const db = loadDatabase();
    res.json({ settings: db.settings });
  });

  app.put('/api/admin/settings', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const validThemes = ['indigo', 'violet', 'emerald', 'rose', 'amber', 'sky'] as const;
    const accentTheme = validThemes.includes(req.body?.accentTheme)
      ? req.body.accentTheme
      : db.settings.accentTheme;

    db.settings = {
      siteName: String(req.body?.siteName || db.settings.siteName).trim(),
      tagline: String(req.body?.tagline ?? db.settings.tagline).trim(),
      logoUrl: req.body?.logoUrl !== undefined ? sanitizeUrl(req.body.logoUrl) : db.settings.logoUrl,
      accentTheme,
      currencySymbol: String(req.body?.currencySymbol || db.settings.currencySymbol).trim(),
      platformFeePercent: Math.max(0, Number(req.body?.platformFeePercent ?? db.settings.platformFeePercent)),
      referralCommissionPercent: Math.max(
        0,
        Number(req.body?.referralCommissionPercent ?? db.settings.referralCommissionPercent)
      ),
      minJobWorkers: Math.max(1, Math.floor(Number(req.body?.minJobWorkers ?? db.settings.minJobWorkers))),
      minWithdrawAmount: Math.max(0.5, Number(req.body?.minWithdrawAmount ?? db.settings.minWithdrawAmount)),
      autoApproveJobs: Boolean(req.body?.autoApproveJobs ?? db.settings.autoApproveJobs),
      allowRegistration:
        req.body?.allowRegistration !== undefined ? Boolean(req.body.allowRegistration) : db.settings.allowRegistration,
      maintenanceMode:
        req.body?.maintenanceMode !== undefined ? Boolean(req.body.maintenanceMode) : db.settings.maintenanceMode,
      maintenanceMessage: String(req.body?.maintenanceMessage ?? db.settings.maintenanceMessage).trim(),
      noticeBanner: String(req.body?.noticeBanner ?? db.settings.noticeBanner).trim(),
      supportEmail: String(req.body?.supportEmail ?? db.settings.supportEmail).trim(),
      heroKicker: String(req.body?.heroKicker ?? db.settings.heroKicker).trim(),
      heroTitle: String(req.body?.heroTitle ?? db.settings.heroTitle).trim(),
      heroSubtitle: String(req.body?.heroSubtitle ?? db.settings.heroSubtitle).trim(),
      heroPrimaryCta: String(req.body?.heroPrimaryCta ?? db.settings.heroPrimaryCta).trim(),
      heroSecondaryCta: String(req.body?.heroSecondaryCta ?? db.settings.heroSecondaryCta).trim(),
      heroImageUrl:
        req.body?.heroImageUrl !== undefined
          ? sanitizeUrl(req.body.heroImageUrl) || db.settings.heroImageUrl
          : db.settings.heroImageUrl,
      showStatsStrip:
        req.body?.showStatsStrip !== undefined ? Boolean(req.body.showStatsStrip) : db.settings.showStatsStrip,
      showHowItWorks:
        req.body?.showHowItWorks !== undefined ? Boolean(req.body.showHowItWorks) : db.settings.showHowItWorks,
      showBlogSection:
        req.body?.showBlogSection !== undefined ? Boolean(req.body.showBlogSection) : db.settings.showBlogSection,
      founderName: String(req.body?.founderName ?? db.settings.founderName).trim(),
      founderRole: String(req.body?.founderRole ?? db.settings.founderRole).trim(),
      founderQuote: String(req.body?.founderQuote ?? db.settings.founderQuote).trim(),
      footerText: String(req.body?.footerText ?? db.settings.footerText).trim(),
    };
    logAdminAction(db, req.authUser!, 'Update Website Settings', `Saved settings for ${db.settings.siteName}`);
    saveDatabase(db);
    res.json({ settings: db.settings });
  });

  // Vite Dev Middleware or Static Production Build
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MiniWorkers server listening on http://localhost:${PORT}`);
  });
}

startServer();

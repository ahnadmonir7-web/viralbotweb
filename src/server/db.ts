import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  Category,
  DepositRequest,
  Gateway,
  JobProof,
  MicroJob,
  SiteSettings,
  SupportTicket,
  User,
  WalletTransaction,
  WithdrawRequest,
} from '../types.ts';

export interface StoredUser extends User {
  passwordHash: string;
}

export interface DatabaseState {
  nextId: number;
  adminClaimed: boolean;
  settings: SiteSettings;
  users: StoredUser[];
  categories: Category[];
  jobs: MicroJob[];
  proofs: JobProof[];
  gateways: Gateway[];
  deposits: DepositRequest[];
  withdrawals: WithdrawRequest[];
  transactions: WalletTransaction[];
  tickets: SupportTicket[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function createInitialState(): DatabaseState {
  const now = new Date().toISOString();
  const demoWorkerHash = hashPassword('worker123');

  const categories: Category[] = [
    {
      id: 1,
      name: 'YouTube & Video',
      slug: 'youtube-video',
      color: 'rose',
      minCpc: 0.04,
      description: 'Watch time, channel subscriptions, and genuine video comments.',
      active: true,
    },
    {
      id: 2,
      name: 'Social Media',
      slug: 'social-media',
      color: 'indigo',
      minCpc: 0.03,
      description: 'Follows, shares, page likes, and community engagement.',
      active: true,
    },
    {
      id: 3,
      name: 'App Testing & Signups',
      slug: 'app-testing',
      color: 'emerald',
      minCpc: 0.12,
      description: 'Install Android/iOS apps, test onboarding flows, and report UI bugs.',
      active: true,
    },
    {
      id: 4,
      name: 'Website Visit & SEO',
      slug: 'website-seo',
      color: 'sky',
      minCpc: 0.04,
      description: 'Organic search clicks, article reading, and dwell-time verification.',
      active: true,
    },
    {
      id: 5,
      name: 'Surveys & Feedback',
      slug: 'surveys',
      color: 'amber',
      minCpc: 0.15,
      description: 'Short product questionnaires and UX feedback polls.',
      active: true,
    },
    {
      id: 6,
      name: 'Data Entry & Writing',
      slug: 'data-entry',
      color: 'violet',
      minCpc: 0.10,
      description: 'Categorize listings, verify contacts, or write short reviews.',
      active: true,
    },
  ];

  const gateways: Gateway[] = [
    {
      id: 1,
      name: 'bKash (Personal / Merchant)',
      code: 'bkash',
      type: 'both',
      accountDetails: '01700-000000 (Send Money)',
      instructions: 'Send funds via bKash Send Money, then enter your 10-digit TrxID and upload a screenshot.',
      minAmount: 2,
      maxAmount: 500,
      feePercent: 2,
      color: 'rose',
      active: true,
    },
    {
      id: 2,
      name: 'Nagad Wallet',
      code: 'nagad',
      type: 'both',
      accountDetails: '01800-000000 (Personal)',
      instructions: 'Transfer via Nagad App and submit your Transaction ID below for fast verification.',
      minAmount: 2,
      maxAmount: 500,
      feePercent: 1.5,
      color: 'amber',
      active: true,
    },
    {
      id: 3,
      name: 'Binance Pay / USDT (TRC20)',
      code: 'usdt',
      type: 'both',
      accountDetails: 'Binance Pay ID: 284910442 · TRC20: TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
      instructions: 'Send exact USDT amount via Binance Pay or TRC20 network and paste the Order/Tx Hash.',
      minAmount: 5,
      maxAmount: 5000,
      feePercent: 1,
      color: 'emerald',
      active: true,
    },
    {
      id: 4,
      name: 'PayPal Instant',
      code: 'paypal',
      type: 'both',
      accountDetails: 'billing@viralbolt.example',
      instructions: 'Send as Goods/Services or enter your PayPal email for withdrawals.',
      minAmount: 5,
      maxAmount: 2000,
      feePercent: 3.5,
      color: 'sky',
      active: true,
    },
  ];

  const users: StoredUser[] = [
    {
      id: 101,
      name: 'Arif Rahman',
      username: 'arif_rahman',
      phone: '01711000001',
      email: 'arif@demo.com',
      country: 'Bangladesh',
      role: 'user',
      status: 'active',
      kycStatus: 'verified',
      earningBalance: 18.45,
      depositBalance: 42.0,
      referralCode: 'ARIF2026',
      referredBy: null,
      referralEarned: 2.35,
      tasksCompleted: 34,
      createdAt: now,
      passwordHash: demoWorkerHash,
    },
    {
      id: 102,
      name: 'Nadia Islam',
      username: 'nadia_islam',
      phone: '01811000002',
      email: 'nadia@demo.com',
      country: 'Bangladesh',
      role: 'user',
      status: 'active',
      kycStatus: 'unverified',
      earningBalance: 6.20,
      depositBalance: 15.0,
      referralCode: 'NADIA88',
      referredBy: 101,
      referralEarned: 0,
      tasksCompleted: 12,
      createdAt: now,
      passwordHash: demoWorkerHash,
    },
  ];

  const jobs: MicroJob[] = [
    {
      id: 201,
      employerId: 101,
      employerName: 'Arif Rahman',
      categoryId: 1,
      categoryName: 'YouTube & Video',
      categoryColor: 'rose',
      title: 'Watch 3-Minute Tech Review Video & Leave Constructive Comment',
      targetRegion: 'Worldwide',
      targetUrl: 'https://youtube.com',
      steps: [
        'Open YouTube and search for "Minimal Desk Setup Tour 2026".',
        'Watch at least 3 minutes of the video without skipping.',
        'Like the video and write a genuine 1-sentence comment about the desk lighting.',
      ],
      proofRequirement: 'Provide your YouTube handle and upload a screenshot showing the timestamp at 3:00+ with your comment visible.',
      requireScreenshot: true,
      rewardPerWorker: 0.12,
      workersNeeded: 120,
      workersCompleted: 78,
      platformFee: 0.72,
      totalBudget: 15.12,
      featured: true,
      status: 'active',
      estimatedMinutes: 4,
      createdAt: now,
    },
    {
      id: 202,
      employerId: 101,
      employerName: 'Arif Rahman',
      categoryId: 3,
      categoryName: 'App Testing & Signups',
      categoryColor: 'emerald',
      title: 'Test Habit Tracker Mobile Web App & Submit Onboarding Feedback',
      targetRegion: 'Asia & Europe',
      targetUrl: 'https://example.com/habit-app',
      steps: [
        'Visit the test link and create a free demo workspace.',
        'Add 2 sample daily habits and mark one complete.',
        'Note any layout issues on your screen size.',
      ],
      proofRequirement: 'Submit the email username you tested with plus 2 sentences of honest UX feedback.',
      requireScreenshot: true,
      rewardPerWorker: 0.35,
      workersNeeded: 60,
      workersCompleted: 31,
      platformFee: 1.05,
      totalBudget: 22.05,
      featured: true,
      status: 'active',
      estimatedMinutes: 6,
      createdAt: now,
    },
    {
      id: 203,
      employerId: 102,
      employerName: 'Nadia Islam',
      categoryId: 2,
      categoryName: 'Social Media',
      categoryColor: 'indigo',
      title: 'Follow Design Studio Instagram Page & Save Latest Carousel Post',
      targetRegion: 'Worldwide',
      targetUrl: 'https://instagram.com',
      steps: [
        'Open the target Instagram profile using the provided link.',
        'Tap Follow and like the pinned branding carousel.',
        'Save the post to your bookmarks.',
      ],
      proofRequirement: 'Enter your Instagram username and attach a screenshot confirming Follow + Save.',
      requireScreenshot: true,
      rewardPerWorker: 0.08,
      workersNeeded: 200,
      workersCompleted: 144,
      platformFee: 0.80,
      totalBudget: 16.80,
      featured: false,
      status: 'active',
      estimatedMinutes: 2,
      createdAt: now,
    },
    {
      id: 204,
      employerId: 101,
      employerName: 'Arif Rahman',
      categoryId: 4,
      categoryName: 'Website Visit & SEO',
      categoryColor: 'sky',
      title: 'Read Cloud Hosting Comparison Article & Find Promo Code',
      targetRegion: 'Worldwide',
      targetUrl: 'https://example.com/cloud-guide',
      steps: [
        'Search Google for "Best Shared cPanel Hosting Guide 2026".',
        'Scroll down slowly through the full article (at least 90 seconds).',
        'Locate the green summary box at the bottom.',
      ],
      proofRequirement: 'Paste the last 3 words of the summary box and the article URL.',
      requireScreenshot: false,
      rewardPerWorker: 0.09,
      workersNeeded: 150,
      workersCompleted: 64,
      platformFee: 0.68,
      totalBudget: 14.18,
      featured: false,
      status: 'active',
      estimatedMinutes: 3,
      createdAt: now,
    },
    {
      id: 205,
      employerId: 102,
      employerName: 'Nadia Islam',
      categoryId: 5,
      categoryName: 'Surveys & Feedback',
      categoryColor: 'amber',
      title: '5-Question E-Commerce Checkout Experience Survey',
      targetRegion: 'Bangladesh, India, USA',
      targetUrl: 'https://example.com/survey',
      steps: [
        'Open the short 5-question form.',
        'Answer all questions thoughtfully based on your online shopping habits.',
        'Copy the completion code shown on the final screen.',
      ],
      proofRequirement: 'Paste the 8-character completion code from the thank-you screen.',
      requireScreenshot: false,
      rewardPerWorker: 0.25,
      workersNeeded: 80,
      workersCompleted: 45,
      platformFee: 1.0,
      totalBudget: 21.0,
      featured: true,
      status: 'active',
      estimatedMinutes: 4,
      createdAt: now,
    },
    {
      id: 206,
      employerId: 101,
      employerName: 'Arif Rahman',
      categoryId: 6,
      categoryName: 'Data Entry & Writing',
      categoryColor: 'violet',
      title: 'Verify 5 Local Café Opening Hours from Official Websites',
      targetRegion: 'Worldwide',
      targetUrl: 'https://example.com/directory',
      steps: [
        'Open the 5 listed café links from the task brief.',
        'Check each café’s current Friday opening and closing hours.',
        'Format them cleanly as "Name: 08:00 - 22:00".',
      ],
      proofRequirement: 'Paste the formatted 5-line schedule in the proof box.',
      requireScreenshot: false,
      rewardPerWorker: 0.40,
      workersNeeded: 40,
      workersCompleted: 18,
      platformFee: 0.80,
      totalBudget: 16.80,
      featured: false,
      status: 'active',
      estimatedMinutes: 7,
      createdAt: now,
    },
  ];

  const proofs: JobProof[] = [
    {
      id: 301,
      jobId: 201,
      jobTitle: 'Watch 3-Minute Tech Review Video & Leave Constructive Comment',
      workerId: 102,
      workerName: 'Nadia Islam',
      employerId: 101,
      rewardAmount: 0.12,
      proofText: 'Watched 3m 25s via @nadia_tech and commented on the warm desk lamp tone.',
      status: 'approved',
      reviewNote: 'Verified comment and watch time. Great work!',
      createdAt: now,
      reviewedAt: now,
    },
    {
      id: 302,
      jobId: 202,
      jobTitle: 'Test Habit Tracker Mobile Web App & Submit Onboarding Feedback',
      workerId: 102,
      workerName: 'Nadia Islam',
      employerId: 101,
      rewardAmount: 0.35,
      proofText: 'Tested as nadia.qa@demo.com on Chrome Android. Add Habit modal worked smoothly; dark text in footer was clear.',
      status: 'pending',
      createdAt: now,
    },
  ];

  const transactions: WalletTransaction[] = [
    {
      id: 401,
      userId: 101,
      type: 'deposit',
      wallet: 'deposit',
      amount: 50.0,
      description: 'Approved Deposit via bKash (TrxID: BKX904218)',
      createdAt: now,
    },
    {
      id: 402,
      userId: 101,
      type: 'earning',
      wallet: 'earning',
      amount: 18.45,
      description: 'Completed 34 verified micro-tasks',
      createdAt: now,
    },
    {
      id: 403,
      userId: 102,
      type: 'earning',
      wallet: 'earning',
      amount: 0.12,
      description: 'Task #201 Approved: Watch 3-Minute Tech Review Video',
      createdAt: now,
    },
  ];

  const deposits: DepositRequest[] = [
    {
      id: 501,
      userId: 102,
      userName: 'Nadia Islam',
      userEmail: 'nadia@demo.com',
      gatewayId: 1,
      gatewayName: 'bKash (Personal / Merchant)',
      amount: 20.0,
      trxId: 'BKH7742091A',
      status: 'pending',
      createdAt: now,
    },
  ];

  const withdrawals: WithdrawRequest[] = [
    {
      id: 601,
      userId: 101,
      userName: 'Arif Rahman',
      userEmail: 'arif@demo.com',
      gatewayId: 2,
      gatewayName: 'Nagad Wallet',
      amount: 10.0,
      feeAmount: 0.15,
      netAmount: 9.85,
      accountNumber: '01811-223344',
      status: 'pending',
      createdAt: now,
    },
  ];

  const tickets: SupportTicket[] = [
    {
      id: 701,
      userId: 102,
      userName: 'Nadia Islam',
      userEmail: 'nadia@demo.com',
      subject: 'Question about KYC verification speed',
      category: 'Account & KYC',
      priority: 'medium',
      status: 'open',
      createdAt: now,
      updatedAt: now,
      replies: [
        {
          id: 801,
          ticketId: 701,
          senderId: 102,
          senderName: 'Nadia Islam',
          senderRole: 'user',
          message: 'Hello team, how long does KYC approval usually take after submitting my ID?',
          createdAt: now,
        },
      ],
    },
  ];

  return {
    nextId: 1000,
    adminClaimed: false,
    settings: {
      siteName: 'Viral Bolt',
      currencySymbol: '$',
      platformFeePercent: 5,
      referralCommissionPercent: 5,
      minJobWorkers: 10,
      autoApproveJobs: false,
      noticeBanner: 'Welcome to Viral Bolt! Complete verified micro-tasks daily or launch human-powered campaigns with instant proof tracking.',
      supportEmail: 'support@viralbolt.example',
    },
    users,
    categories,
    jobs,
    proofs,
    gateways,
    deposits,
    withdrawals,
    transactions,
    tickets,
  };
}

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export function loadDatabase(): DatabaseState {
  ensureDirectories();
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialState();
    saveDatabase(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const state = JSON.parse(raw) as DatabaseState;
    let mutated = false;
    if (state.settings?.siteName === 'MiniWorkers') {
      state.settings.siteName = 'Viral Bolt';
      state.settings.noticeBanner = state.settings.noticeBanner.replace(/MiniWorkers/g, 'Viral Bolt');
      if (state.settings.supportEmail === 'support@miniworkers.example') {
        state.settings.supportEmail = 'support@viralbolt.example';
      }
      mutated = true;
    }
    for (const u of state.users || []) {
      if (!u.username) {
        u.username = u.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `user_${u.id}`;
        mutated = true;
      }
      if (u.phone === undefined) {
        u.phone = u.id === 101 ? '01711000001' : u.id === 102 ? '01811000002' : '';
        mutated = true;
      }
    }
    if (mutated) {
      saveDatabase(state);
    }
    return state;
  } catch {
    const initial = createInitialState();
    saveDatabase(initial);
    return initial;
  }
}

export function saveDatabase(state: DatabaseState): void {
  ensureDirectories();
  const tmpPath = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_FILE);
}

export function sanitizeUser(user: StoredUser): User {
  const { passwordHash: _ignored, ...safe } = user;
  return safe;
}

export function allocateId(state: DatabaseState): number {
  state.nextId += 1;
  return state.nextId;
}

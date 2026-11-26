export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'banned';
export type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface User {
  id: number;
  name: string;
  username: string;
  phone: string;
  email: string;
  country: string;
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus;
  kycDocumentUrl?: string;
  kycNote?: string;
  earningBalance: number;
  depositBalance: number;
  referralCode: string;
  referredBy?: number | null;
  referralEarned: number;
  tasksCompleted: number;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
  minCpc: number;
  description: string;
  active: boolean;
}

export type JobStatus = 'pending' | 'active' | 'paused' | 'completed' | 'rejected';

export interface MicroJob {
  id: number;
  employerId: number;
  employerName: string;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  title: string;
  targetRegion: string;
  targetUrl: string;
  steps: string[];
  proofRequirement: string;
  requireScreenshot: boolean;
  rewardPerWorker: number;
  workersNeeded: number;
  workersCompleted: number;
  platformFee: number;
  totalBudget: number;
  featured: boolean;
  status: JobStatus;
  rejectionReason?: string;
  estimatedMinutes: number;
  createdAt: string;
}

export type ProofStatus = 'pending' | 'approved' | 'rejected';

export interface JobProof {
  id: number;
  jobId: number;
  jobTitle: string;
  workerId: number;
  workerName: string;
  employerId: number;
  rewardAmount: number;
  proofText: string;
  screenshotUrl?: string;
  status: ProofStatus;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface Gateway {
  id: number;
  name: string;
  code: string;
  type: 'deposit' | 'withdraw' | 'both';
  accountDetails: string;
  instructions: string;
  minAmount: number;
  maxAmount: number;
  feePercent: number;
  color: string;
  active: boolean;
}

export type TransactionRequestStatus = 'pending' | 'approved' | 'rejected';

export interface DepositRequest {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  gatewayId: number;
  gatewayName: string;
  amount: number;
  trxId: string;
  screenshotUrl?: string;
  status: TransactionRequestStatus;
  adminNote?: string;
  createdAt: string;
  processedAt?: string;
}

export interface WithdrawRequest {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  gatewayId: number;
  gatewayName: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  accountNumber: string;
  status: TransactionRequestStatus;
  adminNote?: string;
  createdAt: string;
  processedAt?: string;
}

export interface WalletTransaction {
  id: number;
  userId: number;
  type: 'earning' | 'deposit' | 'withdraw' | 'job_spend' | 'job_refund' | 'referral' | 'transfer' | 'admin_adjust';
  wallet: 'earning' | 'deposit';
  amount: number;
  description: string;
  createdAt: string;
}

export interface TicketReply {
  id: number;
  ticketId: number;
  senderId: number;
  senderName: string;
  senderRole: UserRole;
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'answered' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
  replies: TicketReply[];
}

export interface SiteSettings {
  siteName: string;
  currencySymbol: string;
  platformFeePercent: number;
  referralCommissionPercent: number;
  minJobWorkers: number;
  autoApproveJobs: boolean;
  noticeBanner: string;
  supportEmail: string;
}

export interface BootstrapPayload {
  settings: SiteSettings;
  categories: Category[];
  gateways: Gateway[];
  jobs: MicroJob[];
  stats: {
    activeJobsCount: number;
    totalWorkersCount: number;
    totalTasksPaid: number;
    totalPaidOutUsd: number;
  };
}

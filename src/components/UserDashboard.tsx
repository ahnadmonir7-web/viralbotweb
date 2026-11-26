import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileCheck2,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  PlusCircle,
  Search,
  Send,
  ShieldCheck,
  Upload,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { apiRequest, fileToBase64 } from '../api/client.ts';
import type {
  BootstrapPayload,
  DepositRequest,
  JobProof,
  MicroJob,
  SupportTicket,
  User,
  WalletTransaction,
  WithdrawRequest,
} from '../types.ts';
import { formatMoney, formatReward, getColorTheme } from '../utils/colors.ts';

export type DashboardTab =
  | 'overview'
  | 'find-jobs'
  | 'my-work'
  | 'post-job'
  | 'my-jobs'
  | 'wallet'
  | 'referrals'
  | 'tickets'
  | 'account';

interface UserDashboardProps {
  user: User;
  bootstrap: BootstrapPayload;
  initialTab?: DashboardTab;
  onUserUpdate: (user: User) => void;
  onRefreshBootstrap: () => Promise<void>;
  onSelectJob: (job: MicroJob) => void;
  onBackPublic: () => void;
  onLogout: () => void;
}

export function UserDashboard({
  user,
  bootstrap,
  initialTab = 'overview',
  onUserUpdate,
  onRefreshBootstrap,
  onSelectJob,
  onBackPublic,
  onLogout,
}: UserDashboardProps) {
  const [tab, setTab] = useState<DashboardTab>(initialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Worker & Employer data
  const [myProofs, setMyProofs] = useState<JobProof[]>([]);
  const [myJobs, setMyJobs] = useState<MicroJob[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [referredUsers, setReferredUsers] = useState<
    Array<{ id: number; name: string; country: string; tasksCompleted: number; createdAt: string }>
  >([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  // Find Jobs filters
  const [jobSearch, setJobSearch] = useState('');
  const [jobCatFilter, setJobCatFilter] = useState<number | 'all'>('all');

  // Post Job form
  const [pjCategoryId, setPjCategoryId] = useState<number>(bootstrap.categories[0]?.id || 1);
  const [pjTitle, setPjTitle] = useState('');
  const [pjRegion, setPjRegion] = useState('Worldwide');
  const [pjUrl, setPjUrl] = useState('');
  const [pjStepsText, setPjStepsText] = useState(
    'Open the target link provided above.\nComplete the required action carefully.\nTake a clear screenshot showing completion.'
  );
  const [pjProofReq, setPjProofReq] = useState('Submit your username and upload a confirmation screenshot.');
  const [pjRequireShot, setPjRequireShot] = useState(true);
  const [pjWorkers, setPjWorkers] = useState(Math.max(10, bootstrap.settings.minJobWorkers));
  const [pjReward, setPjReward] = useState(0.08);
  const [pjMinutes, setPjMinutes] = useState(3);
  const [pjLoading, setPjLoading] = useState(false);

  // Review Proofs Modal for Employer
  const [reviewJob, setReviewJob] = useState<MicroJob | null>(null);
  const [reviewProofs, setReviewProofs] = useState<JobProof[]>([]);
  const [rejectNotes, setRejectNotes] = useState<Record<number, string>>({});

  // Wallet forms
  const [walletMode, setWalletMode] = useState<'deposit' | 'withdraw' | 'transfer'>('deposit');
  const depositGateways = useMemo(() => bootstrap.gateways.filter((g) => g.type !== 'withdraw'), [bootstrap.gateways]);
  const withdrawGateways = useMemo(() => bootstrap.gateways.filter((g) => g.type !== 'deposit'), [bootstrap.gateways]);
  const [depGwId, setDepGwId] = useState<number>(depositGateways[0]?.id || 1);
  const [depAmount, setDepAmount] = useState('10');
  const [depTrxId, setDepTrxId] = useState('');
  const [depShot, setDepShot] = useState('');
  const [wdGwId, setWdGwId] = useState<number>(withdrawGateways[0]?.id || 1);
  const [wdAmount, setWdAmount] = useState('5');
  const [wdAccount, setWdAccount] = useState('');
  const [trAmount, setTrAmount] = useState('2');

  // Support ticket forms
  const [tkSubject, setTkSubject] = useState('');
  const [tkCategory, setTkCategory] = useState('Task Dispute');
  const [tkPriority, setTkPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [tkMessage, setTkMessage] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});

  // Account & KYC forms
  const [profName, setProfName] = useState(user.name);
  const [profPhone, setProfPhone] = useState(user.phone || '');
  const [profCountry, setProfCountry] = useState(user.country);
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [kycDoc, setKycDoc] = useState('');
  const [kycNote, setKycNote] = useState('');

  const sym = bootstrap.settings.currencySymbol || '$';

  const loadWorkspaceData = useCallback(async () => {
    try {
      const [meRes, proofsRes, jobsRes, walletRes, refRes, ticketsRes] = await Promise.all([
        apiRequest<{ user: User }>('/auth/me'),
        apiRequest<{ proofs: JobProof[] }>('/my-proofs'),
        apiRequest<{ jobs: MicroJob[] }>('/my-jobs'),
        apiRequest<{ deposits: DepositRequest[]; withdrawals: WithdrawRequest[]; transactions: WalletTransaction[] }>(
          '/wallet/overview'
        ),
        apiRequest<{ referredUsers: Array<{ id: number; name: string; country: string; tasksCompleted: number; createdAt: string }> }>(
          '/referrals'
        ),
        apiRequest<{ tickets: SupportTicket[] }>('/tickets'),
      ]);
      onUserUpdate(meRes.user);
      setMyProofs(proofsRes.proofs);
      setMyJobs(jobsRes.jobs);
      setDeposits(walletRes.deposits);
      setWithdrawals(walletRes.withdrawals);
      setTransactions(walletRes.transactions);
      setReferredUsers(refRes.referredUsers);
      setTickets(ticketsRes.tickets);
    } catch {
      // Ignore transient refresh errors
    }
  }, [onUserUpdate]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const selectedCategoryObj = bootstrap.categories.find((c) => c.id === pjCategoryId);
  const baseJobCost = Number((pjWorkers * pjReward).toFixed(4));
  const jobFee = Number((baseJobCost * (bootstrap.settings.platformFeePercent / 100)).toFixed(4));
  const totalJobBudget = Number((baseJobCost + jobFee).toFixed(4));

  const filteredMarketplaceJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    return bootstrap.jobs.filter((j) => {
      if (j.employerId === user.id) return false;
      if (jobCatFilter !== 'all' && j.categoryId !== jobCatFilter) return false;
      if (q && !j.title.toLowerCase().includes(q) && !j.categoryName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [bootstrap.jobs, user.id, jobCatFilter, jobSearch]);

  async function handlePostJob(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setPjLoading(true);
    try {
      const steps = pjStepsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await apiRequest<{ job: MicroJob; user: User }>('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: pjCategoryId,
          title: pjTitle,
          targetRegion: pjRegion,
          targetUrl: pjUrl,
          steps,
          proofRequirement: pjProofReq,
          requireScreenshot: pjRequireShot,
          rewardPerWorker: Number(pjReward),
          workersNeeded: Number(pjWorkers),
          estimatedMinutes: Number(pjMinutes),
        }),
      });
      onUserUpdate(res.user);
      setPjTitle('');
      setPjUrl('');
      setFeedback({
        type: 'ok',
        text:
          res.job.status === 'active'
            ? 'Campaign published live immediately!'
            : 'Campaign submitted! Pending Admin review before going live.',
      });
      await Promise.all([loadWorkspaceData(), onRefreshBootstrap()]);
      setTab('my-jobs');
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    } finally {
      setPjLoading(false);
    }
  }

  async function openReviewDrawer(job: MicroJob) {
    setReviewJob(job);
    try {
      const res = await apiRequest<{ proofs: JobProof[] }>(`/jobs/${job.id}/proofs`);
      setReviewProofs(res.proofs);
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleProofDecision(proofId: number, decision: 'approved' | 'rejected') {
    setFeedback(null);
    try {
      await apiRequest(`/proofs/${proofId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, note: rejectNotes[proofId] || '' }),
      });
      if (reviewJob) {
        const res = await apiRequest<{ proofs: JobProof[] }>(`/jobs/${reviewJob.id}/proofs`);
        setReviewProofs(res.proofs);
      }
      await Promise.all([loadWorkspaceData(), onRefreshBootstrap()]);
      setFeedback({ type: 'ok', text: `Submission marked as ${decision}.` });
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleToggleJobStatus(job: MicroJob) {
    const next = job.status === 'active' ? 'paused' : 'active';
    try {
      await apiRequest(`/jobs/${job.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      await Promise.all([loadWorkspaceData(), onRefreshBootstrap()]);
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleDepositSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiRequest('/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({
          gatewayId: depGwId,
          amount: Number(depAmount),
          trxId: depTrxId,
          screenshotData: depShot,
        }),
      });
      setDepTrxId('');
      setDepShot('');
      setFeedback({ type: 'ok', text: 'Deposit request submitted! Admin will verify your TrxID shortly.' });
      await loadWorkspaceData();
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleWithdrawSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiRequest<{ user: User }>('/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          gatewayId: wdGwId,
          amount: Number(wdAmount),
          accountNumber: wdAccount,
        }),
      });
      onUserUpdate(res.user);
      setWdAccount('');
      setFeedback({ type: 'ok', text: 'Withdrawal request placed in payout queue.' });
      await loadWorkspaceData();
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiRequest<{ user: User }>('/wallet/transfer', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(trAmount) }),
      });
      onUserUpdate(res.user);
      setFeedback({ type: 'ok', text: 'Funds transferred from Earning Balance to Deposit Balance.' });
      await loadWorkspaceData();
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiRequest('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: tkSubject,
          category: tkCategory,
          priority: tkPriority,
          message: tkMessage,
        }),
      });
      setTkSubject('');
      setTkMessage('');
      setFeedback({ type: 'ok', text: 'Support ticket opened.' });
      await loadWorkspaceData();
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleTicketReply(ticketId: number) {
    const msg = (replyDrafts[ticketId] || '').trim();
    if (!msg) return;
    try {
      await apiRequest(`/tickets/${ticketId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: msg }),
      });
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: '' }));
      await loadWorkspaceData();
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiRequest<{ user: User }>('/auth/profile', {
        method: 'POST',
        body: JSON.stringify({ name: profName, phone: profPhone, country: profCountry }),
      });
      onUserUpdate(res.user);
      setFeedback({ type: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: curPass, newPassword: newPass }),
      });
      setCurPass('');
      setNewPass('');
      setFeedback({ type: 'ok', text: 'Password updated successfully.' });
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleKycSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiRequest<{ user: User }>('/kyc', {
        method: 'POST',
        body: JSON.stringify({ documentData: kycDoc, note: kycNote }),
      });
      onUserUpdate(res.user);
      setKycDoc('');
      setKycNote('');
      setFeedback({ type: 'ok', text: 'KYC document uploaded for Admin review.' });
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    }
  }

  const navItems: Array<{ id: DashboardTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'find-jobs', label: 'Find Jobs', icon: <Search className="h-4 w-4" /> },
    { id: 'my-work', label: 'My Worked Tasks', icon: <ClipboardList className="h-4 w-4" /> },
    { id: 'post-job', label: 'Post a Job', icon: <PlusCircle className="h-4 w-4" /> },
    { id: 'my-jobs', label: 'My Posted Jobs', icon: <Briefcase className="h-4 w-4" /> },
    { id: 'wallet', label: 'Wallet & Payouts', icon: <Wallet className="h-4 w-4" /> },
    { id: 'referrals', label: 'Referrals', icon: <Users className="h-4 w-4" /> },
    { id: 'tickets', label: 'Support Tickets', icon: <LifeBuoy className="h-4 w-4" /> },
    { id: 'account', label: 'Account & KYC', icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  const activeNavLabel = navItems.find((n) => n.id === tab)?.label || 'Overview';
  const selectedDepGw = depositGateways.find((g) => g.id === depGwId) || depositGateways[0];
  const selectedWdGw = withdrawGateways.find((g) => g.id === wdGwId) || withdrawGateways[0];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <button
            type="button"
            onClick={onBackPublic}
            className="font-display text-xl font-extrabold tracking-tight text-indigo-700"
          >
            {bootstrap.settings.siteName}
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setFeedback(null);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="space-y-2 border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={onBackPublic}
            className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Home className="h-4 w-4" />
            Public Marketplace
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 flex w-64 flex-col bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-display text-lg font-extrabold text-indigo-700">{bootstrap.settings.siteName}</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setMobileMenuOpen(false);
                    setFeedback(null);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                    tab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={onLogout}
              className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="text-sm text-slate-500">
              <span>Workspace</span>
              <span className="mx-2">/</span>
              <span className="font-semibold text-slate-900">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-slate-600">
              <span>
                Earning:{' '}
                <strong className="font-mono text-emerald-600 tabular-nums">
                  {formatMoney(user.earningBalance, sym)}
                </strong>
              </span>
              <span>
                Deposit:{' '}
                <strong className="font-mono text-indigo-600 tabular-nums">
                  {formatMoney(user.depositBalance, sym)}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTab('post-job')}
              className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 whitespace-nowrap shrink-0"
            >
              + Post Micro-Job
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-6">
          {feedback && (
            <div
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
                feedback.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              <span>{feedback.text}</span>
              <button type="button" onClick={() => setFeedback(null)} className="ml-4 opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {bootstrap.settings.noticeBanner && (
                <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white shadow-sm">
                  <p className="text-xs font-semibold text-indigo-100">Platform Notice</p>
                  <p className="mt-1 text-sm font-medium leading-relaxed">{bootstrap.settings.noticeBanner}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                  <p className="text-xs font-semibold text-emerald-700">Earning Balance</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-emerald-900 tabular-nums">
                    {formatMoney(user.earningBalance, sym)}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">Ready to withdraw or transfer</p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
                  <p className="text-xs font-semibold text-indigo-700">Deposit Balance</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-indigo-900 tabular-nums">
                    {formatMoney(user.depositBalance, sym)}
                  </p>
                  <p className="mt-1 text-xs text-indigo-700">Used to fund campaigns</p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
                  <p className="text-xs font-semibold text-sky-700">Tasks Completed</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-sky-900 tabular-nums">{user.tasksCompleted}</p>
                  <p className="mt-1 text-xs text-sky-700">Verified employer approvals</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                  <p className="text-xs font-semibold text-amber-700">Referral Earnings</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-amber-900 tabular-nums">
                    {formatMoney(user.referralEarned, sym)}
                  </p>
                  <p className="mt-1 text-xs text-amber-700">{referredUsers.length} invited members</p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-slate-900">Recent Transactions</h2>
                    <button
                      type="button"
                      onClick={() => setTab('wallet')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Open Wallet
                    </button>
                  </div>
                  {transactions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No wallet transactions recorded yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {transactions.slice(0, 6).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{tx.description}</p>
                            <p className="text-xs text-slate-500">
                              {tx.wallet === 'earning' ? 'Earning Wallet' : 'Deposit Wallet'} ·{' '}
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span
                            className={`font-mono text-sm font-bold tabular-nums shrink-0 ${
                              tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {tx.amount >= 0 ? '+' : ''}
                            {formatMoney(tx.amount, sym)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-slate-900">Recommended Micro-Jobs</h2>
                    <button
                      type="button"
                      onClick={() => setTab('find-jobs')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Browse All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {filteredMarketplaceJobs.slice(0, 4).map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{job.title}</p>
                          <p className="text-xs text-slate-500">
                            {job.categoryName} · {job.workersCompleted}/{job.workersNeeded} slots
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectJob(job)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 font-mono text-xs font-bold text-white hover:bg-indigo-700 shrink-0 tabular-nums"
                        >
                          {formatReward(job.rewardPerWorker, sym)}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FIND JOBS */}
          {tab === 'find-jobs' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={jobSearch}
                    onChange={(e) => setJobSearch(e.target.value)}
                    placeholder="Search available tasks..."
                    className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <select
                  value={jobCatFilter}
                  onChange={(e) => setJobCatFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700"
                >
                  <option value="all">All Categories</option>
                  {bootstrap.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {filteredMarketplaceJobs.map((job) => {
                  const theme = getColorTheme(job.categoryColor);
                  const pct = Math.min(100, Math.round((job.workersCompleted / Math.max(1, job.workersNeeded)) * 100));
                  return (
                    <div
                      key={job.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className={`font-semibold ${theme.text}`}>
                            {job.categoryName} · {job.targetRegion}
                          </span>
                          <span className="font-mono text-base font-bold text-emerald-600 tabular-nums">
                            {formatReward(job.rewardPerWorker, sym)}
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-base font-bold text-slate-900">{job.title}</h3>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                        <div className="flex-1">
                          <div className="mb-1 flex justify-between text-xs text-slate-500">
                            <span>Slots</span>
                            <span className="font-mono tabular-nums">
                              {job.workersCompleted}/{job.workersNeeded}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectJob(job)}
                          className={`rounded-xl px-4 py-2 text-xs font-bold text-white ${theme.bg}`}
                        >
                          Start Task
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MY WORKED TASKS */}
          {tab === 'my-work' && (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="font-display text-base font-bold text-slate-900">Submitted Task Proofs</h2>
              </div>
              {myProofs.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm font-medium text-slate-600">You haven’t submitted any task proofs yet.</p>
                  <button
                    type="button"
                    onClick={() => setTab('find-jobs')}
                    className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Browse Available Jobs
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
                      <tr>
                        <th className="px-6 py-3">Task</th>
                        <th className="px-6 py-3">Submitted Proof</th>
                        <th className="px-6 py-3 text-right">Reward</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {myProofs.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/70">
                          <td className="px-6 py-3.5 font-medium text-slate-900">{p.jobTitle}</td>
                          <td className="px-6 py-3.5 text-xs text-slate-600">
                            <p className="line-clamp-2 max-w-md">{p.proofText}</p>
                            {p.reviewNote && <p className="mt-1 text-slate-500">Note: {p.reviewNote}</p>}
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                            {formatReward(p.rewardAmount, sym)}
                          </td>
                          <td className="px-6 py-3.5 text-xs font-semibold">
                            {p.status === 'approved' && <span className="text-emerald-600">Approved</span>}
                            {p.status === 'pending' && <span className="text-amber-600">Pending Review</span>}
                            {p.status === 'rejected' && <span className="text-rose-600">Rejected</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* POST A JOB */}
          {tab === 'post-job' && (
            <div className="grid gap-6 lg:grid-cols-12">
              <form
                onSubmit={handlePostJob}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-8"
              >
                <h2 className="font-display text-lg font-bold text-slate-900">Launch a Micro-Job Campaign</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Category</label>
                    <select
                      value={pjCategoryId}
                      onChange={(e) => {
                        const cid = Number(e.target.value);
                        setPjCategoryId(cid);
                        const found = bootstrap.categories.find((c) => c.id === cid);
                        if (found && pjReward < found.minCpc) setPjReward(found.minCpc);
                      }}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    >
                      {bootstrap.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Min {formatReward(c.minCpc, sym)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Target Region</label>
                    <input
                      type="text"
                      value={pjRegion}
                      onChange={(e) => setPjRegion(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Campaign Title</label>
                  <input
                    type="text"
                    required
                    value={pjTitle}
                    onChange={(e) => setPjTitle(e.target.value)}
                    placeholder="e.g. Watch 2-Min Product Demo & Share Honest Feedback"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Target URL (Optional)</label>
                  <input
                    type="url"
                    value={pjUrl}
                    onChange={(e) => setPjUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Step-by-Step Instructions (one step per line)
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={pjStepsText}
                    onChange={(e) => setPjStepsText(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Proof Required from Worker</label>
                  <textarea
                    rows={2}
                    required
                    value={pjProofReq}
                    onChange={(e) => setPjProofReq(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Workers Needed (Min {bootstrap.settings.minJobWorkers})
                    </label>
                    <input
                      type="number"
                      min={bootstrap.settings.minJobWorkers}
                      value={pjWorkers}
                      onChange={(e) => setPjWorkers(Math.max(1, Number(e.target.value)))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Each Worker Earns ({sym})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={selectedCategoryObj?.minCpc || 0.01}
                      value={pjReward}
                      onChange={(e) => setPjReward(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Est. Minutes</label>
                    <input
                      type="number"
                      min={1}
                      value={pjMinutes}
                      onChange={(e) => setPjMinutes(Math.max(1, Number(e.target.value)))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={pjRequireShot}
                    onChange={(e) => setPjRequireShot(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  Require worker to upload a screenshot proof
                </label>

                <button
                  type="submit"
                  disabled={pjLoading}
                  className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {pjLoading ? 'Publishing Campaign...' : `Launch Campaign (${formatMoney(totalJobBudget, sym)})`}
                </button>
              </form>

              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-4 self-start">
                <h3 className="font-display text-base font-bold text-slate-900">Campaign Budget Summary</h3>
                <div className="space-y-2.5 border-y border-slate-100 py-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Worker Rewards</span>
                    <span className="font-mono font-semibold tabular-nums">{formatMoney(baseJobCost, sym)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Platform Fee ({bootstrap.settings.platformFeePercent}%)</span>
                    <span className="font-mono font-semibold tabular-nums">{formatMoney(jobFee, sym)}</span>
                  </div>
                  <div className="flex justify-between pt-2 text-base font-bold text-slate-900">
                    <span>Total Budget</span>
                    <span className="font-mono text-indigo-700 tabular-nums">{formatMoney(totalJobBudget, sym)}</span>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600">
                  <p>
                    Available Deposit Balance:{' '}
                    <strong className="font-mono text-slate-900 tabular-nums">
                      {formatMoney(user.depositBalance, sym)}
                    </strong>
                  </p>
                  {user.depositBalance < totalJobBudget && (
                    <button
                      type="button"
                      onClick={() => setTab('wallet')}
                      className="mt-2 font-semibold text-indigo-600 hover:underline"
                    >
                      Deposit funds or transfer from Earning Balance →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MY POSTED JOBS & PROOF REVIEW */}
          {tab === 'my-jobs' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <h2 className="font-display text-base font-bold text-slate-900">My Posted Campaigns</h2>
                  <button
                    type="button"
                    onClick={() => setTab('post-job')}
                    className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white"
                  >
                    + New Job
                  </button>
                </div>
                {myJobs.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    You have not posted any micro-job campaigns yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {myJobs.map((job) => (
                      <div key={job.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>#{job.id}</span>
                            <span>·</span>
                            <span>{job.categoryName}</span>
                            <span>·</span>
                            <span
                              className={`font-semibold capitalize ${
                                job.status === 'active'
                                  ? 'text-emerald-600'
                                  : job.status === 'pending'
                                    ? 'text-amber-600'
                                    : job.status === 'rejected'
                                      ? 'text-rose-600'
                                      : 'text-slate-600'
                              }`}
                            >
                              {job.status}
                            </span>
                          </div>
                          <p className="mt-1 font-display text-sm font-bold text-slate-900">{job.title}</p>
                          <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                            {job.workersCompleted}/{job.workersNeeded} completed · {formatReward(job.rewardPerWorker, sym)}/task
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(job.status === 'active' || job.status === 'paused') && (
                            <button
                              type="button"
                              onClick={() => handleToggleJobStatus(job)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {job.status === 'active' ? 'Pause' : 'Resume'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openReviewDrawer(job)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                          >
                            <FileCheck2 className="h-3.5 w-3.5" />
                            Review Proofs
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {reviewJob && (
                <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900">
                        Proof Submissions for #{reviewJob.id}: {reviewJob.title}
                      </h3>
                      <p className="text-xs text-slate-500">Approve accurate work or reject with a clear reason.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewJob(null)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {reviewProofs.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">No worker submissions yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {reviewProofs.map((p) => (
                        <div key={p.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="font-bold text-slate-900">{p.workerName}</span>
                                <span>·</span>
                                <span className="capitalize font-semibold">{p.status}</span>
                              </div>
                              <p className="text-sm text-slate-800">{p.proofText}</p>
                              {p.screenshotUrl && (
                                <a href={p.screenshotUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                                  <img
                                    src={p.screenshotUrl}
                                    alt="Worker screenshot proof"
                                    className="h-32 rounded-lg border border-slate-200 object-cover"
                                  />
                                </a>
                              )}
                            </div>

                            {p.status === 'pending' && (
                              <div className="flex flex-col gap-2 min-w-[220px]">
                                <input
                                  type="text"
                                  placeholder="Optional note / reject reason"
                                  value={rejectNotes[p.id] || ''}
                                  onChange={(e) => setRejectNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleProofDecision(p.id, 'approved')}
                                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Satisfy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleProofDecision(p.id, 'rejected')}
                                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-700"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Reject
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* WALLET & DEPOSIT / WITHDRAW / TRANSFER */}
          {tab === 'wallet' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-xs font-semibold text-emerald-700">Withdrawable Earning Balance</p>
                  <p className="mt-1 font-mono text-3xl font-bold text-emerald-950 tabular-nums">
                    {formatMoney(user.earningBalance, sym)}
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
                  <p className="text-xs font-semibold text-indigo-700">Campaign Deposit Balance</p>
                  <p className="mt-1 font-mono text-3xl font-bold text-indigo-950 tabular-nums">
                    {formatMoney(user.depositBalance, sym)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-6 flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1.5">
                  {(['deposit', 'withdraw', 'transfer'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setWalletMode(m)}
                      className={`rounded-lg px-4 py-2 text-xs font-bold capitalize transition-colors ${
                        walletMode === m ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {m === 'transfer' ? 'Earning → Deposit Transfer' : m}
                    </button>
                  ))}
                </div>

                {walletMode === 'deposit' && (
                  <form onSubmit={handleDepositSubmit} className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Payment Gateway</label>
                        <select
                          value={depGwId}
                          onChange={(e) => setDepGwId(Number(e.target.value))}
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                        >
                          {depositGateways.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name} (Min {formatMoney(g.minAmount, sym)})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Amount ({sym})</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={depAmount}
                          onChange={(e) => setDepAmount(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Transaction ID (TrxID)</label>
                        <input
                          type="text"
                          required
                          value={depTrxId}
                          onChange={(e) => setDepTrxId(e.target.value)}
                          placeholder="e.g. BKH9928172A"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Receipt Screenshot (Optional)
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-xs font-medium text-slate-600 hover:border-indigo-400">
                          <Upload className="h-4 w-4 text-indigo-600" />
                          <span>{depShot ? 'Screenshot attached' : 'Upload payment receipt'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) setDepShot(await fileToBase64(f));
                            }}
                          />
                        </label>
                      </div>
                      <button
                        type="submit"
                        className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                      >
                        Submit Deposit Request
                      </button>
                    </div>

                    {selectedDepGw && (
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 space-y-3 self-start">
                        <h3 className="font-display text-sm font-bold text-indigo-950">
                          {selectedDepGw.name} Instructions
                        </h3>
                        <p className="rounded-xl bg-white p-3 font-mono text-xs font-semibold text-slate-800">
                          {selectedDepGw.accountDetails}
                        </p>
                        <p className="text-xs leading-relaxed text-indigo-900">{selectedDepGw.instructions}</p>
                        <p className="text-xs text-indigo-700">
                          Limits: {formatMoney(selectedDepGw.minAmount, sym)} – {formatMoney(selectedDepGw.maxAmount, sym)}
                        </p>
                      </div>
                    )}
                  </form>
                )}

                {walletMode === 'withdraw' && (
                  <form onSubmit={handleWithdrawSubmit} className="max-w-lg space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Payout Method</label>
                      <select
                        value={wdGwId}
                        onChange={(e) => setWdGwId(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                      >
                        {withdrawGateways.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} (Fee {g.feePercent}% · Min {formatMoney(g.minAmount, sym)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Receiving Wallet / Account Number
                      </label>
                      <input
                        type="text"
                        required
                        value={wdAccount}
                        onChange={(e) => setWdAccount(e.target.value)}
                        placeholder="e.g. 017XXXXXXXX or PayPal email / TRC20 address"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Amount ({sym})</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={wdAmount}
                        onChange={(e) => setWdAmount(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm"
                      />
                      {selectedWdGw && (
                        <p className="mt-1 text-xs text-slate-500">
                          Net payout after {selectedWdGw.feePercent}% fee:{' '}
                          <strong className="font-mono text-emerald-700 tabular-nums">
                            {formatMoney(Number(wdAmount || 0) * (1 - selectedWdGw.feePercent / 100), sym)}
                          </strong>
                        </p>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      Request Payout
                    </button>
                  </form>
                )}

                {walletMode === 'transfer' && (
                  <form onSubmit={handleTransferSubmit} className="max-w-md space-y-4">
                    <p className="text-sm text-slate-600">
                      Convert your earned worker rewards directly into your Campaign Deposit Balance to launch jobs
                      without external fees.
                    </p>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Transfer Amount ({sym})</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        required
                        value={trAmount}
                        onChange={(e) => setTrAmount(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      Transfer to Deposit Balance
                    </button>
                  </form>
                )}
              </div>

              {/* Deposit & Withdrawal History */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="mb-3 font-display text-sm font-bold text-slate-900">Deposit Requests</h3>
                  {deposits.length === 0 ? (
                    <p className="text-xs text-slate-500">No deposits submitted yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {deposits.map((d) => (
                        <div key={d.id} className="flex items-center justify-between py-2.5">
                          <div>
                            <p className="font-semibold text-slate-800">{d.gatewayName}</p>
                            <p className="font-mono text-slate-500">TrxID: {d.trxId}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-slate-900 tabular-nums">
                              {formatMoney(d.amount, sym)}
                            </p>
                            <p
                              className={`capitalize font-semibold ${
                                d.status === 'approved'
                                  ? 'text-emerald-600'
                                  : d.status === 'rejected'
                                    ? 'text-rose-600'
                                    : 'text-amber-600'
                              }`}
                            >
                              {d.status}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="mb-3 font-display text-sm font-bold text-slate-900">Withdrawal Requests</h3>
                  {withdrawals.length === 0 ? (
                    <p className="text-xs text-slate-500">No withdrawals requested yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {withdrawals.map((w) => (
                        <div key={w.id} className="flex items-center justify-between py-2.5">
                          <div>
                            <p className="font-semibold text-slate-800">{w.gatewayName}</p>
                            <p className="font-mono text-slate-500">{w.accountNumber}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-slate-900 tabular-nums">
                              {formatMoney(w.netAmount, sym)} net
                            </p>
                            <p
                              className={`capitalize font-semibold ${
                                w.status === 'approved'
                                  ? 'text-emerald-600'
                                  : w.status === 'rejected'
                                    ? 'text-rose-600'
                                    : 'text-amber-600'
                              }`}
                            >
                              {w.status}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* REFERRALS */}
          {tab === 'referrals' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Invite Friends & Earn {bootstrap.settings.referralCommissionPercent}% Lifetime Commission
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Every time a referred worker completes a verified micro-job, you automatically receive{' '}
                  {bootstrap.settings.referralCommissionPercent}% in your Earning Balance.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <code className="rounded-xl border border-amber-200 bg-white px-4 py-2.5 font-mono text-sm font-bold text-slate-900">
                    {`${window.location.origin}/?ref=${user.referralCode}`}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(`${window.location.origin}/?ref=${user.referralCode}`);
                      setFeedback({ type: 'ok', text: 'Referral link copied to clipboard!' });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Link
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="mb-4 font-display text-base font-bold text-slate-900">
                  Referred Members ({referredUsers.length})
                </h3>
                {referredUsers.length === 0 ? (
                  <p className="text-sm text-slate-500">Share your referral code ({user.referralCode}) to get started.</p>
                ) : (
                  <div className="divide-y divide-slate-100 text-sm">
                    {referredUsers.map((r) => (
                      <div key={r.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="font-semibold text-slate-900">{r.name}</p>
                          <p className="text-xs text-slate-500">{r.country}</p>
                        </div>
                        <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                          {r.tasksCompleted} tasks completed
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUPPORT TICKETS */}
          {tab === 'tickets' && (
            <div className="grid gap-6 lg:grid-cols-12">
              <form
                onSubmit={handleCreateTicket}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-5 self-start"
              >
                <h2 className="font-display text-base font-bold text-slate-900">Open Support Ticket</h2>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Subject</label>
                  <input
                    type="text"
                    required
                    value={tkSubject}
                    onChange={(e) => setTkSubject(e.target.value)}
                    placeholder="Brief summary of your issue"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Category</label>
                    <select
                      value={tkCategory}
                      onChange={(e) => setTkCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option>Task Dispute</option>
                      <option>Deposit / Withdraw</option>
                      <option>Account & KYC</option>
                      <option>General</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Priority</label>
                    <select
                      value={tkPriority}
                      onChange={(e) => setTkPriority(e.target.value as 'low' | 'medium' | 'high')}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Message</label>
                  <textarea
                    rows={4}
                    required
                    value={tkMessage}
                    onChange={(e) => setTkMessage(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                >
                  Submit Ticket
                </button>
              </form>

              <div className="space-y-4 lg:col-span-7">
                {tickets.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                    No support tickets found.
                  </div>
                ) : (
                  tickets.map((t) => (
                    <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                        <div>
                          <p className="text-xs text-slate-500">
                            #{t.id} · {t.category} · Priority: {t.priority}
                          </p>
                          <h3 className="font-display text-base font-bold text-slate-900">{t.subject}</h3>
                        </div>
                        <span className="text-xs font-bold capitalize text-indigo-600">{t.status}</span>
                      </div>

                      <div className="space-y-2.5 max-h-60 overflow-y-auto">
                        {t.replies.map((r) => (
                          <div
                            key={r.id}
                            className={`rounded-xl p-3 text-sm ${
                              r.senderRole === 'admin' ? 'bg-indigo-50 text-indigo-950' : 'bg-slate-50 text-slate-800'
                            }`}
                          >
                            <p className="text-xs font-bold">
                              {r.senderName} {r.senderRole === 'admin' ? '(Support Admin)' : ''}
                            </p>
                            <p className="mt-1">{r.message}</p>
                          </div>
                        ))}
                      </div>

                      {t.status !== 'closed' && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Write a reply..."
                            value={replyDrafts[t.id] || ''}
                            onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleTicketReply(t.id)}
                            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Reply
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ACCOUNT & KYC */}
          {tab === 'account' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <form onSubmit={handleProfileSave} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="font-display text-base font-bold text-slate-900">Profile Details</h2>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">User Name</label>
                  <input
                    type="text"
                    readOnly
                    value={`@${user.username || user.name}`}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
                  <input
                    type="text"
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Phone Number</label>
                  <input
                    type="tel"
                    value={profPhone}
                    onChange={(e) => setProfPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Country</label>
                  <input
                    type="text"
                    value={profCountry}
                    onChange={(e) => setProfCountry(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  Save Profile
                </button>
              </form>

              <form onSubmit={handlePasswordSave} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="font-display text-base font-bold text-slate-900">Security & Password</h2>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Current Password</label>
                  <input
                    type="password"
                    required
                    value={curPass}
                    onChange={(e) => setCurPass(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Update Password
                </button>
              </form>

              <form
                onSubmit={handleKycSubmit}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900">Identity Verification (KYC)</h2>
                    <p className="text-xs text-slate-500">
                      Current Status:{' '}
                      <strong className="capitalize text-indigo-700">{user.kycStatus}</strong>
                    </p>
                  </div>
                </div>
                {user.kycStatus !== 'verified' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-xs font-medium text-slate-600">
                      <Upload className="h-4 w-4 text-indigo-600" />
                      <span>{kycDoc ? 'ID image ready to upload' : 'Select NID / Passport photo'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) setKycDoc(await fileToBase64(f));
                        }}
                      />
                    </label>
                    <input
                      type="text"
                      value={kycNote}
                      onChange={(e) => setKycNote(e.target.value)}
                      placeholder="Optional ID number or note"
                      className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="w-fit rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      Submit KYC Document
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

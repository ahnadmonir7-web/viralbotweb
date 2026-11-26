import React, { useCallback, useEffect, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  CreditCard,
  Home,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Settings,
  Star,
  Trash2,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../api/client.ts';
import type {
  BootstrapPayload,
  Category,
  DepositRequest,
  Gateway,
  MicroJob,
  SiteSettings,
  SupportTicket,
  User,
  WithdrawRequest,
} from '../types.ts';
import { formatMoney, formatReward } from '../utils/colors.ts';

type AdminTab =
  | 'overview'
  | 'jobs'
  | 'categories'
  | 'deposits'
  | 'withdrawals'
  | 'users'
  | 'gateways'
  | 'tickets'
  | 'settings';

interface AdminOverviewStats {
  totalUsers: number;
  pendingJobs: number;
  pendingDeposits: number;
  pendingDepositsAmount: number;
  pendingWithdrawals: number;
  pendingWithdrawalsAmount: number;
  openTickets: number;
  platformRevenue: number;
}

interface AdminPanelProps {
  admin: User;
  bootstrap: BootstrapPayload;
  onRefreshBootstrap: () => Promise<void>;
  onBackPublic: () => void;
  onLogout: () => void;
}

export function AdminPanel({
  admin,
  bootstrap,
  onRefreshBootstrap,
  onBackPublic,
  onLogout,
}: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [overview, setOverview] = useState<AdminOverviewStats | null>(null);
  const [jobs, setJobs] = useState<MicroJob[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(bootstrap.settings);

  // Forms
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('indigo');
  const [newCatMin, setNewCatMin] = useState('0.05');
  const [newCatDesc, setNewCatDesc] = useState('');

  const [newGwName, setNewGwName] = useState('');
  const [newGwType, setNewGwType] = useState<'both' | 'deposit' | 'withdraw'>('both');
  const [newGwAccount, setNewGwAccount] = useState('');
  const [newGwInst, setNewGwInst] = useState('');
  const [newGwMin, setNewGwMin] = useState('2');
  const [newGwMax, setNewGwMax] = useState('1000');
  const [newGwFee, setNewGwFee] = useState('2');

  const [userSearch, setUserSearch] = useState('');
  const [adjustAmt, setAdjustAmt] = useState<Record<number, string>>({});
  const [adjustWallet, setAdjustWallet] = useState<Record<number, 'deposit' | 'earning'>>({});
  const [ticketReplies, setTicketReplies] = useState<Record<number, string>>({});

  const sym = settings.currencySymbol || '$';

  const loadAllAdmin = useCallback(async () => {
    try {
      const [ov, jb, ct, dp, wd, us, gw, tk, st] = await Promise.all([
        apiRequest<AdminOverviewStats>('/admin/overview'),
        apiRequest<{ jobs: MicroJob[] }>('/admin/jobs'),
        apiRequest<{ categories: Category[] }>('/admin/categories'),
        apiRequest<{ deposits: DepositRequest[] }>('/admin/deposits'),
        apiRequest<{ withdrawals: WithdrawRequest[] }>('/admin/withdrawals'),
        apiRequest<{ users: User[] }>('/admin/users'),
        apiRequest<{ gateways: Gateway[] }>('/admin/gateways'),
        apiRequest<{ tickets: SupportTicket[] }>('/admin/tickets'),
        apiRequest<{ settings: SiteSettings }>('/admin/settings'),
      ]);
      setOverview(ov);
      setJobs(jb.jobs);
      setCategories(ct.categories);
      setDeposits(dp.deposits);
      setWithdrawals(wd.withdrawals);
      setUsers(us.users);
      setGateways(gw.gateways);
      setTickets(tk.tickets);
      setSettings(st.settings);
    } catch (err) {
      setMsg({ type: 'err', text: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    loadAllAdmin();
  }, [loadAllAdmin]);

  async function jobDecision(jobId: number, action: 'approve' | 'reject' | 'toggle_feature' | 'delete', reason = '') {
    try {
      await apiRequest(`/admin/jobs/${jobId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ action, reason }),
      });
      await Promise.all([loadAllAdmin(), onRefreshBootstrap()]);
      setMsg({ type: 'ok', text: `Job #${jobId} updated (${action}).` });
    } catch (err) {
      setMsg({ type: 'err', text: (err as Error).message });
    }
  }

  async function depositDecision(id: number, decision: 'approved' | 'rejected') {
    try {
      await apiRequest(`/admin/deposits/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      await loadAllAdmin();
      setMsg({ type: 'ok', text: `Deposit #${id} ${decision}.` });
    } catch (err) {
      setMsg({ type: 'err', text: (err as Error).message });
    }
  }

  async function withdrawDecision(id: number, decision: 'approved' | 'rejected') {
    try {
      await apiRequest(`/admin/withdrawals/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      await Promise.all([loadAllAdmin(), onRefreshBootstrap()]);
      setMsg({ type: 'ok', text: `Withdrawal #${id} ${decision}.` });
    } catch (err) {
      setMsg({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: newCatName,
          color: newCatColor,
          minCpc: Number(newCatMin),
          description: newCatDesc,
        }),
      });
      setNewCatName('');
      setNewCatDesc('');
      await Promise.all([loadAllAdmin(), onRefreshBootstrap()]);
      setMsg({ type: 'ok', text: 'Category added.' });
    } catch (err) {
      setMsg({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleAddGateway(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/admin/gateways', {
        method: 'POST',
        body: JSON.stringify({
          name: newGwName,
          type: newGwType,
          accountDetails: newGwAccount,
          instructions: newGwInst,
          minAmount: Number(newGwMin),
          maxAmount: Number(newGwMax),
          feePercent: Number(newGwFee),
        }),
      });
      setNewGwName('');
      setNewGwAccount('');
      setNewGwInst('');
      await Promise.all([loadAllAdmin(), onRefreshBootstrap()]);
      setMsg({ type: 'ok', text: 'Payment gateway added.' });
    } catch (err) {
      setMsg({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleUserUpdate(uid: number, payload: Record<string, unknown>) {
    try {
      await apiRequest(`/admin/users/${uid}/update`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAdjustAmt((prev) => ({ ...prev, [uid]: '' }));
      await loadAllAdmin();
      setMsg({ type: 'ok', text: `User #${uid} updated.` });
    } catch (err) {
      setMsg({ type: 'err', text: (err as Error).message });
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      await Promise.all([loadAllAdmin(), onRefreshBootstrap()]);
      setMsg({ type: 'ok', text: 'Platform settings saved.' });
    } catch (err) {
      setMsg({ type: 'err', text: (err as Error).message });
    }
  }

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'jobs', label: 'Manage Jobs', icon: <Briefcase className="h-4 w-4" />, badge: overview?.pendingJobs },
    { id: 'categories', label: 'Categories', icon: <Layers className="h-4 w-4" /> },
    { id: 'deposits', label: 'Deposits', icon: <Wallet className="h-4 w-4" />, badge: overview?.pendingDeposits },
    {
      id: 'withdrawals',
      label: 'Withdrawals',
      icon: <CreditCard className="h-4 w-4" />,
      badge: overview?.pendingWithdrawals,
    },
    { id: 'users', label: 'Users & KYC', icon: <Users className="h-4 w-4" /> },
    { id: 'gateways', label: 'Gateways', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'tickets', label: 'Tickets', icon: <LifeBuoy className="h-4 w-4" />, badge: overview?.openTickets },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      {/* Dark Indigo Admin Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-950 text-slate-200 lg:flex">
        <div className="border-b border-slate-800 px-6 py-5">
          <p className="font-display text-lg font-extrabold text-white">{settings.siteName} Admin</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">{admin.email}</p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setMsg(null);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </span>
              {item.badge ? (
                <span className="rounded-md bg-rose-500 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="space-y-2 border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={onBackPublic}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900"
          >
            <Home className="h-4 w-4" />
            View Live Site
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 flex w-64 flex-col bg-slate-950 p-4 text-slate-200">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-display text-base font-bold text-white">Admin Panel</span>
              <button type="button" onClick={() => setMobileOpen(false)}>
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
                    setMobileOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${
                    tab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    {item.label}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-slate-200 p-2 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="font-display text-base font-bold text-slate-900">
              {navItems.find((n) => n.id === tab)?.label}
            </h1>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-6">
          {msg && (
            <div
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
                msg.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              <span>{msg.text}</span>
              <button type="button" onClick={() => setMsg(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* OVERVIEW */}
          {tab === 'overview' && overview && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-indigo-200 bg-white p-5">
                  <p className="text-xs font-semibold text-slate-500">Registered Users</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-indigo-700 tabular-nums">
                    {overview.totalUsers}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-white p-5">
                  <p className="text-xs font-semibold text-slate-500">Pending Job Approvals</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-amber-600 tabular-nums">
                    {overview.pendingJobs}
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-white p-5">
                  <p className="text-xs font-semibold text-slate-500">Pending Deposits</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-sky-600 tabular-nums">
                    {overview.pendingDeposits}{' '}
                    <span className="text-sm font-semibold text-slate-500">
                      ({formatMoney(overview.pendingDepositsAmount, sym)})
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-white p-5">
                  <p className="text-xs font-semibold text-slate-500">Platform Fee Revenue</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-emerald-600 tabular-nums">
                    {formatMoney(overview.platformRevenue, sym)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setTab('jobs')}
                  className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-indigo-300"
                >
                  <p className="font-display text-sm font-bold text-slate-900">Review Job Queue</p>
                  <p className="mt-1 text-xs text-slate-500">{overview.pendingJobs} campaigns waiting approval</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('deposits')}
                  className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-indigo-300"
                >
                  <p className="font-display text-sm font-bold text-slate-900">Verify Deposits</p>
                  <p className="mt-1 text-xs text-slate-500">{overview.pendingDeposits} payment TrxIDs pending</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('withdrawals')}
                  className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-indigo-300"
                >
                  <p className="font-display text-sm font-bold text-slate-900">Process Payouts</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {overview.pendingWithdrawals} worker payouts ({formatMoney(overview.pendingWithdrawalsAmount, sym)})
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* MANAGE JOBS */}
          {tab === 'jobs' && (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="font-display text-base font-bold text-slate-900">All Campaigns ({jobs.length})</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <div key={job.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono">#{job.id}</span>
                        <span>·</span>
                        <span>{job.categoryName}</span>
                        <span>·</span>
                        <span>By {job.employerName}</span>
                        <span>·</span>
                        <span className="font-bold uppercase text-indigo-700">{job.status}</span>
                      </div>
                      <p className="mt-1 font-display text-sm font-bold text-slate-900">{job.title}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                        {job.workersCompleted}/{job.workersNeeded} slots · {formatReward(job.rewardPerWorker, sym)}/task ·
                        Budget {formatMoney(job.totalBudget, sym)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {job.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => jobDecision(job.id, 'approve')}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => jobDecision(job.id, 'reject', 'Did not meet campaign guidelines')}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => jobDecision(job.id, 'toggle_feature')}
                        className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                          job.featured
                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <Star className="h-3.5 w-3.5" />
                        {job.featured ? 'Featured' : 'Feature'}
                      </button>
                      <button
                        type="button"
                        onClick={() => jobDecision(job.id, 'delete')}
                        className="rounded-lg border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-50"
                        aria-label="Delete job"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CATEGORIES */}
          {tab === 'categories' && (
            <div className="grid gap-6 lg:grid-cols-12">
              <form
                onSubmit={handleAddCategory}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-4 self-start"
              >
                <h2 className="font-display text-base font-bold text-slate-900">Add Job Category</h2>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category Name"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="indigo">Indigo</option>
                    <option value="rose">Rose</option>
                    <option value="emerald">Emerald</option>
                    <option value="sky">Sky</option>
                    <option value="amber">Amber</option>
                    <option value="violet">Violet</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={newCatMin}
                    onChange={(e) => setNewCatMin(e.target.value)}
                    placeholder="Min CPC"
                    className="rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Short description"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                >
                  Save Category
                </button>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-8 divide-y divide-slate-100">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div>
                      <p className="font-display text-sm font-bold text-slate-900">{cat.name}</p>
                      <p className="text-xs text-slate-500">
                        Min {formatReward(cat.minCpc, sym)} · Color: {cat.color} · {cat.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/admin/categories/${cat.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ ...cat, active: !cat.active }),
                          });
                          await Promise.all([loadAllAdmin(), onRefreshBootstrap()]);
                        }}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                          cat.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {cat.active ? 'Active' : 'Disabled'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/admin/categories/${cat.id}`, { method: 'DELETE' });
                          await Promise.all([loadAllAdmin(), onRefreshBootstrap()]);
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DEPOSITS */}
          {tab === 'deposits' && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Gateway & TrxID</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deposits.map((d) => (
                    <tr key={d.id}>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{d.userName}</p>
                        <p className="text-xs text-slate-500">{d.userEmail}</p>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <p className="font-semibold text-slate-800">{d.gatewayName}</p>
                        <p className="font-mono text-slate-500">{d.trxId}</p>
                        {d.screenshotUrl && (
                          <a href={d.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
                            View Receipt
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatMoney(d.amount, sym)}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold capitalize">{d.status}</td>
                      <td className="px-6 py-4 text-right">
                        {d.status === 'pending' && (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => depositDecision(d.id, 'approved')}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => depositDecision(d.id, 'rejected')}
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* WITHDRAWALS */}
          {tab === 'withdrawals' && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Worker</th>
                    <th className="px-6 py-3">Method & Account</th>
                    <th className="px-6 py-3 text-right">Net Payout</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{w.userName}</p>
                        <p className="text-xs text-slate-500">{w.userEmail}</p>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <p className="font-semibold text-slate-800">{w.gatewayName}</p>
                        <p className="font-mono text-slate-600">{w.accountNumber}</p>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatMoney(w.netAmount, sym)}
                        <span className="block text-[11px] font-normal text-slate-500">
                          Gross {formatMoney(w.amount, sym)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold capitalize">{w.status}</td>
                      <td className="px-6 py-4 text-right">
                        {w.status === 'pending' && (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => withdrawDecision(w.id, 'approved')}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                            >
                              Mark Paid
                            </button>
                            <button
                              type="button"
                              onClick={() => withdrawDecision(w.id, 'rejected')}
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white"
                            >
                              Reject & Refund
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* USERS & KYC */}
          {tab === 'users' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users by name, username, phone, or email..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm"
                />
              </div>

              <div className="space-y-3">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <div>
                      <p className="font-display text-sm font-bold text-slate-900">
                        {u.name}{' '}
                        <span className="font-mono text-xs font-normal text-indigo-600">
                          @{u.username || u.name}
                        </span>{' '}
                        <span className="font-mono text-xs font-normal text-slate-500">({u.role})</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {u.phone ? `Phone: ${u.phone} · ` : ''}
                        {u.email} · {u.country} · Status: <strong className="uppercase">{u.status}</strong> · KYC:{' '}
                        <strong className="uppercase">{u.kycStatus}</strong>
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-700 tabular-nums">
                        Earning: {formatMoney(u.earningBalance, sym)} · Deposit: {formatMoney(u.depositBalance, sym)}
                      </p>
                      {u.kycDocumentUrl && (
                        <a
                          href={u.kycDocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs font-semibold text-indigo-600 underline"
                        >
                          Inspect KYC Document
                        </a>
                      )}
                    </div>

                    {u.role !== 'admin' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {u.kycStatus === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUserUpdate(u.id, { kycStatus: 'verified' })}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                            >
                              Verify KYC
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUserUpdate(u.id, { kycStatus: 'rejected' })}
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white"
                            >
                              Reject KYC
                            </button>
                          </>
                        )}
                        <input
                          type="number"
                          step="0.5"
                          placeholder="+/- $"
                          value={adjustAmt[u.id] || ''}
                          onChange={(e) => setAdjustAmt((p) => ({ ...p, [u.id]: e.target.value }))}
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 font-mono text-xs"
                        />
                        <select
                          value={adjustWallet[u.id] || 'deposit'}
                          onChange={(e) =>
                            setAdjustWallet((p) => ({ ...p, [u.id]: e.target.value as 'deposit' | 'earning' }))
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="deposit">Deposit</option>
                          <option value="earning">Earning</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            handleUserUpdate(u.id, {
                              adjustAmount: Number(adjustAmt[u.id] || 0),
                              adjustWallet: adjustWallet[u.id] || 'deposit',
                            })
                          }
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Adjust
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUserUpdate(u.id, { status: u.status === 'active' ? 'banned' : 'active' })
                          }
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                            u.status === 'active' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {u.status === 'active' ? 'Ban' : 'Unban'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PAYMENT GATEWAYS */}
          {tab === 'gateways' && (
            <div className="grid gap-6 lg:grid-cols-12">
              <form
                onSubmit={handleAddGateway}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-4 self-start"
              >
                <h2 className="font-display text-base font-bold text-slate-900">Add Payment Gateway</h2>
                <input
                  type="text"
                  required
                  value={newGwName}
                  onChange={(e) => setNewGwName(e.target.value)}
                  placeholder="Gateway Name (e.g. Rocket)"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
                <select
                  value={newGwType}
                  onChange={(e) => setNewGwType(e.target.value as 'both' | 'deposit' | 'withdraw')}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="both">Deposit & Withdraw</option>
                  <option value="deposit">Deposit Only</option>
                  <option value="withdraw">Withdraw Only</option>
                </select>
                <input
                  type="text"
                  required
                  value={newGwAccount}
                  onChange={(e) => setNewGwAccount(e.target.value)}
                  placeholder="Receiving Account / Pay ID"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
                <textarea
                  rows={2}
                  value={newGwInst}
                  onChange={(e) => setNewGwInst(e.target.value)}
                  placeholder="Instructions shown to users"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    value={newGwMin}
                    onChange={(e) => setNewGwMin(e.target.value)}
                    placeholder="Min"
                    className="rounded-xl border border-slate-300 px-2.5 py-2 font-mono text-xs"
                  />
                  <input
                    type="number"
                    value={newGwMax}
                    onChange={(e) => setNewGwMax(e.target.value)}
                    placeholder="Max"
                    className="rounded-xl border border-slate-300 px-2.5 py-2 font-mono text-xs"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={newGwFee}
                    onChange={(e) => setNewGwFee(e.target.value)}
                    placeholder="Fee %"
                    className="rounded-xl border border-slate-300 px-2.5 py-2 font-mono text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white"
                >
                  Create Gateway
                </button>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-8 divide-y divide-slate-100">
                {gateways.map((gw) => (
                  <div key={gw.id} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div>
                      <p className="font-display text-sm font-bold text-slate-900">
                        {gw.name} <span className="text-xs font-normal text-slate-500">({gw.type})</span>
                      </p>
                      <p className="font-mono text-xs text-slate-600">{gw.accountDetails}</p>
                      <p className="text-xs text-slate-500">
                        Min {formatMoney(gw.minAmount, sym)} · Max {formatMoney(gw.maxAmount, sym)} · Fee {gw.feePercent}%
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/admin/gateways/${gw.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ ...gw, active: !gw.active }),
                          });
                          await Promise.all([loadAllAdmin(), onRefreshBootstrap()]);
                        }}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                          gw.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {gw.active ? 'Active' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/admin/gateways/${gw.id}`, { method: 'DELETE' });
                          await Promise.all([loadAllAdmin(), onRefreshBootstrap()]);
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUPPORT TICKETS */}
          {tab === 'tickets' && (
            <div className="space-y-4">
              {tickets.map((t) => (
                <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <p className="text-xs text-slate-500">
                        #{t.id} · {t.userName} ({t.userEmail}) · {t.category}
                      </p>
                      <h3 className="font-display text-base font-bold text-slate-900">{t.subject}</h3>
                    </div>
                    <select
                      value={t.status}
                      onChange={async (e) => {
                        await apiRequest(`/admin/tickets/${t.id}/status`, {
                          method: 'POST',
                          body: JSON.stringify({ status: e.target.value }),
                        });
                        await loadAllAdmin();
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                    >
                      <option value="open">Open</option>
                      <option value="answered">Answered</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    {t.replies.map((r) => (
                      <div
                        key={r.id}
                        className={`rounded-xl p-3 text-sm ${
                          r.senderRole === 'admin' ? 'bg-indigo-50 text-indigo-950' : 'bg-slate-50 text-slate-800'
                        }`}
                      >
                        <p className="text-xs font-bold">{r.senderName}</p>
                        <p className="mt-0.5">{r.message}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Reply to user..."
                      value={ticketReplies[t.id] || ''}
                      onChange={(e) => setTicketReplies((p) => ({ ...p, [t.id]: e.target.value }))}
                      className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const message = (ticketReplies[t.id] || '').trim();
                        if (!message) return;
                        await apiRequest(`/tickets/${t.id}/reply`, {
                          method: 'POST',
                          body: JSON.stringify({ message }),
                        });
                        setTicketReplies((p) => ({ ...p, [t.id]: '' }));
                        await loadAllAdmin();
                      }}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
                    >
                      Send Reply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SITE SETTINGS */}
          {tab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-display text-base font-bold text-slate-900">Marketplace Configuration</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Platform Name</label>
                  <input
                    type="text"
                    value={settings.siteName}
                    onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Currency Symbol</label>
                  <input
                    type="text"
                    value={settings.currencySymbol}
                    onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Platform Job Fee (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.platformFeePercent}
                    onChange={(e) => setSettings({ ...settings, platformFeePercent: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Referral Commission (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.referralCommissionPercent}
                    onChange={(e) => setSettings({ ...settings, referralCommissionPercent: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Min Workers Per Job</label>
                  <input
                    type="number"
                    value={settings.minJobWorkers}
                    onChange={(e) => setSettings({ ...settings, minJobWorkers: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Support Email</label>
                  <input
                    type="email"
                    value={settings.supportEmail}
                    onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Dashboard Notice Banner</label>
                <textarea
                  rows={2}
                  value={settings.noticeBanner}
                  onChange={(e) => setSettings({ ...settings, noticeBanner: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.autoApproveJobs}
                  onChange={(e) => setSettings({ ...settings, autoApproveJobs: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                Auto-approve employer campaigns immediately (skip moderation queue)
              </label>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
              >
                Save Settings
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}

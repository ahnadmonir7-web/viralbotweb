import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  Briefcase,
  CheckCircle2,
  CreditCard,
  Edit3,
  FileText,
  Home,
  Layout,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  LogOut,
  Menu,
  Palette,
  PauseCircle,
  PlayCircle,
  Plus,
  Settings,
  Star,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../api/client.ts';
import type {
  ActivityLog,
  BlogPost,
  BootstrapPayload,
  Category,
  CmsPage,
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
import { formatMoney, formatReward } from '../utils/colors.ts';
import { BlogManagerTab, PagesCmsTab, WebsiteSettingsTab } from './admin/CmsTabs.tsx';

type AdminTab =
  | 'overview'
  | 'jobs'
  | 'categories'
  | 'deposits'
  | 'withdrawals'
  | 'users'
  | 'gateways'
  | 'branding'
  | 'homepage'
  | 'blog'
  | 'pages'
  | 'tickets'
  | 'settings';

interface AdminOverviewStats {
  totalUsers: number;
  activeJobs: number;
  pendingJobs: number;
  pendingDeposits: number;
  pendingDepositsAmount: number;
  approvedDepositsAmount: number;
  pendingWithdrawals: number;
  pendingWithdrawalsAmount: number;
  approvedWithdrawalsAmount: number;
  openTickets: number;
  platformRevenue: number;
  totalUserEarnings: number;
  totalUserDeposits: number;
  publishedBlogs: number;
  publishedPages: number;
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
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(bootstrap.blogPosts || []);
  const [pages, setPages] = useState<CmsPage[]>(bootstrap.pages || []);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(bootstrap.settings);

  // Filters
  const [depFilter, setDepFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [wdFilter, setWdFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [userSearch, setUserSearch] = useState('');

  // Category Form (Create/Edit)
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('indigo');
  const [catMin, setCatMin] = useState('0.05');
  const [catDesc, setCatDesc] = useState('');

  // Gateway Form (Create/Edit)
  const [editGwId, setEditGwId] = useState<number | null>(null);
  const [gwName, setGwName] = useState('');
  const [gwType, setGwType] = useState<'both' | 'deposit' | 'withdraw'>('both');
  const [gwAccount, setGwAccount] = useState('');
  const [gwInst, setGwInst] = useState('');
  const [gwMin, setGwMin] = useState('2');
  const [gwMax, setGwMax] = useState('1000');
  const [gwFee, setGwFee] = useState('2');
  const [gwColor, setGwColor] = useState('indigo');

  // Manual Deposit Form
  const [manDepOpen, setManDepOpen] = useState(false);
  const [manDepUserId, setManDepUserId] = useState<number>(0);
  const [manDepGwId, setManDepGwId] = useState<number>(0);
  const [manDepAmount, setManDepAmount] = useState('10');
  const [manDepWallet, setManDepWallet] = useState<'deposit' | 'earning'>('deposit');
  const [manDepTrx, setManDepTrx] = useState('');
  const [manDepNote, setManDepNote] = useState('Manual Admin Credit');

  // Manual Withdraw Form
  const [manWdOpen, setManWdOpen] = useState(false);
  const [manWdUserId, setManWdUserId] = useState<number>(0);
  const [manWdGwId, setManWdGwId] = useState<number>(0);
  const [manWdAmount, setManWdAmount] = useState('5');
  const [manWdAccount, setManWdAccount] = useState('');
  const [manWdNote, setManWdNote] = useState('Manual Admin Payout');

  // Job Create / Edit Modal
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobCatId, setJobCatId] = useState<number>(1);
  const [jobRegion, setJobRegion] = useState('Worldwide');
  const [jobUrl, setJobUrl] = useState('https://');
  const [jobStepsText, setJobStepsText] = useState('Open the campaign URL.\nComplete the requested action.\nTake a clear screenshot.');
  const [jobProofReq, setJobProofReq] = useState('Submit your username and screenshot.');
  const [jobRequireShot, setJobRequireShot] = useState(true);
  const [jobReward, setJobReward] = useState('0.10');
  const [jobWorkers, setJobWorkers] = useState('50');
  const [jobFeatured, setJobFeatured] = useState(true);
  const [jobStatus, setJobStatus] = useState<MicroJob['status']>('active');

  // User Create / Edit + Activity Modal
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUName, setNewUName] = useState('');
  const [newUUsername, setNewUUsername] = useState('');
  const [newUPhone, setNewUPhone] = useState('');
  const [newUEmail, setNewUEmail] = useState('');
  const [newUPassword, setNewUPassword] = useState('');
  const [newUCountry, setNewUCountry] = useState('Bangladesh');
  const [newURole, setNewURole] = useState<'user' | 'admin'>('user');
  const [newUDepBal, setNewUDepBal] = useState('5');
  const [newUEarnBal, setNewUEarnBal] = useState('0');

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [euName, setEuName] = useState('');
  const [euUsername, setEuUsername] = useState('');
  const [euPhone, setEuPhone] = useState('');
  const [euEmail, setEuEmail] = useState('');
  const [euCountry, setEuCountry] = useState('');
  const [euRole, setEuRole] = useState<'user' | 'admin'>('user');
  const [euStatus, setEuStatus] = useState<'active' | 'banned'>('active');
  const [euKyc, setEuKyc] = useState<User['kycStatus']>('unverified');
  const [euPass, setEuPass] = useState('');
  const [userActivity, setUserActivity] = useState<{ transactions: WalletTransaction[]; proofs: JobProof[] } | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<number | null>(null);

  const [adjustAmt, setAdjustAmt] = useState<Record<number, string>>({});
  const [adjustWallet, setAdjustWallet] = useState<Record<number, 'deposit' | 'earning'>>({});
  const [ticketReplies, setTicketReplies] = useState<Record<number, string>>({});

  const sym = settings.currencySymbol || '$';

  const feedback = useCallback((type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
  }, []);

  const loadAllAdmin = useCallback(async () => {
    try {
      const [ov, jb, ct, dp, wd, us, gw, tk, st, bl, pg, lg] = await Promise.all([
        apiRequest<AdminOverviewStats>('/admin/overview'),
        apiRequest<{ jobs: MicroJob[] }>('/admin/jobs'),
        apiRequest<{ categories: Category[] }>('/admin/categories'),
        apiRequest<{ deposits: DepositRequest[] }>('/admin/deposits'),
        apiRequest<{ withdrawals: WithdrawRequest[] }>('/admin/withdrawals'),
        apiRequest<{ users: User[] }>('/admin/users'),
        apiRequest<{ gateways: Gateway[] }>('/admin/gateways'),
        apiRequest<{ tickets: SupportTicket[] }>('/admin/tickets'),
        apiRequest<{ settings: SiteSettings }>('/admin/settings'),
        apiRequest<{ posts: BlogPost[] }>('/admin/blog'),
        apiRequest<{ pages: CmsPage[] }>('/admin/pages'),
        apiRequest<{ logs: ActivityLog[] }>('/admin/activity'),
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
      setBlogPosts(bl.posts);
      setPages(pg.pages);
      setLogs(lg.logs);

      const firstMember = us.users.find((u) => u.role === 'user') || us.users[0];
      if (firstMember) {
        setManDepUserId((prev) => prev || firstMember.id);
        setManWdUserId((prev) => prev || firstMember.id);
      }
      if (gw.gateways[0]) {
        setManDepGwId((prev) => prev || gw.gateways[0].id);
        setManWdGwId((prev) => prev || gw.gateways[0].id);
      }
      if (ct.categories[0]) {
        setJobCatId((prev) => prev || ct.categories[0].id);
      }
    } catch (err) {
      setMsg({ type: 'err', text: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    loadAllAdmin();
  }, [loadAllAdmin]);

  async function refreshAll() {
    await Promise.all([loadAllAdmin(), onRefreshBootstrap()]);
  }

  async function jobDecision(jobId: number, action: 'approve' | 'reject' | 'pause' | 'toggle_feature' | 'delete', reason = '') {
    try {
      await apiRequest(`/admin/jobs/${jobId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ action, reason }),
      });
      await refreshAll();
      feedback('ok', `Job #${jobId} updated (${action}).`);
    } catch (err) {
      feedback('err', (err as Error).message);
    }
  }

  function openNewJobModal() {
    setEditingJobId(null);
    setJobTitle('');
    setJobCatId(categories[0]?.id || 1);
    setJobRegion('Worldwide');
    setJobUrl('https://');
    setJobStepsText('Open the target link provided.\nComplete the required action carefully.\nUpload clear screenshot proof.');
    setJobProofReq('Submit your username and confirmation screenshot.');
    setJobRequireShot(true);
    setJobReward('0.10');
    setJobWorkers('50');
    setJobFeatured(true);
    setJobStatus('active');
    setJobModalOpen(true);
  }

  function openEditJobModal(job: MicroJob) {
    setEditingJobId(job.id);
    setJobTitle(job.title);
    setJobCatId(job.categoryId);
    setJobRegion(job.targetRegion);
    setJobUrl(job.targetUrl);
    setJobStepsText(job.steps.join('\n'));
    setJobProofReq(job.proofRequirement);
    setJobRequireShot(job.requireScreenshot);
    setJobReward(String(job.rewardPerWorker));
    setJobWorkers(String(job.workersNeeded));
    setJobFeatured(job.featured);
    setJobStatus(job.status);
    setJobModalOpen(true);
  }

  async function handleSaveJobModal(e: React.FormEvent) {
    e.preventDefault();
    try {
      const steps = jobStepsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        categoryId: jobCatId,
        title: jobTitle,
        targetRegion: jobRegion,
        targetUrl: jobUrl,
        steps,
        proofRequirement: jobProofReq,
        requireScreenshot: jobRequireShot,
        rewardPerWorker: Number(jobReward),
        workersNeeded: Number(jobWorkers),
        featured: jobFeatured,
        status: jobStatus,
      };
      if (editingJobId) {
        await apiRequest(`/admin/jobs/${editingJobId}`, { method: 'PUT', body: JSON.stringify(payload) });
        feedback('ok', `Campaign #${editingJobId} updated.`);
      } else {
        await apiRequest('/admin/jobs', { method: 'POST', body: JSON.stringify(payload) });
        feedback('ok', 'Official campaign published.');
      }
      setJobModalOpen(false);
      await refreshAll();
    } catch (err) {
      feedback('err', (err as Error).message);
    }
  }

  async function depositDecision(id: number, decision: 'approved' | 'rejected') {
    try {
      await apiRequest(`/admin/deposits/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      await loadAllAdmin();
      feedback('ok', `Deposit #${id} ${decision}.`);
    } catch (err) {
      feedback('err', (err as Error).message);
    }
  }

  async function handleManualDeposit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/admin/deposits/manual', {
        method: 'POST',
        body: JSON.stringify({
          userId: manDepUserId,
          gatewayId: manDepGwId,
          amount: Number(manDepAmount),
          wallet: manDepWallet,
          trxId: manDepTrx,
          note: manDepNote,
        }),
      });
      setManDepTrx('');
      setManDepOpen(false);
      await loadAllAdmin();
      feedback('ok', 'Manual deposit credited and logged.');
    } catch (err) {
      feedback('err', (err as Error).message);
    }
  }

  async function withdrawDecision(id: number, decision: 'approved' | 'rejected') {
    try {
      await apiRequest(`/admin/withdrawals/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      await refreshAll();
      feedback('ok', `Withdrawal #${id} ${decision}.`);
    } catch (err) {
      feedback('err', (err as Error).message);
    }
  }

  async function handleManualWithdraw(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/admin/withdrawals/manual', {
        method: 'POST',
        body: JSON.stringify({
          userId: manWdUserId,
          gatewayId: manWdGwId,
          amount: Number(manWdAmount),
          accountNumber: manWdAccount,
          note: manWdNote,
        }),
      });
      setManWdAccount('');
      setManWdOpen(false);
      await refreshAll();
      feedback('ok', 'Manual payout recorded and deducted from Earning Balance.');
    } catch (err) {
      feedback('err', (err as Error).message);
    }
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = { name: catName, color: catColor, minCpc: Number(catMin), description: catDesc, active: true };
      if (editCatId) {
        await apiRequest(`/admin/categories/${editCatId}`, { method: 'PUT', body: JSON.stringify(payload) });
        feedback('ok', 'Category updated.');
      } else {
        await apiRequest('/admin/categories', { method: 'POST', body: JSON.stringify(payload) });
        feedback('ok', 'Category added.');
      }
      setEditCatId(null);
      setCatName('');
      setCatDesc('');
      await refreshAll();
    } catch (err) {
      feedback('err', (err as Error).message);
    }
  }

  async function handleSaveGateway(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        name: gwName,
        type: gwType,
        accountDetails: gwAccount,
        instructions: gwInst,
        minAmount: Number(gwMin),
        maxAmount: Number(gwMax),
        feePercent: Number(gwFee),
        color: gwColor,
        active: true,
      };
      if (editGwId) {
        await apiRequest(`/admin/gateways/${editGwId}`, { method: 'PUT', body: JSON.stringify(payload) });
        feedback('ok', 'Payment gateway updated.');
      } else {
        await apiRequest('/admin/gateways', { method: 'POST', body: JSON.stringify(payload) });
        feedback('ok', 'Payment gateway added.');
      }
      setEditGwId(null);
      setGwName('');
      setGwAccount('');
      setGwInst('');
      await refreshAll();
    } catch (err) {
      feedback('err', (err as Error).message);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newUName || newUUsername,
          username: newUUsername,
          phone: newUPhone,
          email: newUEmail,
          password: newUPassword,
          country: newUCountry,
          role: newURole,
          depositBalance: Number(newUDepBal),
          earningBalance: Number(newUEarnBal),
        }),
      });
      setCreateUserOpen(false);
      setNewUName('');
      setNewUUsername('');
      setNewUPhone('');
      setNewUEmail('');
      setNewUPassword('');
      await loadAllAdmin();
      feedback('ok', 'New user account created.');
    } catch (err) {
      feedback('err', (err as Error).message);
    }
  }

  async function openEditUserModal(u: User) {
    setEditingUser(u);
    setEuName(u.name);
    setEuUsername(u.username || u.name);
    setEuPhone(u.phone || '');
    setEuEmail(u.email);
    setEuCountry(u.country);
    setEuRole(u.role);
    setEuStatus(u.status);
    setEuKyc(u.kycStatus);
    setEuPass('');
    setUserActivity(null);
    try {
      const act = await apiRequest<{ transactions: WalletTransaction[]; proofs: JobProof[] }>(
        `/admin/users/${u.id}/activity`
      );
      setUserActivity(act);
    } catch {
      // Optional activity view
    }
  }

  async function handleSaveUserModal(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await apiRequest(`/admin/users/${editingUser.id}/update`, {
        method: 'POST',
        body: JSON.stringify({
          name: euName,
          username: euUsername,
          phone: euPhone,
          email: euEmail,
          country: euCountry,
          role: euRole,
          status: euStatus,
          kycStatus: euKyc,
          ...(euPass.length >= 6 ? { newPassword: euPass } : {}),
        }),
      });
      setEditingUser(null);
      await loadAllAdmin();
      feedback('ok', `Updated account for ${euName}.`);
    } catch (err) {
      feedback('err', (err as Error).message);
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
      feedback('ok', `User #${uid} updated.`);
    } catch (err) {
      feedback('err', (err as Error).message);
    }
  }

  async function handleDeleteUser(uid: number) {
    try {
      await apiRequest(`/admin/users/${uid}`, { method: 'DELETE' });
      setConfirmDeleteUserId(null);
      await loadAllAdmin();
      feedback('ok', `User #${uid} removed.`);
    } catch (err) {
      feedback('err', (err as Error).message);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      await refreshAll();
      feedback('ok', 'Website & system settings saved.');
    } catch (err) {
      feedback('err', (err as Error).message);
    }
  }

  const navSections: Array<{
    heading: string;
    items: Array<{ id: AdminTab; label: string; icon: React.ReactNode; badge?: number }>;
  }> = [
    {
      heading: 'Operations',
      items: [
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
        { id: 'jobs', label: 'Manage Jobs', icon: <Briefcase className="h-4 w-4" />, badge: overview?.pendingJobs },
        { id: 'categories', label: 'Categories', icon: <Layers className="h-4 w-4" /> },
        { id: 'users', label: 'Users & KYC', icon: <Users className="h-4 w-4" /> },
        { id: 'tickets', label: 'Tickets', icon: <LifeBuoy className="h-4 w-4" />, badge: overview?.openTickets },
      ],
    },
    {
      heading: 'Finance & Gateways',
      items: [
        { id: 'deposits', label: 'Deposits', icon: <Wallet className="h-4 w-4" />, badge: overview?.pendingDeposits },
        {
          id: 'withdrawals',
          label: 'Withdrawals',
          icon: <CreditCard className="h-4 w-4" />,
          badge: overview?.pendingWithdrawals,
        },
        { id: 'gateways', label: 'Payment Gateways', icon: <CreditCard className="h-4 w-4" /> },
      ],
    },
    {
      heading: 'Website & CMS Control',
      items: [
        { id: 'branding', label: 'Website & Logo', icon: <Palette className="h-4 w-4" /> },
        { id: 'homepage', label: 'Home Page Builder', icon: <Layout className="h-4 w-4" /> },
        { id: 'blog', label: 'Blog Manager', icon: <BookOpen className="h-4 w-4" /> },
        { id: 'pages', label: 'All Pages CMS', icon: <FileText className="h-4 w-4" /> },
        { id: 'settings', label: 'System Controls', icon: <Settings className="h-4 w-4" /> },
      ],
    },
  ];

  const allNavItems = navSections.flatMap((s) => s.items);

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

  const filteredDeposits = deposits.filter((d) => depFilter === 'all' || d.status === depFilter);
  const filteredWithdrawals = withdrawals.filter((w) => wdFilter === 'all' || w.status === wdFilter);

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      {/* Dark Indigo Admin Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-950 text-slate-200 lg:flex">
        <div className="border-b border-slate-800 px-6 py-5">
          <p className="font-display text-lg font-extrabold text-white">{settings.siteName} Admin</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">{admin.email}</p>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {navSections.map((sec) => (
            <div key={sec.heading}>
              <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {sec.heading}
              </p>
              <div className="space-y-0.5">
                {sec.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      setMsg(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      tab === item.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
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
              </div>
            </div>
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
          <div className="relative z-10 flex w-64 flex-col overflow-y-auto bg-slate-950 p-4 text-slate-200">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-display text-base font-bold text-white">Admin Panel</span>
              <button type="button" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-4">
              {navSections.map((sec) => (
                <div key={sec.heading}>
                  <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {sec.heading}
                  </p>
                  {sec.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTab(item.id);
                        setMobileOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                        tab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        {item.icon}
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
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
              {allNavItems.find((n) => n.id === tab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackPublic}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Live Website
            </button>
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
                  <p className="mt-1 text-xs text-slate-500">
                    {overview.activeJobs} active · {overview.pendingJobs} pending jobs
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-white p-5">
                  <p className="text-xs font-semibold text-slate-500">Approved Deposits</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-sky-700 tabular-nums">
                    {formatMoney(overview.approvedDepositsAmount, sym)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Pending: {overview.pendingDeposits} ({formatMoney(overview.pendingDepositsAmount, sym)})
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-white p-5">
                  <p className="text-xs font-semibold text-slate-500">Approved Payouts</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-amber-600 tabular-nums">
                    {formatMoney(overview.approvedWithdrawalsAmount, sym)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Pending: {overview.pendingWithdrawals} ({formatMoney(overview.pendingWithdrawalsAmount, sym)})
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-white p-5">
                  <p className="text-xs font-semibold text-slate-500">Platform Fee Revenue</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-emerald-600 tabular-nums">
                    {formatMoney(overview.platformRevenue, sym)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    CMS: {overview.publishedBlogs} articles · {overview.publishedPages} pages
                  </p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                {/* Wallet Cashflow & Quick Actions */}
                <div className="space-y-4 lg:col-span-7">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                    <h2 className="font-display text-sm font-bold text-slate-900">Wallet Liabilities & Cashflow</h2>
                    {(() => {
                      const totalLiab = Math.max(0.01, overview.totalUserEarnings + overview.totalUserDeposits);
                      const earnPct = Math.round((overview.totalUserEarnings / totalLiab) * 100);
                      const depPct = 100 - earnPct;
                      return (
                        <div className="space-y-3 text-xs">
                          <div>
                            <div className="mb-1 flex justify-between font-medium">
                              <span className="text-slate-600">User Earning Balances (Withdrawable)</span>
                              <span className="font-mono font-bold text-emerald-700 tabular-nums">
                                {formatMoney(overview.totalUserEarnings, sym)}
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${earnPct}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 flex justify-between font-medium">
                              <span className="text-slate-600">Employer Deposit Wallets (Campaign Escrow)</span>
                              <span className="font-mono font-bold text-indigo-700 tabular-nums">
                                {formatMoney(overview.totalUserDeposits, sym)}
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-indigo-600" style={{ width: `${depPct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setTab('branding')}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-indigo-300"
                    >
                      <p className="font-display text-sm font-bold text-slate-900">Logo & Branding</p>
                      <p className="mt-1 text-xs text-slate-500">Edit site name, logo & theme</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('deposits')}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-indigo-300"
                    >
                      <p className="font-display text-sm font-bold text-slate-900">Manual Deposit</p>
                      <p className="mt-1 text-xs text-slate-500">Credit any member wallet</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('blog')}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-indigo-300"
                    >
                      <p className="font-display text-sm font-bold text-slate-900">Blog & Pages</p>
                      <p className="mt-1 text-xs text-slate-500">Publish website content</p>
                    </button>
                  </div>
                </div>

                {/* Recent Admin Activity */}
                <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-5">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <span className="flex items-center gap-2 font-display text-sm font-bold text-slate-900">
                      <Activity className="h-4 w-4 text-indigo-600" />
                      Recent Admin Actions
                    </span>
                    <button
                      type="button"
                      onClick={() => setTab('settings')}
                      className="text-xs font-semibold text-indigo-600"
                    >
                      Full Log
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {logs.slice(0, 6).map((log) => (
                      <div key={log.id} className="px-5 py-3 text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="font-bold text-slate-900">{log.action}</span>
                          <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="mt-0.5 text-slate-600">{log.details}</p>
                      </div>
                    ))}
                    {logs.length === 0 && (
                      <p className="p-6 text-center text-xs text-slate-500">No recent admin changes yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MANAGE JOBS */}
          {tab === 'jobs' && (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
                <h2 className="font-display text-base font-bold text-slate-900">All Campaigns ({jobs.length})</h2>
                <button
                  type="button"
                  onClick={openNewJobModal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Create Official Job
                </button>
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
                      {(job.status === 'active' || job.status === 'paused') && (
                        <button
                          type="button"
                          onClick={() => jobDecision(job.id, 'pause')}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {job.status === 'paused' ? (
                            <>
                              <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                              Resume
                            </>
                          ) : (
                            <>
                              <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                              Pause
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditJobModal(job)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
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
                onSubmit={handleSaveCategory}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-4 self-start"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-slate-900">
                    {editCatId ? 'Edit Category' : 'Add Job Category'}
                  </h2>
                  {editCatId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditCatId(null);
                        setCatName('');
                        setCatDesc('');
                      }}
                      className="text-xs font-semibold text-slate-500"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Category Name"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
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
                    value={catMin}
                    onChange={(e) => setCatMin(e.target.value)}
                    placeholder="Min CPC"
                    className="rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Short description"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                >
                  {editCatId ? 'Update Category' : 'Save Category'}
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
                        onClick={() => {
                          setEditCatId(cat.id);
                          setCatName(cat.name);
                          setCatColor(cat.color);
                          setCatMin(String(cat.minCpc));
                          setCatDesc(cat.description);
                        }}
                        className="rounded-lg border border-slate-200 p-1.5 text-indigo-600 hover:bg-indigo-50"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/admin/categories/${cat.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ ...cat, active: !cat.active }),
                          });
                          await refreshAll();
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
                          await refreshAll();
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

          {/* DEPOSITS + MANUAL DEPOSIT */}
          {tab === 'deposits' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setDepFilter(st)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${
                        depFilter === st ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setManDepOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Manual Deposit Credit
                </button>
              </div>

              {manDepOpen && (
                <form
                  onSubmit={handleManualDeposit}
                  className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 sm:grid-cols-6"
                >
                  <div className="sm:col-span-6 flex items-center justify-between">
                    <p className="font-display text-sm font-bold text-slate-900">Issue Direct Manual Deposit</p>
                    <button type="button" onClick={() => setManDepOpen(false)} className="text-xs text-slate-500">
                      Close
                    </button>
                  </div>
                  <select
                    value={manDepUserId}
                    onChange={(e) => setManDepUserId(Number(e.target.value))}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:col-span-2"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} (@{u.username || u.name})
                      </option>
                    ))}
                  </select>
                  <select
                    value={manDepGwId}
                    onChange={(e) => setManDepGwId(Number(e.target.value))}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    {gateways.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={manDepAmount}
                    onChange={(e) => setManDepAmount(e.target.value)}
                    placeholder="Amount"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
                  />
                  <select
                    value={manDepWallet}
                    onChange={(e) => setManDepWallet(e.target.value as 'deposit' | 'earning')}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="deposit">Deposit Wallet</option>
                    <option value="earning">Earning Wallet</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Credit Now
                  </button>
                  <input
                    type="text"
                    value={manDepTrx}
                    onChange={(e) => setManDepTrx(e.target.value)}
                    placeholder="Optional TrxID / Reference"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:col-span-3"
                  />
                  <input
                    type="text"
                    value={manDepNote}
                    onChange={(e) => setManDepNote(e.target.value)}
                    placeholder="Admin Note"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:col-span-3"
                  />
                </form>
              )}

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
                    {filteredDeposits.map((d) => (
                      <tr key={d.id}>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900">{d.userName}</p>
                          <p className="text-xs text-slate-500">{d.userEmail}</p>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <p className="font-semibold text-slate-800">{d.gatewayName}</p>
                          <p className="font-mono text-slate-500">{d.trxId}</p>
                          {d.adminNote && <p className="text-slate-500">{d.adminNote}</p>}
                          {d.screenshotUrl && (
                            <a
                              href={d.screenshotUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 underline"
                            >
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
            </div>
          )}

          {/* WITHDRAWALS + MANUAL PAYOUT */}
          {tab === 'withdrawals' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setWdFilter(st)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${
                        wdFilter === st ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setManWdOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Manual Payout Entry
                </button>
              </div>

              {manWdOpen && (
                <form
                  onSubmit={handleManualWithdraw}
                  className="grid gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 sm:grid-cols-6"
                >
                  <div className="sm:col-span-6 flex items-center justify-between">
                    <p className="font-display text-sm font-bold text-slate-900">
                      Issue Manual Worker Withdrawal / Payout
                    </p>
                    <button type="button" onClick={() => setManWdOpen(false)} className="text-xs text-slate-500">
                      Close
                    </button>
                  </div>
                  <select
                    value={manWdUserId}
                    onChange={(e) => setManWdUserId(Number(e.target.value))}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:col-span-2"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} (Earn: {formatMoney(u.earningBalance, sym)})
                      </option>
                    ))}
                  </select>
                  <select
                    value={manWdGwId}
                    onChange={(e) => setManWdGwId(Number(e.target.value))}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    {gateways.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.feePercent}% fee)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={manWdAmount}
                    onChange={(e) => setManWdAmount(e.target.value)}
                    placeholder="Gross Amount"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={manWdAccount}
                    onChange={(e) => setManWdAccount(e.target.value)}
                    placeholder="Receiving Wallet / Phone"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    Send Payout
                  </button>
                  <input
                    type="text"
                    value={manWdNote}
                    onChange={(e) => setManWdNote(e.target.value)}
                    placeholder="Payout Note / Reference"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:col-span-6"
                  />
                </form>
              )}

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
                    {filteredWithdrawals.map((w) => (
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
            </div>
          )}

          {/* USERS & KYC */}
          {tab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users by name, username, phone, or email..."
                  className="min-w-[240px] flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setCreateUserOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  <UserPlus className="h-4 w-4" />
                  Create User
                </button>
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

                    <div className="flex flex-wrap items-center gap-2">
                      {u.role !== 'admin' && u.kycStatus === 'pending' && (
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
                      {u.role !== 'admin' && (
                        <>
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
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditUserModal(u)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit / Ledger
                      </button>
                      {u.id !== admin.id && (
                        <>
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
                          {confirmDeleteUserId === u.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id)}
                                className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserId(null)}
                                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUserId(u.id)}
                              className="rounded-lg border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-50"
                              aria-label="Delete user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PAYMENT GATEWAYS */}
          {tab === 'gateways' && (
            <div className="grid gap-6 lg:grid-cols-12">
              <form
                onSubmit={handleSaveGateway}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-4 self-start"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-slate-900">
                    {editGwId ? 'Edit Payment Gateway' : 'Add Payment Gateway'}
                  </h2>
                  {editGwId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditGwId(null);
                        setGwName('');
                        setGwAccount('');
                        setGwInst('');
                      }}
                      className="text-xs font-semibold text-slate-500"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={gwName}
                  onChange={(e) => setGwName(e.target.value)}
                  placeholder="Gateway Name (e.g. Rocket)"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={gwType}
                    onChange={(e) => setGwType(e.target.value as 'both' | 'deposit' | 'withdraw')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  >
                    <option value="both">Deposit & Withdraw</option>
                    <option value="deposit">Deposit Only</option>
                    <option value="withdraw">Withdraw Only</option>
                  </select>
                  <select
                    value={gwColor}
                    onChange={(e) => setGwColor(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  >
                    <option value="indigo">Indigo</option>
                    <option value="rose">Rose</option>
                    <option value="amber">Amber</option>
                    <option value="emerald">Emerald</option>
                    <option value="sky">Sky</option>
                    <option value="violet">Violet</option>
                  </select>
                </div>
                <input
                  type="text"
                  required
                  value={gwAccount}
                  onChange={(e) => setGwAccount(e.target.value)}
                  placeholder="Receiving Account / Pay ID"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
                <textarea
                  rows={2}
                  value={gwInst}
                  onChange={(e) => setGwInst(e.target.value)}
                  placeholder="Instructions shown to users"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500">Min</label>
                    <input
                      type="number"
                      value={gwMin}
                      onChange={(e) => setGwMin(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-2.5 py-2 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500">Max</label>
                    <input
                      type="number"
                      value={gwMax}
                      onChange={(e) => setGwMax(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-2.5 py-2 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500">Fee %</label>
                    <input
                      type="number"
                      step="0.5"
                      value={gwFee}
                      onChange={(e) => setGwFee(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-2.5 py-2 font-mono text-xs"
                    />
                  </div>
                </div>
                <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white">
                  {editGwId ? 'Update Gateway' : 'Create Gateway'}
                </button>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-8 divide-y divide-slate-100">
                {gateways.map((gw) => (
                  <div key={gw.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
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
                        onClick={() => {
                          setEditGwId(gw.id);
                          setGwName(gw.name);
                          setGwType(gw.type);
                          setGwAccount(gw.accountDetails);
                          setGwInst(gw.instructions);
                          setGwMin(String(gw.minAmount));
                          setGwMax(String(gw.maxAmount));
                          setGwFee(String(gw.feePercent));
                          setGwColor(gw.color || 'indigo');
                        }}
                        className="rounded-lg border border-slate-200 p-1.5 text-indigo-600 hover:bg-indigo-50"
                        title="Edit Gateway"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/admin/gateways/${gw.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ ...gw, active: !gw.active }),
                          });
                          await refreshAll();
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
                          await refreshAll();
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

          {/* WEBSITE & LOGO / HOME PAGE BUILDER / SYSTEM CONTROLS */}
          {(tab === 'branding' || tab === 'homepage' || tab === 'settings') && (
            <WebsiteSettingsTab
              mode={tab}
              settings={settings}
              setSettings={setSettings}
              logs={logs}
              onSaveSettings={handleSaveSettings}
              onFeedback={feedback}
            />
          )}

          {/* BLOG MANAGER */}
          {tab === 'blog' && <BlogManagerTab posts={blogPosts} onChanged={refreshAll} onFeedback={feedback} />}

          {/* ALL PAGES CMS */}
          {tab === 'pages' && <PagesCmsTab pages={pages} onChanged={refreshAll} onFeedback={feedback} />}

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
        </main>
      </div>

      {/* CREATE / EDIT JOB MODAL */}
      {jobModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {editingJobId ? `Edit Campaign #${editingJobId}` : 'Create Official Campaign'}
              </h3>
              <button type="button" onClick={() => setJobModalOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveJobModal} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Campaign Title</label>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Category</label>
                  <select
                    value={jobCatId}
                    onChange={(e) => setJobCatId(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Target Region</label>
                  <input
                    type="text"
                    value={jobRegion}
                    onChange={(e) => setJobRegion(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Target URL</label>
                <input
                  type="text"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Steps (1 step per line)</label>
                <textarea
                  rows={3}
                  required
                  value={jobStepsText}
                  onChange={(e) => setJobStepsText(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Required Proof Instructions</label>
                <input
                  type="text"
                  required
                  value={jobProofReq}
                  onChange={(e) => setJobProofReq(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Reward ({sym})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={jobReward}
                    onChange={(e) => setJobReward(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Workers Needed</label>
                  <input
                    type="number"
                    min="1"
                    value={jobWorkers}
                    onChange={(e) => setJobWorkers(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                {editingJobId && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Status</label>
                    <select
                      value={jobStatus}
                      onChange={(e) => setJobStatus(e.target.value as MicroJob['status'])}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={jobRequireShot}
                    onChange={(e) => setJobRequireShot(e.target.checked)}
                  />
                  Require Screenshot Proof
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={jobFeatured} onChange={(e) => setJobFeatured(e.target.checked)} />
                  Featured on Homepage
                </label>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
              >
                {editingJobId ? 'Save Campaign Changes' : 'Publish Official Campaign'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {createUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-900">Create Member Account</h3>
              <button type="button" onClick={() => setCreateUserOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={newUUsername}
                  onChange={(e) => setNewUUsername(e.target.value)}
                  placeholder="Username"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={newUName}
                  onChange={(e) => setNewUName(e.target.value)}
                  placeholder="Display Name"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <input
                type="text"
                value={newUPhone}
                onChange={(e) => setNewUPhone(e.target.value)}
                placeholder="Phone Number"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
              />
              <input
                type="email"
                value={newUEmail}
                onChange={(e) => setNewUEmail(e.target.value)}
                placeholder="Email (optional if Phone given)"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
              />
              <input
                type="password"
                required
                minLength={6}
                value={newUPassword}
                onChange={(e) => setNewUPassword(e.target.value)}
                placeholder="Password (6+ chars)"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newUCountry}
                  onChange={(e) => setNewUCountry(e.target.value)}
                  placeholder="Country"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={newURole}
                  onChange={(e) => setNewURole(e.target.value as 'user' | 'admin')}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="user">Member (User)</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Opening Deposit ({sym})</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newUDepBal}
                    onChange={(e) => setNewUDepBal(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Opening Earning ({sym})</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newUEarnBal}
                    onChange={(e) => setNewUEarnBal(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
              >
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER + LEDGER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Manage Member #{editingUser.id} · {editingUser.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Earning {formatMoney(editingUser.earningBalance, sym)} · Deposit{' '}
                  {formatMoney(editingUser.depositBalance, sym)}
                </p>
              </div>
              <button type="button" onClick={() => setEditingUser(null)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSaveUserModal} className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={euName}
                  onChange={(e) => setEuName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Username</label>
                <input
                  type="text"
                  required
                  value={euUsername}
                  onChange={(e) => setEuUsername(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Phone Number</label>
                <input
                  type="text"
                  value={euPhone}
                  onChange={(e) => setEuPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={euEmail}
                  onChange={(e) => setEuEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Country</label>
                <input
                  type="text"
                  value={euCountry}
                  onChange={(e) => setEuCountry(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Reset Password (Optional)</label>
                <input
                  type="password"
                  minLength={6}
                  value={euPass}
                  onChange={(e) => setEuPass(e.target.value)}
                  placeholder="Leave blank to keep existing"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Account Status</label>
                <select
                  value={euStatus}
                  disabled={editingUser.id === admin.id}
                  onChange={(e) => setEuStatus(e.target.value as 'active' | 'banned')}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="banned">Banned</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">KYC & Role</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={euKyc}
                    onChange={(e) => setEuKyc(e.target.value as User['kycStatus'])}
                    className="rounded-xl border border-slate-300 px-2.5 py-2 text-xs"
                  >
                    <option value="unverified">Unverified</option>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <select
                    value={euRole}
                    disabled={editingUser.id === admin.id}
                    onChange={(e) => setEuRole(e.target.value as 'user' | 'admin')}
                    className="rounded-xl border border-slate-300 px-2.5 py-2 text-xs"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                >
                  Save Member Profile
                </button>
              </div>
            </form>

            {userActivity && (
              <div className="mt-6 border-t border-slate-100 pt-4 space-y-3">
                <h4 className="font-display text-sm font-bold text-slate-900">
                  Recent Wallet Ledger ({userActivity.transactions.length})
                </h4>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                  {userActivity.transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between gap-3 px-3.5 py-2">
                      <div>
                        <span className="font-semibold text-slate-800">{tx.description}</span>
                        <span className="ml-2 text-slate-400">({tx.wallet})</span>
                      </div>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {tx.amount >= 0 ? '+' : ''}
                        {formatMoney(tx.amount, sym)}
                      </span>
                    </div>
                  ))}
                  {userActivity.transactions.length === 0 && (
                    <p className="p-4 text-center text-slate-400">No wallet transactions recorded.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

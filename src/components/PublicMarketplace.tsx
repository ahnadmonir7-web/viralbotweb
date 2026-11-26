import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  FileText,
  Layers,
  Search,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import type { BlogPost, BootstrapPayload, CmsPage, MicroJob, User } from '../types.ts';
import { formatMoney, formatReward, getColorTheme } from '../utils/colors.ts';

interface PublicMarketplaceProps {
  data: BootstrapPayload;
  currentUser: User | null;
  onOpenAuth: (tab?: 'login' | 'register' | 'admin') => void;
  onGoDashboard: (tab?: string) => void;
  onSelectJob: (job: MicroJob) => void;
}

export function PublicMarketplace({
  data,
  currentUser,
  onOpenAuth,
  onGoDashboard,
  onSelectJob,
}: PublicMarketplaceProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'highest' | 'slots'>('featured');
  const [howMode, setHowMode] = useState<'worker' | 'employer'>('worker');
  const [activePost, setActivePost] = useState<BlogPost | null>(null);
  const [activePage, setActivePage] = useState<CmsPage | null>(null);

  const s = data.settings;
  const sym = s.currencySymbol || '$';
  const brand = getColorTheme(s.accentTheme || 'teal');
  const headerPages = useMemo(() => (data.pages || []).filter((p) => p.published && p.showInHeader), [data.pages]);
  const footerPages = useMemo(() => (data.pages || []).filter((p) => p.published && p.showInFooter), [data.pages]);
  const visiblePosts = useMemo(() => (data.blogPosts || []).filter((p) => p.published), [data.blogPosts]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data.jobs.filter((job) => {
      if (selectedCategory !== 'all' && job.categoryId !== selectedCategory) return false;
      if (q && !job.title.toLowerCase().includes(q) && !job.categoryName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    if (sortBy === 'highest') {
      return [...list].sort((a, b) => b.rewardPerWorker - a.rewardPerWorker);
    }
    if (sortBy === 'slots') {
      return [...list].sort((a, b) => b.workersNeeded - b.workersCompleted - (a.workersNeeded - a.workersCompleted));
    }
    return list;
  }, [data.jobs, search, selectedCategory, sortBy]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-3.5">
          <a
            href="#top"
            className={`flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight ${brand.text} whitespace-nowrap shrink-0`}
          >
            {s.logoUrl ? (
              <img
                src={s.logoUrl}
                alt={s.siteName}
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-xl object-cover border border-slate-200"
              />
            ) : (
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${brand.bg}`}>
                <Zap className="h-5 w-5" />
              </span>
            )}
            <span>{s.siteName}</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#jobs" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              Browse Jobs
            </a>
            <a href="#categories" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              Categories
            </a>
            {s.showBlogSection && visiblePosts.length > 0 ? (
              <a href="#blog" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
                Blog
              </a>
            ) : (
              <a href="#payments" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
                Payments
              </a>
            )}
            {headerPages.slice(0, 2).map((pg) => (
              <button
                key={pg.id}
                type="button"
                onClick={() => setActivePage(pg)}
                className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
              >
                {pg.title}
              </button>
            ))}
            <button
              type="button"
              onClick={() => (currentUser ? onGoDashboard('post-job') : onOpenAuth('register'))}
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Post a Job
            </button>
          </nav>

          <div className="shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={() => onGoDashboard()}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 ${brand.bg} ${brand.hoverBg}`}
              >
                {currentUser.role === 'admin' ? 'Admin Console' : 'My Dashboard'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 ${brand.bg} ${brand.hoverBg}`}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Maintenance Notice Strip if Admin Enables Maintenance Mode */}
      {s.maintenanceMode && (
        <div className="border-b border-amber-300 bg-amber-50 px-6 py-2.5 text-center text-xs font-semibold text-amber-950">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{s.maintenanceMessage || 'Scheduled maintenance is active. Some submissions are paused.'}</span>
          </span>
        </div>
      )}

      {/* Hero Section */}
      <section
        id="top"
        className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-teal-50/90 via-white to-orange-50/75"
      >
        <div className="mx-auto grid max-w-7xl items-stretch gap-10 px-6 py-14 lg:grid-cols-12 lg:py-20">
          <div className="flex flex-col justify-center space-y-6 lg:col-span-6">
            <p className={`text-sm font-semibold ${brand.text}`}>
              {s.heroKicker || 'Human-Verified Micro-Jobs · Instant Task Proofs · Multi-Gateway Payouts'}
            </p>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl [text-wrap:balance]">
              {s.heroTitle || 'Complete small digital tasks daily or launch real-human campaigns.'}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              {s.heroSubtitle ||
                'Workers earn steady payouts for social engagement, app testing, and web research. Employers pay only for approved proofs—never bots.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={() => (currentUser ? onGoDashboard('find-jobs') : onOpenAuth('register'))}
                className={`inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all whitespace-nowrap shrink-0 ${brand.bg} ${brand.hoverBg}`}
              >
                {s.heroPrimaryCta || 'Start Earning Free'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="#jobs"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950 whitespace-nowrap shrink-0"
              >
                {s.heroSecondaryCta || 'Explore Live Tasks'}
              </a>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[300px] overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-700 to-cyan-700 shadow-xl">
              <img
                src={s.heroImageUrl || '/src/assets/images/hero_microjob_workspace_1795645722925.jpg'}
                alt={`${s.siteName} micro-job marketplace`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/95 px-4 py-3 text-xs font-medium text-slate-800 shadow-md backdrop-blur-xs">
                <span>{s.tagline || 'Fast bKash, Nagad, Binance USDT & PayPal payouts'}</span>
                <span className="font-mono font-bold text-emerald-700 tabular-nums">
                  {s.referralCommissionPercent}% Referral Bonus
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width 4-column marketplace stats strip */}
        {s.showStatsStrip && (
          <div className="border-t border-slate-200/80 bg-white/85">
            <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-slate-200/70 sm:grid-cols-4 sm:divide-y-0">
              <div className="px-6 py-5">
                <p className="text-xs font-medium text-slate-500">Active Campaigns</p>
                <p className={`mt-1 font-mono text-2xl font-bold tabular-nums ${brand.text}`}>
                  {data.stats.activeJobsCount}
                </p>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs font-medium text-slate-500">Registered Members</p>
                <p className="mt-1 font-mono text-2xl font-bold text-emerald-600 tabular-nums">
                  {data.stats.totalWorkersCount + 1420}
                </p>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs font-medium text-slate-500">Verified Tasks Paid</p>
                <p className="mt-1 font-mono text-2xl font-bold text-amber-600 tabular-nums">
                  {data.stats.totalTasksPaid + 8640}
                </p>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs font-medium text-slate-500">Minimum Withdraw</p>
                <p className="mt-1 font-mono text-2xl font-bold text-rose-600 tabular-nums">
                  {formatMoney(s.minWithdrawAmount || 2, sym)}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Categories Strip */}
      <section id="categories" className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Task Categories
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Select a category to filter open micro-jobs ready for immediate submission.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`text-sm font-semibold ${brand.text}`}
          >
            View All Categories
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.categories.map((cat) => {
            const theme = getColorTheme(cat.color);
            const active = selectedCategory === cat.id;
            const jobCount = data.jobs.filter((j) => j.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(active ? 'all' : cat.id);
                  document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`group flex items-start gap-4 rounded-2xl border p-5 text-left transition-all ${
                  active
                    ? `${theme.border} ${theme.softBg} ring-2 ring-indigo-500/20`
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${theme.bg}`}>
                  <Layers className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-display text-base font-bold text-slate-900">{cat.name}</h3>
                    <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums shrink-0">
                      {jobCount} open
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{cat.description}</p>
                  <p className={`mt-2 font-mono text-xs font-semibold tabular-nums ${theme.text}`}>
                    Min {formatReward(cat.minCpc, sym)} / task
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Live Micro-Jobs Marketplace Board */}
      <section id="jobs" className="border-y border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Live Micro-Jobs Board
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Pick any task, follow the instructions carefully, and upload proof to earn.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[230px] flex-1 sm:flex-initial">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'featured' | 'highest' | 'slots')}
                aria-label="Sort jobs"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="featured">Featured First</option>
                <option value="highest">Highest Reward</option>
                <option value="slots">Most Slots Open</option>
              </select>
            </div>
          </div>

          {/* Interactive Category Filter Bar */}
          <div className="mb-6 flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === 'all'
                  ? `bg-white ${brand.text} shadow-xs`
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Tasks
            </button>
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat.id
                    ? `bg-white ${brand.text} shadow-xs`
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {filteredJobs.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
              <p className="text-base font-semibold text-slate-800">No active micro-jobs match your filter.</p>
              <p className="mt-1 text-sm text-slate-500">Try clearing the search query or switching categories.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('all');
                }}
                className={`mt-4 rounded-xl px-4 py-2 text-xs font-semibold text-white ${brand.bg} ${brand.hoverBg}`}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredJobs.map((job) => {
                const theme = getColorTheme(job.categoryColor);
                const pct = Math.min(100, Math.round((job.workersCompleted / Math.max(1, job.workersNeeded)) * 100));
                return (
                  <div
                    key={job.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-indigo-300 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                        <div className="flex items-center gap-2 truncate">
                          <span className={`font-semibold ${theme.text}`}>{job.categoryName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{job.targetRegion}</span>
                          {job.featured && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-amber-600">Featured</span>
                            </>
                          )}
                        </div>
                        <span className="font-mono text-base font-bold text-emerald-600 tabular-nums shrink-0">
                          {formatReward(job.rewardPerWorker, sym)}
                        </span>
                      </div>

                      <h3 className="mt-2 font-display text-base font-bold leading-snug text-slate-900">
                        {job.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Posted by {job.employerName} · Est. {job.estimatedMinutes} min
                      </p>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                          <span>Progress</span>
                          <span className="font-mono font-semibold tabular-nums">
                            {job.workersCompleted} / {job.workersNeeded}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectJob(job)}
                        className={`rounded-xl px-4 py-2 text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0 ${theme.bg} hover:opacity-95`}
                      >
                        Do Task
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* How It Works + Feature Visuals */}
      {s.showHowItWorks && (
        <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-16">
          <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                How {s.siteName} Works
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                One unified account lets you earn as a worker and launch campaigns as an employer.
              </p>
            </div>
            <div className="inline-flex rounded-xl bg-slate-200/70 p-1 self-start">
              <button
                type="button"
                onClick={() => setHowMode('worker')}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                  howMode === 'worker' ? `bg-white ${brand.text} shadow-xs` : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                For Workers
              </button>
              <button
                type="button"
                onClick={() => setHowMode('employer')}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                  howMode === 'employer' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                For Employers
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-5">
              {(howMode === 'worker'
                ? [
                    {
                      num: '01.',
                      title: 'Pick a Micro-Task',
                      desc: 'Filter tasks by category or payout rate. Read the exact instructions before starting.',
                      color: 'bg-indigo-600',
                    },
                    {
                      num: '02.',
                      title: 'Submit Text & Screenshot Proof',
                      desc: 'Complete the steps on your phone or laptop and attach verification proof.',
                      color: 'bg-emerald-600',
                    },
                    {
                      num: '03.',
                      title: 'Cash Out or Reinvest',
                      desc: 'Withdraw your Earning Balance via bKash, Nagad, Binance USDT, or PayPal.',
                      color: 'bg-amber-600',
                    },
                  ]
                : [
                    {
                      num: '01.',
                      title: 'Fund Your Deposit Wallet',
                      desc: 'Add funds securely via local mobile wallets, crypto USDT, or PayPal.',
                      color: 'bg-orange-600',
                    },
                    {
                      num: '02.',
                      title: 'Launch a Targeted Campaign',
                      desc: 'Set step-by-step instructions, worker count, and reward per completion.',
                      color: 'bg-indigo-600',
                    },
                    {
                      num: '03.',
                      title: 'Review Real Human Proofs',
                      desc: 'Approve accurate submissions to release funds or reject invalid proofs to free slots.',
                      color: 'bg-emerald-600',
                    },
                  ]
              ).map((item) => (
                <div key={item.num} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold text-white ${item.color}`}
                  >
                    {item.num}
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
              <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="aspect-[4/3] w-full overflow-hidden bg-indigo-50">
                  <img
                    src="/src/assets/images/category_social_media_1795645722524.jpg"
                    alt="Social media engagement micro-jobs showcase"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-5">
                  <h3 className="font-display text-base font-bold text-slate-900">Organic Social & Video Campaigns</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Real community members watch videos, follow pages, and write authentic comments with proof
                    verification.
                  </p>
                </div>
              </div>

              <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="aspect-[4/3] w-full overflow-hidden bg-emerald-50">
                  <img
                    src="/src/assets/images/category_app_testing_1795645723434.jpg"
                    alt="Mobile app testing and UX feedback tasks"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-5">
                  <h3 className="font-display text-base font-bold text-slate-900">App Testing & User Research</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Gather real device screenshots, onboarding feedback, and survey responses from verified users.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Blog & Guides Section */}
      {s.showBlogSection && visiblePosts.length > 0 && (
        <section id="blog" className="border-t border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Guides & Platform Updates
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Tips for maximizing daily task payouts and running high-conversion micro-campaigns.
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {visiblePosts.map((post) => (
                <article
                  key={post.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40 transition-all hover:border-indigo-300 hover:bg-white hover:shadow-md"
                >
                  <div className="aspect-[16/10] w-full overflow-hidden bg-slate-200">
                    <img
                      src={post.coverImageUrl || '/src/assets/images/category_social_media_1795645722524.jpg'}
                      alt={post.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        <span className={`font-semibold ${brand.text}`}>{post.category}</span>
                        <span className="mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                        {post.featured && (
                          <>
                            <span className="mx-1.5" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-semibold text-amber-600">Featured</span>
                          </>
                        )}
                      </p>
                      <h3 className="mt-2 font-display text-lg font-bold leading-snug text-slate-900">{post.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 line-clamp-3">{post.excerpt}</p>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-slate-200/70 pt-3.5 text-xs">
                      <span className="font-medium text-slate-500">By {post.authorName}</span>
                      <button
                        type="button"
                        onClick={() => setActivePost(post)}
                        className={`inline-flex items-center gap-1 font-bold ${brand.text}`}
                      >
                        Read Guide
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Supported Payment Gateways & Founder Trust */}
      <section
        id="payments"
        className="border-t border-slate-200 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 py-14 text-white"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Flexible Local & Global Payment Gateways
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-indigo-100/90">
                Deposit campaign funds or cash out your daily earnings through trusted mobile banking and digital
                wallets configured directly from the Admin Panel.
              </p>
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                {data.gateways.map((gw) => (
                  <div
                    key={gw.id}
                    className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{gw.name}</p>
                      <p className="text-xs text-indigo-200">
                        Min {formatMoney(gw.minAmount, sym)} · Fee {gw.feePercent}%
                      </p>
                    </div>
                    <Wallet className="h-4 w-4 text-emerald-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-6 lg:col-span-5">
              <div className="flex items-center gap-4">
                <img
                  src="/src/assets/images/avatar_admin_founder_1795645723444.jpg"
                  alt={s.founderName || 'Platform Operations Lead'}
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-indigo-300/40"
                />
                <div>
                  <p className="font-display text-base font-bold text-white">{s.founderName || 'Tariq Ahmed'}</p>
                  <p className="text-xs text-indigo-200">{s.founderRole || 'Marketplace Operations · Dhaka & Global'}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-indigo-100">
                “
                {s.founderQuote ||
                  'Every campaign budget is held safely until employers review worker screenshots, and our support ticket team resolves any proof dispute within 24 hours.'}
                ”
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => (currentUser ? onGoDashboard() : onOpenAuth('register'))}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400"
                >
                  Create Free Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-slate-500 sm:flex-row">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-display font-bold text-slate-900">{s.siteName}</span>
            <span>{s.footerText || `© ${new Date().getFullYear()} All rights reserved.`}</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            {footerPages.map((pg) => (
              <button
                key={pg.id}
                type="button"
                onClick={() => setActivePage(pg)}
                className="hover:text-slate-900 transition-colors"
              >
                {pg.title}
              </button>
            ))}
            <button type="button" onClick={() => onOpenAuth('admin')} className={`font-semibold ${brand.text}`}>
              Admin Login
            </button>
            <span>Support: {s.supportEmail}</span>
          </div>
        </div>
      </footer>

      {/* Blog Article Reader Modal */}
      {activePost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-200">
              <img
                src={activePost.coverImageUrl || '/src/assets/images/category_social_media_1795645722524.jpg'}
                alt={activePost.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setActivePost(null)}
                className="absolute right-4 top-4 rounded-full bg-slate-950/70 p-2 text-white hover:bg-slate-950"
                aria-label="Close article"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <BookOpen className={`h-4 w-4 ${brand.text}`} />
                <span className={`font-semibold ${brand.text}`}>{activePost.category}</span>
                <span>·</span>
                <span>By {activePost.authorName}</span>
                <span>·</span>
                <span>{new Date(activePost.createdAt).toLocaleDateString()}</span>
              </div>
              <h2 className="mt-3 font-display text-2xl font-extrabold text-slate-900">{activePost.title}</h2>
              <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                {activePost.content}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom CMS Page Reader Modal */}
      {activePage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <FileText className={`h-4 w-4 ${brand.text}`} />
                  <span>/{activePage.slug}</span>
                </div>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-900">{activePage.title}</h2>
                {activePage.summary && <p className="mt-1 text-sm text-slate-500">{activePage.summary}</p>}
              </div>
              <button
                type="button"
                onClick={() => setActivePage(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                aria-label="Close page"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
              {activePage.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

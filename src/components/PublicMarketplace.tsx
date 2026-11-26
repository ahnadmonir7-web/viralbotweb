import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Layers,
  Search,
  Wallet,
} from 'lucide-react';
import type { BootstrapPayload, MicroJob, User } from '../types.ts';
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

  const sym = data.settings.currencySymbol || '$';

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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="font-display text-xl font-extrabold tracking-tight text-indigo-700 whitespace-nowrap shrink-0"
          >
            {data.settings.siteName}
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#jobs" className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0">
              Browse Jobs
            </a>
            <a href="#categories" className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0">
              Categories
            </a>
            <a href="#how-it-works" className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#payments" className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0">
              Payments
            </a>
            <button
              type="button"
              onClick={() => (currentUser ? onGoDashboard('post-job') : onOpenAuth('register'))}
              className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0"
            >
              Post a Job
            </button>
          </nav>

          <div className="shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={() => onGoDashboard()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
              >
                {currentUser.role === 'admin' ? 'Admin Console' : 'My Dashboard'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-orange-50/70">
        <div className="mx-auto grid max-w-7xl items-stretch gap-10 px-6 py-14 lg:grid-cols-12 lg:py-20">
          <div className="flex flex-col justify-center space-y-6 lg:col-span-6">
            <p className="text-sm font-semibold text-indigo-600">
              Human-Verified Micro-Jobs · Instant Task Proofs · Multi-Gateway Payouts
            </p>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl [text-wrap:balance]">
              Complete small digital tasks daily or launch real-human campaigns.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Workers earn steady payouts for social engagement, app testing, and web research. Employers pay only for
              approved proofs—never bots.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={() => (currentUser ? onGoDashboard('find-jobs') : onOpenAuth('register'))}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 whitespace-nowrap shrink-0"
              >
                Start Earning Free
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="#jobs"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700 whitespace-nowrap shrink-0"
              >
                Explore Live Tasks
              </a>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[300px] overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-600 to-violet-700 shadow-xl">
              <img
                src="/src/assets/images/hero_microjob_workspace_1795645722925.jpg"
                alt="Freelancer completing micro-jobs from a bright modern desk"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/95 px-4 py-3 text-xs font-medium text-slate-800 shadow-md backdrop-blur-xs">
                <span>Fast bKash, Nagad, Binance USDT & PayPal payouts</span>
                <span className="font-mono font-bold text-emerald-700 tabular-nums">5% Referral Bonus</span>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width 4-column marketplace stats strip */}
        <div className="border-t border-slate-200/80 bg-white/85">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-slate-200/70 sm:grid-cols-4 sm:divide-y-0">
            <div className="px-6 py-5">
              <p className="text-xs font-medium text-slate-500">Active Campaigns</p>
              <p className="mt-1 font-mono text-2xl font-bold text-indigo-600 tabular-nums">
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
              <p className="text-xs font-medium text-slate-500">Minimum Campaign Cost</p>
              <p className="mt-1 font-mono text-2xl font-bold text-rose-600 tabular-nums">{sym}0.30</p>
            </div>
          </div>
        </div>
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
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
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
                  ? 'bg-white text-indigo-700 shadow-xs'
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
                    ? 'bg-white text-indigo-700 shadow-xs'
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
                className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
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
      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              How {data.settings.siteName} Works
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
                howMode === 'worker' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
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
                  Real community members watch videos, follow pages, and write authentic comments with proof verification.
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

      {/* Supported Payment Gateways & Founder Trust */}
      <section id="payments" className="border-t border-slate-200 bg-gradient-to-b from-slate-900 to-indigo-950 py-14 text-white">
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
                  alt="Tariq Ahmed, Platform Operations Lead"
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-indigo-300/40"
                />
                <div>
                  <p className="font-display text-base font-bold text-white">Tariq Ahmed</p>
                  <p className="text-xs text-indigo-200">Marketplace Operations · Dhaka & Global</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-indigo-100">
                “Every campaign budget is held safely until employers review worker screenshots, and our support ticket
                team resolves any proof dispute within 24 hours.”
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
          <div className="flex items-center gap-4">
            <span className="font-display font-bold text-slate-900">{data.settings.siteName}</span>
            <span>© {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button type="button" onClick={() => onOpenAuth('admin')} className="hover:text-indigo-600">
              Admin Login
            </button>
            <span>Support: {data.settings.supportEmail}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

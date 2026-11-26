import React, { useEffect, useState } from 'react';
import {
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Tag,
  User as UserIcon,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import { apiRequest, setAuthToken } from '../api/client.ts';
import type { SiteSettings, User } from '../types.ts';
import { getColorTheme } from '../utils/colors.ts';

interface AuthModalProps {
  initialTab?: 'login' | 'register' | 'admin';
  initialReferralCode?: string;
  settings?: SiteSettings;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

const COUNTRIES = [
  'Bangladesh',
  'India',
  'Pakistan',
  'United States',
  'United Kingdom',
  'Indonesia',
  'Philippines',
  'Nigeria',
  'Brazil',
  'Canada',
  'Germany',
  'Global',
];

export function AuthModal({
  initialTab = 'login',
  initialReferralCode = '',
  settings,
  onClose,
  onSuccess,
}: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register' | 'admin'>(initialTab);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Bangladesh');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [adminClaimed, setAdminClaimed] = useState(true);
  const [hasEnvPasscode, setHasEnvPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const siteName = settings?.siteName || 'MiniWorkers';
  const brand = getColorTheme(settings?.accentTheme || 'teal');

  useEffect(() => {
    apiRequest<{ claimed: boolean; hasEnvPasscode: boolean }>('/auth/admin-status')
      .then((res) => {
        setAdminClaimed(res.claimed);
        setHasEnvPasscode(res.hasEnvPasscode);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (tab === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter the same password.');
        return;
      }
      if (!agreedTerms) {
        setError('Please accept the Terms & Rules before creating your account.');
        return;
      }
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ identifier, email: identifier, phone: identifier, password }),
        });
        setAuthToken(res.token);
        onSuccess(res.user);
      } else if (tab === 'register') {
        const res = await apiRequest<{ token: string; user: User }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name: fullName,
            username,
            email,
            phone,
            country,
            password,
            referralCode,
          }),
        });
        setAuthToken(res.token);
        onSuccess(res.user);
      } else {
        if (!adminClaimed || hasEnvPasscode) {
          const res = await apiRequest<{ token: string; user: User }>('/auth/claim-admin', {
            method: 'POST',
            body: JSON.stringify({
              name: fullName || 'Platform Admin',
              email: email || 'admin@miniworkers.local',
              password,
            }),
          });
          setAuthToken(res.token);
          onSuccess(res.user);
        } else {
          const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, identifier: email, password }),
          });
          if (res.user.role !== 'admin') {
            throw new Error('This account does not have Administrator permissions.');
          }
          setAuthToken(res.token);
          onSuccess(res.user);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function fillDemoWorker() {
    setTab('login');
    setIdentifier('arif@demo.com');
    setPassword('worker123');
    setError('');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        {/* Unique Ocean Teal & Coral Marketplace Brand Header */}
        <div className="relative bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-600 px-6 py-5 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-1.5 text-white/90 transition-colors hover:bg-white/25 hover:text-white"
            aria-label="Close auth dialog"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3.5">
            {settings?.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={siteName}
                referrerPolicy="no-referrer"
                className="h-11 w-11 rounded-2xl border border-white/30 bg-white object-cover shadow-md"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-md">
                <Zap className="h-5 w-5" />
              </div>
            )}
            <div>
              <h2 className="font-display text-xl font-extrabold tracking-tight text-white">{siteName}</h2>
              <p className="text-xs font-medium text-teal-50/90">
                Micro-Jobs &amp; Freelance Task Marketplace
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Segmented Member Auth Tabs (Login / Register) */}
          {tab !== 'admin' ? (
            <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError('');
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                  tab === 'login' ? `bg-white ${brand.text} shadow-xs` : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Member Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError('');
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                  tab === 'register' ? `bg-white ${brand.text} shadow-xs` : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>
          ) : (
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldCheck className={`h-4 w-4 ${brand.text}`} />
                <span>Administrator Sign In</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError('');
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Member Login
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          {tab === 'admin' && !adminClaimed && !hasEnvPasscode && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <p className="font-bold">First-Time Admin Setup</p>
              <p className="mt-1">
                Enter your Admin name, email, and password below to activate the {siteName} Admin Panel.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {tab === 'login' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Email or Username</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="you@example.com or username"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-teal-600"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={fillDemoWorker}
                    className={`font-semibold ${brand.text} hover:underline`}
                  >
                    Fill Demo Worker
                  </button>
                </div>
              </>
            )}

            {tab === 'register' && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Arif Rahman"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Username</label>
                    <div className="relative">
                      <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="arif_worker"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Country</label>
                    <div className="relative">
                      <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Phone (Optional)</label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+88017..."
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 chars"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-9 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Confirm Password</label>
                    <div className="relative">
                      <CheckCircle2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Referral Code (Optional)</label>
                  <div className="relative">
                    <Tag className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      placeholder="e.g. ARIF2026"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-10 pr-4 text-xs uppercase text-slate-900 placeholder:normal-case focus:border-teal-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-teal-600"
                  />
                  I agree to the {siteName} Terms &amp; Fair-Use Rules
                </label>
              </>
            )}

            {tab === 'admin' && (
              <>
                {!adminClaimed && !hasEnvPasscode && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Admin Display Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Platform Admin"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                )}

                {!hasEnvPasscode && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Admin Email or Username</label>
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@miniworkers.local"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {hasEnvPasscode ? 'Admin Passcode' : 'Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 pr-10 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-md transition-all disabled:opacity-60 ${brand.bg} ${brand.hoverBg}`}
            >
              {tab === 'register' && <UserPlus className="h-4 w-4" />}
              {tab === 'admin' && <ShieldCheck className="h-4 w-4" />}
              <span>
                {loading
                  ? 'Please wait...'
                  : tab === 'register'
                    ? 'Create Free Account'
                    : tab === 'login'
                      ? 'Sign In to Workspace'
                      : !adminClaimed && !hasEnvPasscode
                        ? 'Claim & Open Admin'
                        : 'Admin Sign In'}
              </span>
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
            {tab === 'register' ? (
              <p>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError('');
                  }}
                  className={`font-bold ${brand.text} hover:underline`}
                >
                  Sign In Here
                </button>
              </p>
            ) : (
              <p>
                New to {siteName}?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setError('');
                  }}
                  className={`font-bold ${brand.text} hover:underline`}
                >
                  Register Free
                </button>
              </p>
            )}

            {tab !== 'admin' && (
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setTab('admin');
                    setError('');
                  }}
                  className="text-[11px] font-semibold text-slate-400 hover:text-slate-700"
                >
                  Administrator Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

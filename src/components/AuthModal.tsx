import React, { useEffect, useState } from 'react';
import {
  ChevronRight,
  Crown,
  Eye,
  EyeOff,
  Lock,
  Phone,
  Play,
  ShieldCheck,
  Tag,
  User as UserIcon,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import { apiRequest, setAuthToken } from '../api/client.ts';
import type { User } from '../types.ts';

interface AuthModalProps {
  initialTab?: 'login' | 'register' | 'admin';
  initialReferralCode?: string;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export function AuthModal({ initialTab = 'login', initialReferralCode = '', onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register' | 'admin'>(initialTab);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [adminClaimed, setAdminClaimed] = useState(true);
  const [hasEnvPasscode, setHasEnvPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setLoading(true);
    try {
      if (tab === 'login') {
        const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ phone, identifier: phone, password }),
        });
        setAuthToken(res.token);
        onSuccess(res.user);
      } else if (tab === 'register') {
        const res = await apiRequest<{ token: string; user: User }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            username,
            name: username,
            phone,
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
              name: username || 'Platform Admin',
              email: email || 'admin@viralbolt.local',
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
    setPhone('01711000001');
    setPassword('worker123');
    setError('');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-fuchsia-500/45 bg-gradient-to-b from-[#1a093b] via-[#13062d] to-[#0b031c] text-white shadow-[0_0_50px_rgba(217,70,239,0.28)]">
        {/* Top Viral Bolt Brand Banner */}
        <div className="relative border-b border-fuchsia-500/20 bg-gradient-to-r from-[#240b52] via-[#340d6e] to-[#1d0845] px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 text-purple-100 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close auth dialog"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-600 shadow-lg shadow-fuchsia-600/35">
              <Crown className="absolute -top-2.5 h-4 w-4 text-amber-400" />
              <Play className="h-5 w-5 fill-white text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-display text-2xl font-extrabold italic tracking-tight text-white">Viral</span>
                <span className="font-display text-2xl font-extrabold italic tracking-tight text-amber-400">Bolt</span>
                <Zap className="h-5 w-5 fill-amber-400 text-amber-400" />
              </div>
              <p className="text-[11px] font-medium tracking-wide text-purple-200/85">
                Watch · Enjoy · Unlimited Micro-Earnings
              </p>
            </div>
          </div>
        </div>

        {/* Mode Pill Header */}
        <div className="px-6 pt-5">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 px-5 py-1.5 text-sm font-bold text-white shadow-md shadow-fuchsia-600/30">
            {tab === 'register' && <UserPlus className="h-4 w-4" />}
            {tab === 'admin' && <ShieldCheck className="h-4 w-4" />}
            {tab === 'login' && <Phone className="h-4 w-4" />}
            <span>
              {tab === 'register' ? 'Registration' : tab === 'admin' ? 'Admin Panel' : 'Member Login'}
            </span>
          </div>
        </div>

        <div className="p-6 pt-5">
          {error && (
            <div className="mb-4 rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-2.5 text-xs font-medium text-rose-200">
              {error}
            </div>
          )}

          {tab === 'admin' && !adminClaimed && !hasEnvPasscode && (
            <div className="mb-4 rounded-2xl border border-amber-400/35 bg-amber-400/10 p-3.5 text-xs text-amber-100">
              <p className="font-bold text-amber-300">First-Time Admin Setup</p>
              <p className="mt-1 text-purple-100/90">
                Choose your Admin email and password below to activate the Viral Bolt Admin Panel.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {(tab === 'register' || (tab === 'admin' && !adminClaimed && !hasEnvPasscode)) && (
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-200" />
                <input
                  type="text"
                  required={tab === 'register'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={tab === 'admin' ? 'Admin Name' : 'User Name'}
                  aria-label="User Name"
                  className="w-full rounded-full border border-fuchsia-400/35 bg-[#231048] py-3 pl-11 pr-4 text-sm text-white placeholder:text-purple-200/65 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
                />
              </div>
            )}

            {tab !== 'admin' && (
              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-200" />
                <input
                  type={tab === 'register' ? 'tel' : 'text'}
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={tab === 'register' ? 'Phone Number' : 'Phone Number or Email'}
                  aria-label="Phone Number"
                  className="w-full rounded-full border border-fuchsia-400/35 bg-[#231048] py-3 pl-11 pr-4 text-sm text-white placeholder:text-purple-200/65 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
                />
              </div>
            )}

            {tab === 'admin' && !hasEnvPasscode && (
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-200" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Admin Email or Username"
                  aria-label="Admin Email"
                  className="w-full rounded-full border border-fuchsia-400/35 bg-[#231048] py-3 pl-11 pr-4 text-sm text-white placeholder:text-purple-200/65 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
                />
              </div>
            )}

            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-200" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === 'admin' && hasEnvPasscode ? 'Admin Passcode' : 'Password'}
                aria-label="Password"
                className="w-full rounded-full border border-fuchsia-400/35 bg-[#231048] py-3 pl-11 pr-11 text-sm text-white placeholder:text-purple-200/65 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-purple-200/80 transition-colors hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>

            {tab === 'register' && (
              <div className="relative">
                <Tag className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-200/80" />
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="Referral Code (Optional)"
                  aria-label="Referral Code"
                  className="w-full rounded-full border border-fuchsia-400/25 bg-[#1d0c3d] py-2.5 pl-11 pr-4 text-xs uppercase text-white placeholder:normal-case placeholder:text-purple-200/55 focus:border-fuchsia-400 focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-600 to-indigo-600 py-3 text-sm font-extrabold text-white shadow-lg shadow-fuchsia-600/35 transition-all hover:brightness-110 disabled:opacity-60"
            >
              {tab === 'register' && <UserPlus className="h-4 w-4" />}
              {tab === 'admin' && <ShieldCheck className="h-4 w-4" />}
              <span>
                {loading
                  ? 'Please wait...'
                  : tab === 'register'
                    ? 'Register'
                    : tab === 'login'
                      ? 'Login'
                      : !adminClaimed && !hasEnvPasscode
                        ? 'Claim & Open Admin'
                        : 'Admin Sign In'}
              </span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </form>

          {tab === 'login' && (
            <div className="mt-3">
              <button
                type="button"
                onClick={fillDemoWorker}
                className="w-full rounded-full border border-fuchsia-400/30 bg-white/5 px-4 py-2 text-xs font-semibold text-purple-100 transition-colors hover:bg-white/10"
              >
                Use Demo Account (01711000001 / worker123)
              </button>
            </div>
          )}

          {/* OR Divider & Login/Register Switch */}
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-purple-400/25" />
            <span className="text-[11px] font-bold tracking-widest text-purple-200/80">OR</span>
            <div className="h-px flex-1 bg-purple-400/25" />
          </div>

          <div className="text-center text-xs text-purple-200/85">
            {tab === 'register' ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError('');
                  }}
                  className="font-bold text-amber-400 underline-offset-2 hover:underline"
                >
                  Login
                </button>
              </p>
            ) : (
              <p>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setError('');
                  }}
                  className="font-bold text-amber-400 underline-offset-2 hover:underline"
                >
                  Register
                </button>
              </p>
            )}

            <div className="mt-3 pt-2 border-t border-purple-500/20">
              {tab !== 'admin' ? (
                <button
                  type="button"
                  onClick={() => {
                    setTab('admin');
                    setError('');
                  }}
                  className="text-[11px] font-semibold text-purple-300/75 hover:text-white"
                >
                  Admin Panel Login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError('');
                  }}
                  className="text-[11px] font-semibold text-purple-300/75 hover:text-white"
                >
                  Back to Member Login
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest, setAuthToken } from './api/client.ts';
import { AdminPanel } from './components/AdminPanel.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { PublicMarketplace } from './components/PublicMarketplace.tsx';
import { TaskModal } from './components/TaskModal.tsx';
import { UserDashboard, type DashboardTab } from './components/UserDashboard.tsx';
import type { BootstrapPayload, MicroJob, User } from './types.ts';

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [loadError, setLoadError] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'public' | 'dashboard' | 'admin'>('public');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [authModal, setAuthModal] = useState<{ open: boolean; tab: 'login' | 'register' | 'admin' }>({
    open: false,
    tab: 'login',
  });
  const [selectedJob, setSelectedJob] = useState<MicroJob | null>(null);
  const [refCodeFromUrl, setRefCodeFromUrl] = useState('');

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await apiRequest<BootstrapPayload>('/bootstrap');
      setBootstrap(data);
      setLoadError('');
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setRefCodeFromUrl(ref.toUpperCase());
      setAuthModal({ open: true, tab: 'register' });
    }
    refreshBootstrap();
  }, [refreshBootstrap]);

  function handleAuthSuccess(user: User) {
    setCurrentUser(user);
    setAuthModal({ open: false, tab: 'login' });
    if (user.role === 'admin') {
      setView('admin');
    } else {
      setView('dashboard');
    }
  }

  function handleLogout() {
    setAuthToken(null);
    setCurrentUser(null);
    setView('public');
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <h1 className="font-display text-lg font-bold text-slate-900">Unable to Load Marketplace</h1>
          <p className="mt-2 text-sm text-rose-600">{loadError}</p>
          <button
            type="button"
            onClick={refreshBootstrap}
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm font-medium text-slate-600">Loading Viral Bolt Marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {view === 'admin' && currentUser?.role === 'admin' ? (
        <AdminPanel
          admin={currentUser}
          bootstrap={bootstrap}
          onRefreshBootstrap={refreshBootstrap}
          onBackPublic={() => setView('public')}
          onLogout={handleLogout}
        />
      ) : view === 'dashboard' && currentUser ? (
        <UserDashboard
          user={currentUser}
          bootstrap={bootstrap}
          initialTab={dashboardTab}
          onUserUpdate={setCurrentUser}
          onRefreshBootstrap={refreshBootstrap}
          onSelectJob={(job) => setSelectedJob(job)}
          onBackPublic={() => setView('public')}
          onLogout={handleLogout}
        />
      ) : (
        <PublicMarketplace
          data={bootstrap}
          currentUser={currentUser}
          onOpenAuth={(tab = 'login') => setAuthModal({ open: true, tab })}
          onGoDashboard={(tab) => {
            if (currentUser?.role === 'admin') {
              setView('admin');
            } else {
              if (tab) setDashboardTab(tab as DashboardTab);
              setView('dashboard');
            }
          }}
          onSelectJob={(job) => setSelectedJob(job)}
        />
      )}

      {authModal.open && (
        <AuthModal
          initialTab={authModal.tab}
          initialReferralCode={refCodeFromUrl}
          onClose={() => setAuthModal({ open: false, tab: 'login' })}
          onSuccess={handleAuthSuccess}
        />
      )}

      {selectedJob && (
        <TaskModal
          job={selectedJob}
          currencySymbol={bootstrap.settings.currencySymbol}
          currentUser={currentUser}
          onClose={() => setSelectedJob(null)}
          onRequireAuth={() => {
            setSelectedJob(null);
            setAuthModal({ open: true, tab: 'login' });
          }}
          onSubmitted={refreshBootstrap}
        />
      )}
    </>
  );
}

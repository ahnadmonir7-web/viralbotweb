import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, Upload, X } from 'lucide-react';
import { apiRequest, fileToBase64 } from '../api/client.ts';
import type { MicroJob, User } from '../types.ts';
import { formatReward, getColorTheme } from '../utils/colors.ts';

interface TaskModalProps {
  job: MicroJob;
  currencySymbol: string;
  currentUser: User | null;
  onClose: () => void;
  onRequireAuth: () => void;
  onSubmitted: () => void;
}

export function TaskModal({
  job,
  currencySymbol,
  currentUser,
  onClose,
  onRequireAuth,
  onSubmitted,
}: TaskModalProps) {
  const [proofText, setProofText] = useState('');
  const [screenshotData, setScreenshotData] = useState('');
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const theme = getColorTheme(job.categoryColor);
  const progressPct = Math.min(100, Math.round((job.workersCompleted / Math.max(1, job.workersNeeded)) * 100));

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await fileToBase64(file);
      setScreenshotData(b64);
      setFileName(file.name);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await apiRequest(`/jobs/${job.id}/proofs`, {
        method: 'POST',
        body: JSON.stringify({ proofText, screenshotData }),
      });
      setSuccess(true);
      onSubmitted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const safeTargetUrl =
    job.targetUrl && (job.targetUrl.startsWith('http://') || job.targetUrl.startsWith('https://'))
      ? job.targetUrl
      : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className={theme.text}>{job.categoryName}</span>
              <span aria-hidden="true">·</span>
              <span>{job.targetRegion}</span>
              <span aria-hidden="true">·</span>
              <span>~{job.estimatedMinutes} min</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{job.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close task details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Task Reward</p>
              <p className="font-mono text-2xl font-bold text-emerald-600 tabular-nums">
                {formatReward(job.rewardPerWorker, currencySymbol)}
              </p>
            </div>
            <div className="min-w-[180px] flex-1 max-w-xs">
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
                <span>Slots Filled</span>
                <span className="font-mono font-semibold tabular-nums">
                  {job.workersCompleted} / {job.workersNeeded}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            {safeTargetUrl && (
              <a
                href={safeTargetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
              >
                Open Task Link
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Step-by-Step Instructions</h3>
            <ol className="space-y-2">
              {job.steps.map((step, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-sm text-slate-700"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${theme.bg}`}
                  >
                    {index + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <h3 className="text-sm font-bold text-amber-900">Required Proof</h3>
            <p className="mt-1 text-sm text-amber-800">{job.proofRequirement}</p>
          </div>

          {success ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <h3 className="mt-3 text-lg font-bold text-emerald-950">Proof Submitted Successfully</h3>
              <p className="mt-1 text-sm text-emerald-800">
                The employer will review your submission shortly and release{' '}
                <span className="font-mono font-semibold">{formatReward(job.rewardPerWorker, currencySymbol)}</span> to
                your Earning Balance.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-100 pt-5">
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Text Proof / Username / Verification Code
                </label>
                <textarea
                  rows={3}
                  required
                  value={proofText}
                  onChange={(e) => setProofText(e.target.value)}
                  placeholder="Paste required usernames, links, or completion codes here..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Screenshot Proof {job.requireScreenshot ? '(Required)' : '(Optional)'}
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 transition-colors hover:border-indigo-400 hover:bg-indigo-50/40">
                  <span className="flex items-center gap-2 truncate">
                    <Upload className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span className="truncate">{fileName || 'Select PNG, JPG, or WEBP screenshot (max 1.8MB)'}</span>
                  </span>
                  <span className="ml-3 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs">
                    Browse
                  </span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />
                </label>
                {screenshotData && (
                  <img
                    src={screenshotData}
                    alt="Proof preview"
                    className="mt-2 h-28 rounded-lg border border-slate-200 object-cover"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                >
                  {currentUser ? (submitting ? 'Submitting...' : 'Submit Task Proof') : 'Sign In to Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Plus,
  ShieldAlert,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiRequest, fileToBase64 } from '../../api/client.ts';
import type { AccentTheme, ActivityLog, BlogPost, CmsPage, SiteSettings } from '../../types.ts';

interface WebsiteSettingsTabProps {
  mode: 'branding' | 'homepage' | 'settings';
  settings: SiteSettings;
  setSettings: React.Dispatch<React.SetStateAction<SiteSettings>>;
  logs: ActivityLog[];
  onSaveSettings: (e: React.FormEvent) => Promise<void>;
  onFeedback: (type: 'ok' | 'err', text: string) => void;
}

const ACCENT_THEMES: Array<{ id: AccentTheme; label: string; swatch: string }> = [
  { id: 'teal', label: 'Ocean Teal', swatch: 'bg-teal-600' },
  { id: 'indigo', label: 'Indigo', swatch: 'bg-indigo-600' },
  { id: 'violet', label: 'Violet', swatch: 'bg-violet-600' },
  { id: 'emerald', label: 'Emerald', swatch: 'bg-emerald-600' },
  { id: 'rose', label: 'Rose', swatch: 'bg-rose-600' },
  { id: 'amber', label: 'Amber', swatch: 'bg-amber-600' },
  { id: 'sky', label: 'Sky', swatch: 'bg-sky-600' },
];

export function WebsiteSettingsTab({
  mode,
  settings,
  setSettings,
  logs,
  onSaveSettings,
  onFeedback,
}: WebsiteSettingsTabProps) {
  const [uploadingField, setUploadingField] = useState<'logo' | 'hero' | null>(null);

  async function handleImageUpload(field: 'logo' | 'hero', file?: File) {
    if (!file) return;
    setUploadingField(field);
    try {
      const imageData = await fileToBase64(file);
      const res = await apiRequest<{ url: string }>('/admin/upload', {
        method: 'POST',
        body: JSON.stringify({ imageData }),
      });
      if (field === 'logo') {
        setSettings((prev) => ({ ...prev, logoUrl: res.url }));
      } else {
        setSettings((prev) => ({ ...prev, heroImageUrl: res.url }));
      }
      onFeedback('ok', 'Image uploaded. Click Save Changes below to publish.');
    } catch (err) {
      onFeedback('err', (err as Error).message);
    } finally {
      setUploadingField(null);
    }
  }

  if (mode === 'branding') {
    return (
      <form onSubmit={onSaveSettings} className="max-w-3xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="font-display text-base font-bold text-slate-900">Website Identity & Logo Control</h2>
          <p className="mt-1 text-xs text-slate-500">
            Update your platform name, upload a custom brand logo, choose the primary color theme, and customize footer
            or notice text across all pages.
          </p>
        </div>

        {/* Logo Upload & Preview */}
        <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Site Logo" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6 text-slate-400" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs font-bold text-slate-800">Website Logo (PNG / JPG / WEBP)</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700">
                <Upload className="h-3.5 w-3.5" />
                {uploadingField === 'logo' ? 'Uploading...' : 'Upload Logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleImageUpload('logo', e.target.files?.[0])}
                />
              </label>
              {settings.logoUrl && (
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, logoUrl: '' }))}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Use Default Icon
                </button>
              )}
            </div>
            <input
              type="text"
              value={settings.logoUrl}
              onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
              placeholder="Or paste logo image URL (/uploads/... or https://...)"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Website Name</label>
            <input
              type="text"
              required
              value={settings.siteName}
              onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
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
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Hero Card Tagline</label>
            <input
              type="text"
              value={settings.tagline}
              onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
            />
          </div>
        </div>

        {/* Accent Theme Selector */}
        <div>
          <label className="mb-2 block text-xs font-semibold text-slate-700">Website Accent Theme Color</label>
          <div className="flex flex-wrap gap-2.5">
            {ACCENT_THEMES.map((t) => {
              const selected = settings.accentTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, accentTheme: t.id })}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                    selected
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className={`h-3.5 w-3.5 rounded-full ${t.swatch}`} />
                  <span>{t.label}</span>
                  {selected && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Member Dashboard Notice Banner</label>
          <textarea
            rows={2}
            value={settings.noticeBanner}
            onChange={(e) => setSettings({ ...settings, noticeBanner: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Footer Copyright / Tagline</label>
          <input
            type="text"
            value={settings.footerText}
            onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
        >
          Save Website & Logo Changes
        </button>
      </form>
    );
  }

  if (mode === 'homepage') {
    return (
      <form onSubmit={onSaveSettings} className="max-w-3xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="font-display text-base font-bold text-slate-900">Home Page Builder & Layout Control</h2>
          <p className="mt-1 text-xs text-slate-500">
            Customize the homepage hero headline, banner image, call-to-action buttons, founder quote, and section
            visibility.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Hero Top Kicker</label>
            <input
              type="text"
              value={settings.heroKicker}
              onChange={(e) => setSettings({ ...settings, heroKicker: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Hero Main Headline</label>
            <input
              type="text"
              value={settings.heroTitle}
              onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Hero Subtitle</label>
            <textarea
              rows={2}
              value={settings.heroSubtitle}
              onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Primary CTA Label</label>
              <input
                type="text"
                value={settings.heroPrimaryCta}
                onChange={(e) => setSettings({ ...settings, heroPrimaryCta: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Secondary CTA Label</label>
              <input
                type="text"
                value={settings.heroSecondaryCta}
                onChange={(e) => setSettings({ ...settings, heroSecondaryCta: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          {/* Hero Banner Image Upload */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <img
              src={settings.heroImageUrl || '/src/assets/images/hero_microjob_workspace_1795645722925.jpg'}
              alt="Hero Banner Preview"
              className="h-20 w-32 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingField === 'hero' ? 'Uploading...' : 'Upload Hero Banner'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handleImageUpload('hero', e.target.files?.[0])}
                  />
                </label>
              </div>
              <input
                type="text"
                value={settings.heroImageUrl}
                onChange={(e) => setSettings({ ...settings, heroImageUrl: e.target.value })}
                placeholder="Hero Banner Image URL"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Founder / Operations Block */}
        <div className="space-y-3 border-t border-slate-100 pt-5">
          <h3 className="font-display text-sm font-bold text-slate-900">Trust & Operations Card Copy</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Operations Lead Name</label>
              <input
                type="text"
                value={settings.founderName}
                onChange={(e) => setSettings({ ...settings, founderName: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Role / Location</label>
              <input
                type="text"
                value={settings.founderRole}
                onChange={(e) => setSettings({ ...settings, founderRole: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Trust Guarantee Quote</label>
            <textarea
              rows={2}
              value={settings.founderQuote}
              onChange={(e) => setSettings({ ...settings, founderQuote: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
            />
          </div>
        </div>

        {/* Home Sections Visibility */}
        <div className="space-y-2.5 border-t border-slate-100 pt-5">
          <h3 className="font-display text-sm font-bold text-slate-900">Homepage Sections Visibility</h3>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.showStatsStrip}
              onChange={(e) => setSettings({ ...settings, showStatsStrip: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Show 4-column Marketplace Stats Strip under Hero
          </label>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.showHowItWorks}
              onChange={(e) => setSettings({ ...settings, showHowItWorks: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Show &ldquo;How It Works&rdquo; Workers vs Employers section
          </label>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.showBlogSection}
              onChange={(e) => setSettings({ ...settings, showBlogSection: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Show Blog & Guides Showcase on Home Page
          </label>
        </div>

        <button
          type="submit"
          className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
        >
          Save Home Page Layout
        </button>
      </form>
    );
  }

  // mode === 'settings' (System Controls + Audit Log)
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <form
        onSubmit={onSaveSettings}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7 self-start"
      >
        <div className="border-b border-slate-100 pb-3">
          <h2 className="font-display text-base font-bold text-slate-900">Financial Rules & System Access Control</h2>
          <p className="mt-1 text-xs text-slate-500">
            Configure commission rates, minimum limits, signup permissions, and maintenance mode.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
            <label className="mb-1 block text-xs font-semibold text-slate-700">Min Workers Per Campaign</label>
            <input
              type="number"
              value={settings.minJobWorkers}
              onChange={(e) => setSettings({ ...settings, minJobWorkers: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Global Min Withdraw Amount</label>
            <input
              type="number"
              step="0.5"
              value={settings.minWithdrawAmount}
              onChange={(e) => setSettings({ ...settings, minWithdrawAmount: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.autoApproveJobs}
              onChange={(e) => setSettings({ ...settings, autoApproveJobs: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Auto-approve employer campaigns immediately (skip admin review)
          </label>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.allowRegistration}
              onChange={(e) => setSettings({ ...settings, allowRegistration: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Allow public user registrations (uncheck to pause new signups)
          </label>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
          <label className="flex items-center gap-2.5 text-sm font-bold text-amber-950">
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
              className="h-4 w-4 rounded border-amber-400 text-amber-600"
            />
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Enable Maintenance Mode (pauses new jobs & task submissions)
          </label>
          <input
            type="text"
            value={settings.maintenanceMessage}
            onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
            placeholder="Notice shown across website while maintenance mode is active..."
            className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs"
          />
        </div>

        <button
          type="submit"
          className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
        >
          Save System Controls
        </button>
      </form>

      {/* Admin Activity Audit Log */}
      <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-5">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <ShieldAlert className="h-4 w-4 text-indigo-600" />
          <h3 className="font-display text-sm font-bold text-slate-900">Admin Activity Audit Log</h3>
        </div>
        <div className="max-h-[540px] divide-y divide-slate-100 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">No admin actions recorded yet.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-indigo-700">{log.action}</span>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-700">{log.details}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">By {log.adminName}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface BlogManagerTabProps {
  posts: BlogPost[];
  onChanged: () => Promise<void>;
  onFeedback: (type: 'ok' | 'err', text: string) => void;
}

export function BlogManagerTab({ posts, onChanged, onFeedback }: BlogManagerTabProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Earning Guides');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('/src/assets/images/category_social_media_1795645722524.jpg');
  const [featured, setFeatured] = useState(false);
  const [published, setPublished] = useState(true);
  const [uploading, setUploading] = useState(false);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setCategory('Earning Guides');
    setExcerpt('');
    setContent('');
    setCoverImageUrl('/src/assets/images/category_social_media_1795645722524.jpg');
    setFeatured(false);
    setPublished(true);
  }

  function startEdit(p: BlogPost) {
    setEditingId(p.id);
    setTitle(p.title);
    setCategory(p.category);
    setExcerpt(p.excerpt);
    setContent(p.content);
    setCoverImageUrl(p.coverImageUrl);
    setFeatured(p.featured);
    setPublished(p.published);
  }

  async function handleUploadCover(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const imageData = await fileToBase64(file);
      const res = await apiRequest<{ url: string }>('/admin/upload', {
        method: 'POST',
        body: JSON.stringify({ imageData }),
      });
      setCoverImageUrl(res.url);
    } catch (err) {
      onFeedback('err', (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = { title, category, excerpt, content, coverImageUrl, featured, published };
      if (editingId) {
        await apiRequest(`/admin/blog/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        onFeedback('ok', 'Blog post updated.');
      } else {
        await apiRequest('/admin/blog', { method: 'POST', body: JSON.stringify(payload) });
        onFeedback('ok', 'Blog post published.');
      }
      resetForm();
      await onChanged();
    } catch (err) {
      onFeedback('err', (err as Error).message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <form onSubmit={handleSubmit} className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-5 self-start">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900">
            {editingId ? `Edit Article #${editingId}` : 'Publish Blog Article'}
          </h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
              Cancel Edit
            </button>
          )}
        </div>

        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article Headline"
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (e.g. Earning Guides)"
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
        />

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <img src={coverImageUrl} alt="Cover" className="h-12 w-16 rounded-lg object-cover bg-white shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white">
              <Upload className="h-3 w-3" />
              {uploading ? 'Uploading...' : 'Upload Cover'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleUploadCover(e.target.files?.[0])}
              />
            </label>
            <input
              type="text"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="Cover Image URL"
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
            />
          </div>
        </div>

        <textarea
          rows={2}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="Short excerpt shown on homepage card..."
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
        />
        <textarea
          rows={5}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Full article content..."
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
        />

        <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Published on Website
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            Featured Guide
          </label>
        </div>

        <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
          {editingId ? 'Update Article' : 'Publish Article'}
        </button>
      </form>

      <div className="space-y-3 lg:col-span-7">
        {posts.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <img src={p.coverImageUrl} alt={p.title} className="h-16 w-24 rounded-xl object-cover shrink-0 bg-slate-100" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-indigo-700">{p.category}</span>
                  <span> · </span>
                  <span>{p.published ? 'Published' : 'Draft'}</span>
                  {p.featured && (
                    <>
                      <span> · </span>
                      <span className="font-semibold text-amber-600">Featured</span>
                    </>
                  )}
                </p>
                <p className="truncate font-display text-sm font-bold text-slate-900">{p.title}</p>
                <p className="truncate text-xs text-slate-500">{p.excerpt}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await apiRequest(`/admin/blog/${p.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ published: !p.published }),
                  });
                  await onChanged();
                }}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                title={p.published ? 'Unpublish' : 'Publish'}
              >
                {p.published ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await apiRequest(`/admin/blog/${p.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ featured: !p.featured }),
                  });
                  await onChanged();
                }}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                title="Toggle Featured"
              >
                <Star className={`h-4 w-4 ${p.featured ? 'text-amber-500 fill-amber-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => startEdit(p)}
                className="rounded-lg border border-slate-200 p-2 text-indigo-600 hover:bg-indigo-50"
                title="Edit Article"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  await apiRequest(`/admin/blog/${p.id}`, { method: 'DELETE' });
                  await onChanged();
                  onFeedback('ok', 'Article deleted.');
                }}
                className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:bg-rose-50"
                title="Delete Article"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            <BookOpen className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            No blog articles created yet.
          </div>
        )}
      </div>
    </div>
  );
}

interface PagesCmsTabProps {
  pages: CmsPage[];
  onChanged: () => Promise<void>;
  onFeedback: (type: 'ok' | 'err', text: string) => void;
}

export function PagesCmsTab({ pages, onChanged, onFeedback }: PagesCmsTabProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [showInHeader, setShowInHeader] = useState(false);
  const [showInFooter, setShowInFooter] = useState(true);
  const [published, setPublished] = useState(true);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setSummary('');
    setContent('');
    setShowInHeader(false);
    setShowInFooter(true);
    setPublished(true);
  }

  function startEdit(p: CmsPage) {
    setEditingId(p.id);
    setTitle(p.title);
    setSlug(p.slug);
    setSummary(p.summary);
    setContent(p.content);
    setShowInHeader(p.showInHeader);
    setShowInFooter(p.showInFooter);
    setPublished(p.published);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = { title, slug, summary, content, showInHeader, showInFooter, published };
      if (editingId) {
        await apiRequest(`/admin/pages/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        onFeedback('ok', 'Page updated.');
      } else {
        await apiRequest('/admin/pages', { method: 'POST', body: JSON.stringify(payload) });
        onFeedback('ok', 'Page created.');
      }
      resetForm();
      await onChanged();
    } catch (err) {
      onFeedback('err', (err as Error).message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <form onSubmit={handleSubmit} className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-5 self-start">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900">
            {editingId ? `Edit Page /${slug}` : 'Create Custom Page'}
          </h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
              Cancel
            </button>
          )}
        </div>

        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Page Title (e.g. FAQ or Privacy Policy)"
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
        />
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="URL Slug (e.g. faq)"
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs"
        />
        <input
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Short page summary"
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
        />
        <textarea
          rows={6}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Full page text content..."
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
        />

        <div className="space-y-2 text-xs font-semibold text-slate-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Published (visible to visitors)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showInHeader} onChange={(e) => setShowInHeader(e.target.checked)} />
            Show link in Top Navigation Bar
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showInFooter} onChange={(e) => setShowInFooter(e.target.checked)} />
            Show link in Website Footer
          </label>
        </div>

        <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
          {editingId ? 'Save Page Changes' : 'Create Page'}
        </button>
      </form>

      <div className="space-y-3 lg:col-span-7">
        {pages.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <FileText className="h-3.5 w-3.5 text-indigo-600" />
                <span className="font-mono">/{p.slug}</span>
                <span>·</span>
                <span>{p.published ? 'Published' : 'Hidden'}</span>
                {p.showInHeader && <span>· Header Nav</span>}
                {p.showInFooter && <span>· Footer</span>}
              </div>
              <p className="mt-1 font-display text-sm font-bold text-slate-900">{p.title}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{p.summary || p.content.slice(0, 100)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => startEdit(p)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={async () => {
                  await apiRequest(`/admin/pages/${p.id}`, { method: 'DELETE' });
                  await onChanged();
                  onFeedback('ok', 'Page deleted.');
                }}
                className="rounded-lg border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-50"
                title="Delete Page"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {pages.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            <Plus className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            No custom pages created yet.
          </div>
        )}
      </div>
    </div>
  );
}

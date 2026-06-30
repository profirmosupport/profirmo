'use client';

// Admin platform settings. Each row is a small inline-editable field. The
// settings registry on the backend tags each row with a type / group /
// secret flag — we render accordingly.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Save,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
  Cloud,
  Mail,
  Loader2,
  Share2,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import {
  listSettings,
  updateSetting,
  testStorageConnection,
  testEmailConnection,
} from '@/services/adminSettingsService';
import { listBufferProfiles } from '@/services/bufferAdminService';
import { invalidateStorageConfig } from '@/services/fileService';
import { ROLES } from '@/utils/constants';

// For secret rows the listing returns a masked placeholder. We keep the
// draft separate from the placeholder so the admin must explicitly type a
// new value to save (no chance of round-tripping the mask back to the DB).
const isMaskedSecret = (str) =>
  typeof str === 'string' && /^•••.*characters set •••$/.test(str);

export default function AdminSettingsPage() {
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [revealed, setRevealed] = useState({});
  // Per-group collapsed state. Defaults to undefined for each group;
  // `groupCollapsed()` below treats undefined as COLLAPSED so the page
  // starts compact. Admins expand only the groups they're editing.
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const groupCollapsed = (g) =>
    collapsedGroups[g] === undefined ? true : !!collapsedGroups[g];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [savedKey, setSavedKey] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listSettings();
      setItems(rows);
      // For secret rows, draft starts empty (the placeholder is masked).
      // For non-secret rows, draft starts with the current value.
      setDrafts(
        Object.fromEntries(
          rows.map((r) => [r.key, r.secret ? '' : String(r.value ?? '')])
        )
      );
      setSavedKey('');
    } catch (err) {
      setError(err.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(key) {
    if (savingKey) return;
    setSavingKey(key);
    setSavedKey('');
    try {
      await updateSetting(key, drafts[key]);
      setSavedKey(key);
      // Storage keys affect the URL resolver in fileService — drop its
      // cached driver/baseUrl so the next image render fetches fresh.
      if (
        key.startsWith('aws_') ||
        key === 'storage_driver' ||
        key === 'aws_use_path_style_endpoint'
      ) {
        invalidateStorageConfig();
      }
      await load();
    } catch (err) {
      setError(err.message || `Failed to save ${key}.`);
    } finally {
      setSavingKey('');
    }
  }

  // Storage / S3 connection test. Lives at group level rather than per-row
  // because it spans the whole credential set.
  const [storageTesting, setStorageTesting] = useState(false);
  const [storageTestMsg, setStorageTestMsg] = useState(null); // { ok, message }
  async function runStorageTest() {
    if (storageTesting) return;
    setStorageTesting(true);
    setStorageTestMsg(null);
    try {
      const result = await testStorageConnection();
      setStorageTestMsg({
        ok: true,
        message: `S3 reachable — bucket ${result?.bucket} (${result?.region}). Test object created and deleted.`,
      });
    } catch (err) {
      setStorageTestMsg({
        ok: false,
        message: err?.message || 'Connection test failed.',
      });
    } finally {
      setStorageTesting(false);
    }
  }

  // Buffer.com OAuth + profile listing. Connect kicks off the
  // authorization-code flow: fetches the authorize URL via XHR (so the
  // bearer token rides along) then redirects the same tab to Buffer.
  // After Buffer redirects back to /api/buffer/oauth-callback, the
  // backend stores the access_token and 302s here with
  // ?buffer=connected or ?buffer=error&detail=…
  const [bufferStatusMsg, setBufferStatusMsg] = useState(null); // { ok, message }
  const [bufferConnecting, setBufferConnecting] = useState(false);
  const [bufferListing, setBufferListing] = useState(false);
  const [bufferProfiles, setBufferProfiles] = useState(null);
  // Parse the callback's status flag from the URL on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('buffer');
    if (!flag) return;
    if (flag === 'connected') {
      setBufferStatusMsg({
        ok: true,
        message:
          'Buffer connected. Access token saved — every new AI blog post will be auto-shared to your linked profiles.',
      });
    } else if (flag === 'error') {
      setBufferStatusMsg({
        ok: false,
        message:
          'Buffer connect failed: ' +
          (params.get('detail') || 'unknown error'),
      });
    }
    // Strip the params so a reload doesn't re-show the banner.
    const url = new URL(window.location.href);
    url.searchParams.delete('buffer');
    url.searchParams.delete('detail');
    window.history.replaceState({}, '', url.toString());
  }, []);

  function runBufferConnect() {
    // Send the browser straight at the PUBLIC connect endpoint —
    // that path does the redirect to Buffer's authorize page on the
    // server side. We deliberately avoid an XHR here so the browser's
    // address bar carries through every redirect and the eventual
    // callback lands on us with cookies intact (no auth-header
    // gymnastics with cross-site 302s).
    if (typeof window === 'undefined') return;
    setBufferConnecting(true);
    setBufferStatusMsg(null);
    const apiBase =
      window.location.hostname === 'profirmo.com' ||
      window.location.hostname === 'www.profirmo.com'
        ? 'https://proapi.profirmo.com'
        : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    window.location.href = `${apiBase}/api/buffer/connect`;
  }

  async function runBufferListProfiles() {
    if (bufferListing) return;
    setBufferListing(true);
    setBufferProfiles(null);
    setBufferStatusMsg(null);
    try {
      const res = await listBufferProfiles();
      const list = (res && res.profiles) || [];
      setBufferProfiles(list);
      setBufferStatusMsg({
        ok: true,
        message:
          list.length === 0
            ? 'Connected, but no profiles are linked in your Buffer dashboard yet.'
            : `Connected. ${list.length} profile(s) will receive the share.`,
      });
    } catch (err) {
      setBufferStatusMsg({
        ok: false,
        message:
          err?.message ||
          'Failed to list Buffer profiles. Click "Connect Buffer" to refresh the token.',
      });
    } finally {
      setBufferListing(false);
    }
  }

  // SMTP connection test — sends a one-off "Profirmo SMTP test" through
  // the live admin-configured transport. Recipient defaults to the
  // admin's own email (resolved server-side); admin can override via
  // the inline input.
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestMsg, setEmailTestMsg] = useState(null); // { ok, message }
  const [emailTestTo, setEmailTestTo] = useState('');
  async function runEmailTest() {
    if (emailTesting) return;
    setEmailTesting(true);
    setEmailTestMsg(null);
    try {
      const result = await testEmailConnection(emailTestTo.trim() || undefined);
      setEmailTestMsg({
        ok: true,
        message:
          `Sent to ${result?.to}. messageId=${result?.messageId || '(n/a)'}` +
          (result?.response ? ` · server: ${result.response}` : ''),
      });
    } catch (err) {
      setEmailTestMsg({
        ok: false,
        message: err?.message || 'SMTP test failed.',
      });
    } finally {
      setEmailTesting(false);
    }
  }

  // Group items by their `group` tag so related rows render together.
  const groups = useMemo(() => {
    const byGroup = new Map();
    for (const item of items) {
      const g = item.group || 'General';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(item);
    }
    return [...byGroup.entries()];
  }, [items]);

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Platform settings"
      subtitle="Knobs admins can change without a redeploy"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Settings size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {items.length} setting{items.length === 1 ? '' : 's'} across{' '}
              {groups.length} group{groups.length === 1 ? '' : 's'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={15} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : (
          groups.map(([groupName, rows]) => {
            const collapsed = groupCollapsed(groupName);
            const isStorageGroup = groupName === 'Storage / AWS S3';
            const isSmtpGroup = groupName === 'SMTP (outgoing mail)';
            const isAiGroup = groupName === 'AI / Anthropic';
            return (
              <section key={groupName} className="space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedGroups((c) => ({
                      ...c,
                      [groupName]: !c[groupName],
                    }))
                  }
                  aria-expanded={!collapsed}
                  className="group flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-amber-300 hover:bg-amber-50/50"
                >
                  <span className="flex items-center gap-2">
                    {isStorageGroup && <Cloud size={14} className="text-amber-600" />}
                    {isSmtpGroup && <Mail size={14} className="text-amber-600" />}
                    {isAiGroup && <Share2 size={14} className="text-amber-600" />}
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-700">
                      {groupName}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {rows.length}
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-200 group-hover:text-amber-600 ${
                      collapsed ? '-rotate-90' : 'rotate-0'
                    }`}
                  />
                </button>
                {!collapsed && isStorageGroup && (
                  <Card>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">
                          Test S3 connection
                        </p>
                        <p>
                          Uploads a tiny file to <code>temp/</code> using the
                          credentials above and deletes it again. Catches
                          typos in the key, region or bucket name before they
                          break a real upload.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={runStorageTest}
                        disabled={storageTesting}
                      >
                        {storageTesting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Testing…
                          </>
                        ) : (
                          <>
                            <Cloud size={14} />
                            Test S3 connection
                          </>
                        )}
                      </Button>
                    </div>
                    {storageTestMsg && (
                      <div
                        className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                          storageTestMsg.ok
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {storageTestMsg.ok ? (
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        )}
                        <span>{storageTestMsg.message}</span>
                      </div>
                    )}
                  </Card>
                )}
                {!collapsed && isSmtpGroup && (
                  <Card>
                    <div className="flex flex-col gap-3">
                      <div className="text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">
                          Send a test email
                        </p>
                        <p>
                          Uses the SMTP credentials above (including any
                          unsaved drafts already written to the rows) to
                          send a quick "Profirmo SMTP test" message. Leave
                          the recipient blank to send to your own admin
                          inbox.
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          type="email"
                          value={emailTestTo}
                          onChange={(e) => setEmailTestTo(e.target.value)}
                          placeholder="recipient@example.com (defaults to your admin email)"
                          className="flex-1"
                          disabled={emailTesting}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={runEmailTest}
                          disabled={emailTesting}
                        >
                          {emailTesting ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Sending…
                            </>
                          ) : (
                            <>
                              <Mail size={14} />
                              Send test email
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {emailTestMsg && (
                      <div
                        className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                          emailTestMsg.ok
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {emailTestMsg.ok ? (
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        )}
                        <span>{emailTestMsg.message}</span>
                      </div>
                    )}
                  </Card>
                )}
                {!collapsed && isAiGroup && (
                  <Card>
                    <div className="flex flex-col gap-3">
                      <div className="text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">
                          Connect to Buffer
                        </p>
                        <p>
                          Save your Buffer OAuth Client ID + Client Secret
                          below, then click <strong>Connect Buffer</strong>.
                          You&apos;ll be sent to Buffer to approve access, then
                          redirected back here with the access token saved
                          automatically. After that, every AI-generated post
                          (cron + the &ldquo;Generate with AI&rdquo; button)
                          auto-shares to every social profile linked in your
                          Buffer dashboard.
                        </p>
                        <p className="mt-2">
                          The redirect URI to register in your Buffer app is:
                          <code className="ml-1 rounded bg-slate-100 px-1">
                            https://proapi.profirmo.com/api/buffer/oauth-callback
                          </code>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={runBufferConnect}
                          disabled={bufferConnecting}
                        >
                          {bufferConnecting ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Redirecting…
                            </>
                          ) : (
                            <>
                              <Share2 size={14} />
                              Connect Buffer
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={runBufferListProfiles}
                          disabled={bufferListing}
                        >
                          {bufferListing ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Loading…
                            </>
                          ) : (
                            <>List linked profiles</>
                          )}
                        </Button>
                      </div>
                    </div>
                    {bufferStatusMsg && (
                      <div
                        className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                          bufferStatusMsg.ok
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {bufferStatusMsg.ok ? (
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        )}
                        <span>{bufferStatusMsg.message}</span>
                      </div>
                    )}
                    {bufferProfiles && bufferProfiles.length > 0 && (
                      <ul className="mt-3 space-y-1 text-xs">
                        {bufferProfiles.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center gap-2 rounded bg-slate-50 px-2 py-1"
                          >
                            <span className="font-mono text-[10px] text-slate-500">
                              {p.service}
                            </span>
                            <span className="font-medium text-slate-700">
                              {p.formattedUsername || p.serviceUsername || p.id}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                )}
                {!collapsed &&
                  rows.map((s) => (
                    <SettingRow
                      key={s.key}
                      setting={s}
                      draft={drafts[s.key] ?? ''}
                      onDraftChange={(v) =>
                        setDrafts((d) => ({ ...d, [s.key]: v }))
                      }
                      onSave={() => save(s.key)}
                      saving={savingKey === s.key}
                      saved={savedKey === s.key}
                      revealed={!!revealed[s.key]}
                      onToggleReveal={() =>
                        setRevealed((r) => ({ ...r, [s.key]: !r[s.key] }))
                      }
                    />
                  ))}
              </section>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}

// --- Row -------------------------------------------------------------------

function SettingRow({
  setting,
  draft,
  onDraftChange,
  onSave,
  saving,
  saved,
  revealed,
  onToggleReveal,
}) {
  const s = setting;
  const isLong = s.type === 'longtext';
  const isString = s.type === 'string' || s.type === 'longtext';
  const isNumber = s.type === 'number';

  // For secret rows, "no draft typed" should disable Save. For non-secret
  // rows, Save is enabled whenever the draft differs from the live value.
  const liveString = s.value === undefined || s.value === null ? '' : String(s.value);
  const canSave = (() => {
    if (s.secret) return draft.length > 0;
    return draft !== liveString;
  })();

  // Show the current value as a small read-only chip below the heading.
  const displayValue = (() => {
    if (s.secret && !revealed) return isMaskedSecret(liveString) ? liveString : '••• hidden •••';
    if (s.secret && revealed) return liveString || '(not set)';
    if (s.key === 'bookingMarkupBps') {
      const n = Number(liveString) || 0;
      return `${liveString} (${(n / 100).toFixed(2)}%)`;
    }
    return liveString || '(not set)';
  })();

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {s.label || s.key}
              </p>
              {s.secret && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                  <Lock size={10} />
                  Secret
                </span>
              )}
              {s.isPublic && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                  Public
                </span>
              )}
            </div>
            <p className="font-mono text-[11px] uppercase tracking-wide text-slate-400">
              {s.key}
            </p>
            {s.description && (
              <p className="mt-2 max-w-prose text-xs text-slate-600">
                {s.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span>
                Current:{' '}
                <span className="font-mono text-slate-700">{displayValue}</span>
              </span>
              {s.secret && (
                <button
                  type="button"
                  onClick={onToggleReveal}
                  className="inline-flex items-center gap-0.5 text-slate-400 transition hover:text-slate-700"
                  title={revealed ? 'Hide' : 'Show stored placeholder'}
                >
                  {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {isLong ? (
            <div className="w-full flex-1">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                New value
              </label>
              <textarea
                rows={6}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={
                  s.secret
                    ? 'Paste the full -----BEGIN PRIVATE KEY----- block to overwrite. Leave empty to keep the current value.'
                    : ''
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
          ) : Array.isArray(s.options) && s.options.length > 0 ? (
            // Enum-style settings (Razorpay mode, storage driver, etc.)
            // render as a dropdown so a typo can't slip into the DB.
            <div className="w-full flex-1 sm:max-w-md">
              <Select
                label="New value"
                name={s.key}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                options={s.options}
              />
            </div>
          ) : (
            <div className="w-full flex-1 sm:max-w-md">
              <Input
                label="New value"
                name={s.key}
                type={isNumber ? 'number' : 'text'}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={
                  s.secret
                    ? 'Type a new value to overwrite. Leave empty to keep the current value.'
                    : ''
                }
              />
            </div>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={onSave}
            disabled={saving || !canSave}
          >
            {saving ? (
              'Saving…'
            ) : saved ? (
              <>
                <CheckCircle2 size={14} />
                Saved
              </>
            ) : (
              <>
                <Save size={14} />
                Save
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

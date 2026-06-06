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
  Loader2,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import {
  listSettings,
  updateSetting,
  testStorageConnection,
} from '@/services/adminSettingsService';
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

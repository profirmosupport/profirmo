'use client';

// Admin email-template manager. Lists every trigger point in the system,
// lets the operator edit subject + HTML + plain-text body, preview the
// rendered output with sample data, and send a one-off test email
// through the live SMTP transport.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mail,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Save,
  RotateCcw,
  Send,
  Eye,
  ChevronRight,
  Loader2,
  PowerOff,
  Power,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import {
  listEmailTemplates,
  getEmailTemplate,
  saveEmailTemplate,
  resetEmailTemplate,
  previewEmailTemplate,
  testEmailTemplate,
} from '@/services/emailTemplateService';
import { ROLES } from '@/utils/constants';

export default function AdminEmailTemplatesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeKey, setActiveKey] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listEmailTemplates();
      setItems(rows);
      if (!activeKey && rows.length > 0) setActiveKey(rows[0].key);
    } catch (err) {
      setError(err?.message || 'Could not load email templates.');
    } finally {
      setLoading(false);
    }
  }, [activeKey]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Email templates"
      subtitle="Edit the subject + body for every transactional email"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Mail size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {items.length} trigger{items.length === 1 ? '' : 's'} — pick a row
              to edit
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

        {loading && items.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem,1fr]">
            <TemplatesList
              items={items}
              activeKey={activeKey}
              onSelect={setActiveKey}
            />
            {activeKey ? (
              <TemplateEditor
                key={activeKey}
                templateKey={activeKey}
                onSaved={load}
              />
            ) : (
              <Card>
                <p className="text-sm text-slate-500">
                  Pick a template on the left to start editing.
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function TemplatesList({ items, activeKey, onSelect }) {
  return (
    <Card padding="sm">
      <ul className="divide-y divide-slate-100">
        {items.map((it) => {
          const isActive = it.key === activeKey;
          return (
            <li key={it.key}>
              <button
                type="button"
                onClick={() => onSelect(it.key)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left transition ${
                  isActive
                    ? 'bg-amber-50 text-amber-900'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {it.label || it.key}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {it.trigger || it.triggerPoint || it.key}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {it.hasCustom ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        Custom
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Default
                      </span>
                    )}
                    {!it.enabled && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight
                  size={14}
                  className={isActive ? 'text-amber-600' : 'text-slate-300'}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TemplateEditor({ templateKey, onSaved }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const [draftSubject, setDraftSubject] = useState('');
  const [draftHtml, setDraftHtml] = useState('');
  const [draftText, setDraftText] = useState('');
  const [draftEnabled, setDraftEnabled] = useState(true);

  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewVars, setPreviewVars] = useState({});
  const [previewing, setPreviewing] = useState(false);

  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSavedMsg('');
    setTestMsg(null);
    setPreviewHtml('');
    try {
      const detail = await getEmailTemplate(templateKey);
      setItem(detail);
      setDraftSubject(detail.subject || '');
      setDraftHtml(detail.htmlBody || '');
      setDraftText(detail.textBody || '');
      setDraftEnabled(detail.enabled !== false);
      // Seed the preview-vars editor with sensible placeholders so the
      // first "Preview" click renders something useful — names like
      // "Alex Doe" beat empty strings for spotting layout issues.
      const seed = {};
      for (const v of detail.variables || []) seed[v] = samplePlaceholder(v);
      setPreviewVars(seed);
    } catch (err) {
      setError(err?.message || 'Could not load template.');
    } finally {
      setLoading(false);
    }
  }, [templateKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      await saveEmailTemplate(templateKey, {
        subject: draftSubject,
        htmlBody: draftHtml,
        textBody: draftText,
        enabled: draftEnabled,
      });
      setSavedMsg('Saved.');
      await load();
      onSaved && onSaved();
    } catch (err) {
      setError(err?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (resetting) return;
    if (
      !window.confirm(
        'Reset this template to the hardcoded default? Your custom subject + body will be removed.'
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      await resetEmailTemplate(templateKey);
      await load();
      onSaved && onSaved();
    } catch (err) {
      setError(err?.message || 'Reset failed.');
    } finally {
      setResetting(false);
    }
  }

  async function handlePreview() {
    if (previewing) return;
    setPreviewing(true);
    setError('');
    try {
      // Send the editor's CURRENT subject + body to the server so the
      // preview matches the unsaved draft, not the persisted row.
      // Server-side, /preview reads the saved row — to honour the draft
      // we save-then-preview, but that surprises admins. Instead we
      // render locally with simple {{var}} substitution.
      setPreviewSubject(interpolate(draftSubject, previewVars));
      setPreviewHtml(interpolate(draftHtml, previewVars));
    } catch (err) {
      setError(err?.message || 'Preview failed.');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleTest() {
    if (testing) return;
    setTesting(true);
    setTestMsg(null);
    try {
      // For "test send", route through the server with current vars.
      // The server reads the persisted row, so it reflects whatever
      // was last saved. We save first to mirror what the recipient
      // would actually see.
      if (!savedMsg) {
        // Save silently before testing so the SAVED body is what's sent.
        await saveEmailTemplate(templateKey, {
          subject: draftSubject,
          htmlBody: draftHtml,
          textBody: draftText,
          enabled: draftEnabled,
        });
      }
      const result = await testEmailTemplate(templateKey, {
        to: testTo.trim() || undefined,
        vars: previewVars,
      });
      setTestMsg({
        ok: true,
        message:
          `Sent to ${result?.to}. messageId=${result?.messageId || '(n/a)'}` +
          (result?.response ? ` · server: ${result.response}` : ''),
      });
    } catch (err) {
      setTestMsg({ ok: false, message: err?.message || 'Test send failed.' });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="animate-spin" size={14} />
          Loading template…
        </div>
      </Card>
    );
  }
  if (!item) {
    return <Card>Template not found.</Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">
              {item.label}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Trigger:</span>{' '}
              {item.trigger || '—'}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Audience:</span>{' '}
              {item.audience || '—'}
            </p>
            {item.updatedAt ? (
              <p className="mt-0.5 text-[11px] text-slate-400">
                Last edited {new Date(item.updatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDraftEnabled((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                draftEnabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {draftEnabled ? <Power size={12} /> : <PowerOff size={12} />}
              {draftEnabled ? 'Enabled' : 'Disabled'}
            </button>
            {item.hasCustom && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={resetting}
              >
                {resetting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RotateCcw size={13} />
                )}
                Reset to default
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {savedMsg && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <span>{savedMsg}</span>
          </div>
        )}
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Available variables
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(item.variables || []).length === 0 ? (
            <span className="text-xs text-slate-400">— none —</span>
          ) : (
            (item.variables || []).map((v) => (
              <code
                key={v}
                className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
              >
                {'{{' + v + '}}'}
              </code>
            ))
          )}
        </div>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Subject
        </p>
        <Input
          value={draftSubject}
          onChange={(e) => setDraftSubject(e.target.value)}
          placeholder="Subject line (supports {{vars}})"
        />
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          HTML body
        </p>
        <textarea
          value={draftHtml}
          onChange={(e) => setDraftHtml(e.target.value)}
          rows={18}
          spellCheck={false}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] leading-relaxed text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200"
        />
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Plain-text body <span className="text-slate-400">(optional)</span>
        </p>
        <textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          rows={6}
          spellCheck={false}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] leading-relaxed text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200"
        />
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Preview &amp; test
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Substitutes the variable values below into the draft, then
              either previews the result inline or sends a real email
              through the configured SMTP transport.
            </p>
          </div>
        </div>
        {(item.variables || []).length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(item.variables || []).map((v) => (
              <div key={v}>
                <label className="text-[11px] font-semibold text-slate-600">
                  {v}
                </label>
                <Input
                  value={previewVars[v] != null ? previewVars[v] : ''}
                  onChange={(e) =>
                    setPreviewVars((cur) => ({ ...cur, [v]: e.target.value }))
                  }
                  placeholder={samplePlaceholder(v)}
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={previewing}
          >
            {previewing ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
            Preview
          </Button>
          <Input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="recipient@example.com (defaults to your admin email)"
            className="flex-1 min-w-[14rem]"
          />
          <Button size="sm" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {testing ? 'Sending…' : 'Send test'}
          </Button>
        </div>
        {testMsg && (
          <div
            className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              testMsg.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {testMsg.ok ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            )}
            <span>{testMsg.message}</span>
          </div>
        )}

        {previewHtml ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Rendered preview
            </p>
            <p className="mt-1 text-xs text-slate-700">
              <span className="font-semibold">Subject:</span> {previewSubject}
            </p>
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              sandbox=""
              className="mt-2 h-[28rem] w-full rounded-lg border border-slate-200 bg-white"
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}

// Lightweight client-side substitution mirroring the server's renderer
// — only used for the in-page Preview button. The server still does
// the real rendering on Send/Test.
function interpolate(template, vars) {
  if (!template) return '';
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name) =>
    vars && vars[name] != null ? String(vars[name]) : ''
  );
}

// Cheap pretty defaults for the preview-vars editor so the rendered
// email "looks like an email" on first open.
function samplePlaceholder(name) {
  const map = {
    name: 'Alex Doe',
    clientName: 'Priya Sharma',
    professionalName: 'Adv. Honey Taneja',
    ownerName: 'Owner Name',
    firmName: 'Profirmo Associates',
    inviterName: 'Adv. R. Mehra',
    invitedName: 'Adv. K. Singh',
    verifyUrl: 'https://profirmo.com/verify?token=demo',
    inviteUrl: 'https://profirmo.com/invite?token=demo',
    resumeUrl: 'https://profirmo.com/signup/resume?token=demo',
    editUrl: 'https://profirmo.com/dashboard/firm/edit',
    dashboardUrl: 'https://profirmo.com/dashboard/professional',
    reviewUrl: 'https://profirmo.com/admin/professionals',
    supportEmail: 'support@profirmo.com',
    professionalType: 'Advocate',
    reason: 'Example reason',
    message: 'Example message body.',
    otp: '482961',
    expiryHours: '48',
    expiryMinutes: '15',
    expiryDays: '7',
    amount: '1,000',
    currency: 'INR',
    dateTime: 'Mon 30 Jun, 11:00 AM',
    duration: '30 min',
    razorpayPaymentId: 'pay_demo_123',
    bookingId: 'booking-demo-456',
    email: 'demo@example.com',
    ownerEmail: 'owner@example.com',
  };
  return map[name] || `[${name}]`;
}

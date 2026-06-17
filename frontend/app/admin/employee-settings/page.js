'use client';

// /admin/employee-settings — commission per approved professional,
// minimum payout, maximum payout. Backed by three AdminSetting rows.

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import { ROLES } from '@/utils/constants';
import {
  getSettings,
  saveSettings,
} from '@/services/adminEmployeeService';

export default function AdminEmployeeSettingsPage() {
  const [form, setForm] = useState({
    commission: '',
    minPayout: '',
    maxPayout: '',
    topPerformerMultiplier: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await getSettings();
      setForm({
        commission: String(s?.commission ?? ''),
        minPayout: String(s?.minPayout ?? ''),
        maxPayout: String(s?.maxPayout ?? ''),
        topPerformerMultiplier: String(s?.topPerformerMultiplier ?? ''),
      });
    } catch (err) {
      setError(err.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const s = await saveSettings({
        commission: Number(form.commission),
        minPayout: Number(form.minPayout),
        maxPayout: Number(form.maxPayout),
        topPerformerMultiplier: Number(form.topPerformerMultiplier),
      });
      setNotice('Settings saved.');
      setForm({
        commission: String(s?.commission ?? ''),
        minPayout: String(s?.minPayout ?? ''),
        maxPayout: String(s?.maxPayout ?? ''),
        topPerformerMultiplier: String(s?.topPerformerMultiplier ?? ''),
      });
    } catch (err) {
      setError(err.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Employee module settings"
      subtitle="Commission per approved professional and payout limits."
    >
      <div className="max-w-2xl space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
          </div>
        ) : (
          <Card>
            <h2 className="text-base font-semibold text-slate-900">
              Commission &amp; payout
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Amounts in INR (whole rupees). Commission applies only when
              an admin marks a professional APPROVED. The minimum and
              maximum payout amounts are surfaced on the employee dashboard
              and enforced on every payout request.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label="Commission per approved pro (₹)"
                value={form.commission}
                onChange={(v) =>
                  setForm((p) => ({ ...p, commission: v.replace(/[^0-9.]/g, '') }))
                }
              />
              <Field
                label="Top performer multiplier (×)"
                value={form.topPerformerMultiplier}
                onChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    topPerformerMultiplier: v.replace(/[^0-9.]/g, ''),
                  }))
                }
                hint="Applied to commission for the Employee-of-the-Month cards."
              />
              <Field
                label="Minimum payout (₹)"
                value={form.minPayout}
                onChange={(v) =>
                  setForm((p) => ({ ...p, minPayout: v.replace(/[^0-9.]/g, '') }))
                }
              />
              <Field
                label="Maximum payout (₹)"
                value={form.maxPayout}
                onChange={(v) =>
                  setForm((p) => ({ ...p, maxPayout: v.replace(/[^0-9.]/g, '') }))
                }
              />
            </div>

            {error ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 size={14} />
                {notice}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 disabled:bg-slate-300"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Save settings
              </button>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value, onChange, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
      />
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </label>
  );
}

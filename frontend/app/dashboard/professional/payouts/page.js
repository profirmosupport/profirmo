'use client';

// Professional payouts page — request a withdrawal + see the history of
// previous requests. The form picks bank or UPI; backend validates the
// chosen method's fields.

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Send,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import EmptyState from '@/components/common/EmptyState';
import {
  getAvailableForPayout,
  listMyPayouts,
  createPayoutRequest,
  formatINR,
} from '@/services/paymentService';
import { formatDate } from '@/utils/formatters';
import { ROLES } from '@/utils/constants';

const STATUS_VARIANT = {
  pending: 'amber',
  approved: 'blue',
  rejected: 'red',
  paid: 'green',
};

const EMPTY = {
  amountRupees: '',
  method: 'bank',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  upiId: '',
  notes: '',
};

export default function ProfessionalPayoutsPage() {
  const [available, setAvailable] = useState(0);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [avail, rows] = await Promise.all([
        getAvailableForPayout(),
        listMyPayouts(),
      ]);
      setAvailable(Number(avail && avail.availableForPayout) || 0);
      setRequests(rows || []);
    } catch (err) {
      setError(err.message || 'Failed to load payouts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    setSuccess('');

    const rupees = Number(form.amountRupees);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setFormError('Enter a valid amount.');
      return;
    }
    const paise = Math.round(rupees * 100);
    if (paise > available) {
      setFormError('Amount exceeds your available balance.');
      return;
    }
    if (form.method === 'bank') {
      if (
        !form.bankAccountName.trim() ||
        !form.bankAccountNumber.trim() ||
        !form.bankIfsc.trim()
      ) {
        setFormError('Bank account name, number and IFSC are required.');
        return;
      }
    } else if (!form.upiId.trim()) {
      setFormError('UPI id is required.');
      return;
    }

    setSubmitting(true);
    try {
      await createPayoutRequest({
        amount: paise,
        method: form.method,
        bankAccountName:
          form.method === 'bank' ? form.bankAccountName.trim() : undefined,
        bankAccountNumber:
          form.method === 'bank' ? form.bankAccountNumber.trim() : undefined,
        bankIfsc: form.method === 'bank' ? form.bankIfsc.trim() : undefined,
        upiId: form.method === 'upi' ? form.upiId.trim() : undefined,
        notes: form.notes.trim() || undefined,
      });
      setSuccess(`Payout request for ₹${rupees.toFixed(2)} submitted.`);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setFormError(err.message || 'Could not submit your request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout
      role={ROLES.PROFESSIONAL}
      title="Payouts"
      subtitle="Request a withdrawal — admin approval typically takes 1–2 business days"
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1">{success}</span>
            <button
              type="button"
              onClick={() => setSuccess('')}
              className="text-xs font-medium hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
          <Card>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <ArrowDownToLine size={18} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Available for payout
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {formatINR(available)}
                </p>
                {/* Confirms that the running balance already reflects the
                    2× instant pricing wherever it applied — same number
                    that lands in the bank. */}
                <p className="mt-1 text-[11px] text-slate-500">
                  Totals include the 2× instant-booking surcharge where
                  applicable. Net of platform fee. See{' '}
                  <a
                    href="/dashboard/professional/payments"
                    className="font-semibold text-amber-700 hover:underline"
                  >
                    Payment history
                  </a>{' '}
                  for the per-booking breakdown.
                </p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <Input
                label="Amount (₹)"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                value={form.amountRupees}
                onChange={(e) => update('amountRupees', e.target.value)}
                required
              />
              <Select
                label="Method"
                name="method"
                value={form.method}
                onChange={(e) => update('method', e.target.value)}
                options={[
                  { value: 'bank', label: 'Bank transfer (NEFT/IMPS)' },
                  { value: 'upi', label: 'UPI' },
                ]}
              />
              {form.method === 'bank' ? (
                <>
                  <Input
                    label="Account holder"
                    name="bankAccountName"
                    value={form.bankAccountName}
                    onChange={(e) => update('bankAccountName', e.target.value)}
                  />
                  <Input
                    label="Account number"
                    name="bankAccountNumber"
                    value={form.bankAccountNumber}
                    onChange={(e) =>
                      update('bankAccountNumber', e.target.value)
                    }
                  />
                  <Input
                    label="IFSC"
                    name="bankIfsc"
                    value={form.bankIfsc}
                    onChange={(e) => update('bankIfsc', e.target.value)}
                  />
                </>
              ) : (
                <Input
                  label="UPI id"
                  name="upiId"
                  placeholder="name@bank"
                  value={form.upiId}
                  onChange={(e) => update('upiId', e.target.value)}
                />
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Notes <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
              {formError && (
                <p className="text-xs text-red-600">{formError}</p>
              )}
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={submitting || available <= 0}
              >
                <Send size={15} />
                {submitting ? 'Submitting…' : 'Request payout'}
              </Button>
            </form>
          </Card>

          <Card padding={false}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Payout history
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={load}
                disabled={loading}
              >
                <RefreshCw size={15} />
                Refresh
              </Button>
            </div>
            {loading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-14 w-full animate-pulse rounded-lg bg-slate-100"
                  />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<ArrowDownToLine size={24} />}
                  title="No payouts yet"
                  description="When you request a payout it will appear here with status updates."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <div key={r.id} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatINR(r.amount)}
                      </p>
                      <Badge variant={STATUS_VARIANT[r.status] || 'gray'}>
                        {r.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Requested {formatDate(r.createdAt)} ·{' '}
                      {r.method === 'bank' ? 'Bank transfer' : 'UPI'}
                    </div>
                    {r.transferRef && (
                      <p className="mt-1 text-xs text-slate-600">
                        Transfer ref:{' '}
                        <span className="font-mono">{r.transferRef}</span>
                      </p>
                    )}
                    {r.decisionReason && r.status === 'rejected' && (
                      <p className="mt-1 text-xs text-red-600">
                        {r.decisionReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

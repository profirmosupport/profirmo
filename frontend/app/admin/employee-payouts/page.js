'use client';

// /admin/employee-payouts — queue of employee payout requests.
// Filter by status. Click "Decide" on a row to open a side panel
// where admin sets status (approved / rejected / paid / on-hold),
// remarks and (for paid) the external payment reference.

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  X,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import { ROLES } from '@/utils/constants';
import {
  listAllPayouts,
  decidePayout,
} from '@/services/adminEmployeeService';

function rupees(n) {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN')}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

const STATUS_VARIANT = {
  pending: 'amber',
  approved: 'blue',
  paid: 'green',
  rejected: 'red',
  'on-hold': 'amber',
  cancelled: 'gray',
};

export default function AdminEmployeePayoutsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('pending');
  const [active, setActive] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listAllPayouts({ status });
      setRows(data);
    } catch (err) {
      setError(err.message || 'Failed to load payouts.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Employee payouts"
      subtitle="Approve, reject, hold or mark paid."
    >
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
              <option value="on-hold">On hold</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-amber-300 hover:text-amber-700"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </Card>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading payouts…
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <p className="py-6 text-center text-sm text-slate-500">
              No payout requests match the current filter.
            </p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Requested</th>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Available at request</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {r.employee?.name || '—'}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {r.employee?.employeeCode || ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {rupees(r.requestedAmount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {rupees(r.availableAtRequest)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[r.status] || 'gray'}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {r.paymentReference || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {['pending', 'approved', 'on-hold'].includes(r.status) ? (
                        <button
                          type="button"
                          onClick={() => setActive(r)}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                        >
                          Decide
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DecideDrawer
        row={active}
        onClose={() => setActive(null)}
        onDecided={() => {
          setActive(null);
          load();
        }}
      />
    </DashboardLayout>
  );
}

function DecideDrawer({ row, onClose, onDecided }) {
  const [decision, setDecision] = useState('approved');
  const [remarks, setRemarks] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (row) {
      setDecision('approved');
      setRemarks(row.adminRemarks || '');
      setReference(row.paymentReference || '');
      setError('');
    }
  }, [row]);

  if (!row) return null;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await decidePayout(row.id, {
        decision,
        adminRemarks: remarks,
        paymentReference: decision === 'paid' ? reference : undefined,
      });
      onDecided?.();
    } catch (err) {
      setError(err.message || 'Could not update the payout.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/50" onClick={onClose} />
      <aside className="flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">Decide payout</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">
              Requested {fmtDate(row.createdAt)}
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {rupees(row.requestedAmount)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {row.employee?.name} · {row.employee?.employeeCode}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Available at request {rupees(row.availableAtRequest)}
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Decision
            </span>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              <option value="approved">Approve (mark approved, not yet paid)</option>
              <option value="paid">Mark as paid</option>
              <option value="rejected">Reject</option>
              <option value="on-hold">Put on hold</option>
            </select>
          </label>

          {decision === 'paid' ? (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                Payment reference *
              </span>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. UTR / cheque number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Remarks
            </span>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              {error}
            </div>
          ) : null}
        </div>
        <div className="border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-amber-700 disabled:bg-slate-300"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            Apply decision
          </button>
        </div>
      </aside>
    </div>
  );
}

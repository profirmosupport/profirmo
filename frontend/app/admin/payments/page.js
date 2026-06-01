'use client';

// Admin payments dashboard — every Razorpay payment with escrow status.

import { useCallback, useEffect, useState } from 'react';
import {
  CreditCard,
  RefreshCw,
  AlertTriangle,
  Search,
  RotateCcw,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import {
  adminListPayments,
  adminRefundPayment,
  formatINR,
} from '@/services/paymentService';
import { formatDate } from '@/utils/formatters';
import { ROLES } from '@/utils/constants';

const PAYMENT_STATUS_VARIANT = {
  created: 'amber',
  paid: 'green',
  failed: 'red',
  refunded: 'gray',
};

const ESCROW_STATUS_VARIANT = {
  escrowed: 'amber',
  awaiting_review: 'amber',
  ready_to_release: 'blue',
  payout_requested: 'gray',
  released: 'blue',
  withdrawn: 'green',
  refunded: 'red',
};

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [escrowStatus, setEscrowStatus] = useState('');
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { items, meta: m } = await adminListPayments({
        search: search || undefined,
        status: status || undefined,
        escrowStatus: escrowStatus || undefined,
        limit: 30,
      });
      setRows(items || []);
      setMeta(m || null);
    } catch (err) {
      setError(err.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [search, status, escrowStatus]);

  useEffect(() => {
    load();
  }, [load]);

  function applySearch(e) {
    if (e) e.preventDefault();
    setSearch(searchInput.trim());
  }

  async function confirmRefund() {
    if (!refundTarget || refundSubmitting) return;
    setActionError('');
    setRefundSubmitting(true);
    try {
      await adminRefundPayment(refundTarget.id, {
        reason: refundReason.trim() || 'Admin refund',
      });
      setRefundTarget(null);
      setRefundReason('');
      await load();
    } catch (err) {
      setActionError(err.message || 'Refund failed.');
    } finally {
      setRefundSubmitting(false);
    }
  }

  const total = (meta && meta.total) || rows.length;

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Payments"
      subtitle="Every Razorpay payment with its escrow state — refund, audit, reconcile"
    >
      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <form
              onSubmit={applySearch}
              className="flex flex-1 items-end gap-2"
            >
              <Input
                label="Search"
                name="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Order ID, payment ID, booking ID…"
              />
              <Button type="submit" variant="outline">
                <Search size={15} />
                Search
              </Button>
            </form>
            <Select
              label="Payment status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'created', label: 'Created' },
                { value: 'paid', label: 'Paid' },
                { value: 'failed', label: 'Failed' },
                { value: 'refunded', label: 'Refunded' },
              ]}
              className="lg:w-44"
            />
            <Select
              label="Escrow status"
              name="escrowStatus"
              value={escrowStatus}
              onChange={(e) => setEscrowStatus(e.target.value)}
              options={[
                { value: '', label: 'All escrow' },
                { value: 'escrowed', label: 'Escrowed' },
                { value: 'awaiting_review', label: 'Awaiting review' },
                { value: 'ready_to_release', label: 'Ready to release' },
                { value: 'payout_requested', label: 'Payout requested' },
                { value: 'released', label: 'Released' },
                { value: 'withdrawn', label: 'Withdrawn' },
                { value: 'refunded', label: 'Refunded' },
              ]}
              className="lg:w-48"
            />
          </div>
        </Card>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <CreditCard size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading ? 'Loading…' : `${total} payment${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={15} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={24} />}
            title="No payments found"
            description="When clients pay for bookings via Razorpay, they appear here."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Payer</th>
                  <th className="px-4 py-3 font-semibold">Professional</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Commission</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Escrow</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {p.payerName || '—'}
                      </p>
                      <p className="text-xs text-slate-500">{p.payerEmail || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {p.professionalName || '—'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {p.professionalEmail || ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {formatINR(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {/* Frozen rate charged on this payment + the rate
                          the pro's current plan would charge today. The
                          two diverge when the pro upgraded after the
                          payment cleared. */}
                      <div className="text-xs">
                        <div className="font-mono font-semibold text-slate-800">
                          {(Number(p.chargedCommissionPercent) || 0).toFixed(2)}%{' '}
                          <span className="font-normal text-slate-400">
                            ({formatINR(p.platformFee || 0)})
                          </span>
                        </div>
                        {p.currentPlanName ? (
                          <div className="text-[11px] text-slate-500">
                            Current plan:{' '}
                            <span className="font-semibold text-slate-700">
                              {p.currentPlanName}
                            </span>{' '}
                            ({Number(p.currentCommissionPercent || 0).toFixed(2)}%)
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={PAYMENT_STATUS_VARIANT[p.status] || 'gray'}
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {p.escrowStatus ? (
                        <Badge
                          variant={
                            ESCROW_STATUS_VARIANT[p.escrowStatus] || 'gray'
                          }
                        >
                          {p.escrowStatus.replace(/_/g, ' ')}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.status === 'paid' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRefundTarget(p);
                            setRefundReason('');
                            setActionError('');
                          }}
                        >
                          <RotateCcw size={14} />
                          Refund
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!refundTarget}
        onClose={() => !refundSubmitting && setRefundTarget(null)}
        title="Refund payment"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefundTarget(null)}
              disabled={refundSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmRefund}
              disabled={refundSubmitting}
            >
              {refundSubmitting ? 'Refunding…' : 'Confirm refund'}
            </Button>
          </>
        }
      >
        {refundTarget && (
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              Refund <strong>{formatINR(refundTarget.amount)}</strong> back to
              the client and reverse the escrow entry? This calls Razorpay's
              refund API and writes a debit ledger row.
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Reason
              </label>
              <textarea
                rows={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Visible in audit logs and admin notifications"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
            </div>
            {actionError && (
              <p className="text-xs text-red-600">{actionError}</p>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

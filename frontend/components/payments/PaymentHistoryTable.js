'use client';

// PaymentHistoryTable — shared list used by /dashboard/client/payments and
// /dashboard/professional/payments. Side ('client' | 'professional')
// switches the header label between Professional and Client.

import {
  CreditCard,
  RefreshCw,
  AlertTriangle,
  ReceiptText,
} from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import { formatINR } from '@/services/paymentService';
import { formatDate } from '@/utils/formatters';

const STATUS_VARIANT = {
  created: 'amber',
  paid: 'green',
  failed: 'red',
  refunded: 'gray',
};

export default function PaymentHistoryTable({
  payments,
  loading,
  error,
  onReload,
  side, // 'client' | 'professional'
}) {
  const counterpartyLabel = side === 'professional' ? 'Client' : 'Professional';
  const total = payments.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <CreditCard size={18} />
          </span>
          <p className="text-sm font-medium text-slate-700">
            {loading
              ? 'Loading…'
              : `${total} payment${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReload} disabled={loading}>
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
              className="h-16 w-full animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={<ReceiptText size={24} />}
          title="No payments yet"
          description={
            side === 'professional'
              ? 'Payments from clients will show up here once they pay for a booking.'
              : 'Your booking payments will show up here.'
          }
        />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">{counterpartyLabel}</th>
                  <th className="px-4 py-3 font-semibold">Detail</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  {side === 'professional' && (
                    <>
                      <th className="px-4 py-3 font-semibold">Markup</th>
                      <th className="px-4 py-3 font-semibold">Net to you</th>
                    </>
                  )}
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Payment ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const isSubscription = p.kind === 'subscription';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(p.capturedAt || p.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={isSubscription ? 'violet' : 'amber'}>
                          {isSubscription ? 'Subscription' : 'Booking'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {p.counterpartyName || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {isSubscription
                          ? p.subscriptionLabel || 'Subscription charge'
                          : p.booking
                            ? `${p.booking.date || ''}${
                                p.booking.time ? ` ${p.booking.time}` : ''
                              } · ${p.booking.duration || 0} min`
                            : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {formatINR(p.amount)}
                      </td>
                      {side === 'professional' && (
                        <>
                          <td className="px-4 py-3 text-slate-600">
                            {!isSubscription && p.platformFee > 0 ? (
                              <>
                                <span className="font-medium text-rose-600">
                                  −{formatINR(p.platformFee)}
                                </span>
                                <span className="ml-1 text-xs text-slate-400">
                                  ({p.amount
                                    ? Math.round((p.platformFee / p.amount) * 100)
                                    : 0}
                                  %)
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-emerald-700">
                            {isSubscription ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              formatINR(p.netAmount || 0)
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[p.status] || 'gray'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {p.razorpayPaymentId || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

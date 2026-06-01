'use client';

// /admin/subscriptions/[id]/subscribers — view-only list of the active
// professionals currently subscribed to a given plan. Useful when the
// admin wants to message everyone on Premium, or check who would be
// affected before deleting / sunsetting a tier.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, AlertTriangle, Users } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import EmptyState from '@/components/common/EmptyState';
import {
  adminGetPlan,
  adminListSubscribers,
} from '@/services/subscriptionService';
import { ROLES } from '@/utils/constants';

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function PlanSubscribersPage() {
  const params = useParams();
  const id = params && params.id;
  const [plan, setPlan] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [p, subs] = await Promise.all([
        adminGetPlan(id),
        adminListSubscribers(id),
      ]);
      setPlan(p);
      setItems(subs);
    } catch (err) {
      setError(err.message || 'Could not load subscribers.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title={plan ? `Subscribers · ${plan.name}` : 'Subscribers'}
      subtitle={`${items.length} active subscriber${items.length === 1 ? '' : 's'}`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button href="/admin/subscriptions" variant="outline" size="sm">
            <ArrowLeft size={15} />
            Back to plans
          </Button>
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
                className="h-14 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No active subscribers"
            description="No professionals are currently subscribed to this plan."
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5">Professional</th>
                    <th className="px-3 py-2.5">Phone</th>
                    <th className="px-3 py-2.5">Billing cycle</th>
                    <th className="px-3 py-2.5">Started</th>
                    <th className="px-3 py-2.5">Ends</th>
                    <th className="px-3 py-2.5">Commission %</th>
                    <th className="px-3 py-2.5">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((sub) => {
                    const u = sub.user || {};
                    const name =
                      u.fullName ||
                      [u.firstName, u.lastName].filter(Boolean).join(' ') ||
                      u.email ||
                      '(unknown)';
                    return (
                      <tr
                        key={sub.id}
                        className="border-b border-slate-100 align-top transition hover:bg-slate-50/50"
                      >
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-900">
                            {name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {u.email || ''}
                          </div>
                          {u.id && (
                            <Link
                              href={`/admin/users/${u.id}`}
                              className="mt-0.5 inline-block text-[11px] font-medium text-amber-700 hover:text-amber-800"
                            >
                              View user
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-700">
                          {u.mobileNumber || '—'}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700">
                          {sub.billingCycle}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700">
                          {fmtDate(sub.startDate)}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700">
                          {sub.endDate ? fmtDate(sub.endDate) : 'No expiry'}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700">
                          {Number(sub.commissionPercentSnapshot || 0)}%
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                              sub.paymentStatus === 'paid'
                                ? 'bg-emerald-100 text-emerald-700'
                                : sub.paymentStatus === 'free'
                                  ? 'bg-teal-100 text-teal-700'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {sub.paymentStatus}
                          </span>
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
    </DashboardLayout>
  );
}

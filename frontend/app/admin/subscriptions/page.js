'use client';

// Admin → Subscriptions listing.
// Mirrors the structure of /admin/blog: filters + table + icon-only row
// actions. The single-row actions are: View / Edit / Duplicate / Toggle
// status / Delete / View subscribers. Delete is guarded server-side when
// the plan has active subscribers (returns 409).

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  Copy,
  Eye,
  Power,
  Users,
  AlertTriangle,
  CheckCircle2,
  Star,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import EmptyState from '@/components/common/EmptyState';
import {
  adminListPlans,
  adminSetPlanStatus,
  adminDuplicatePlan,
  adminDeletePlan,
} from '@/services/subscriptionService';
import { ROLES } from '@/utils/constants';

function fmtMoney(amount, currency = 'INR') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}

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

const STATUS_PILL = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-600',
};
const TYPE_PILL = {
  free: 'bg-teal-100 text-teal-700',
  paid: 'bg-amber-100 text-amber-700',
  custom: 'bg-violet-100 text-violet-700',
};

export default function AdminSubscriptionsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [planType, setPlanType] = useState('');
  const [busyId, setBusyId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await adminListPlans({
        search: search || undefined,
        status: status || undefined,
        planType: planType || undefined,
      });
      setItems(rows);
    } catch (err) {
      setError(err.message || 'Failed to load subscription plans.');
    } finally {
      setLoading(false);
    }
  }, [search, status, planType]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleStatus(plan) {
    if (busyId) return;
    setBusyId(plan.id);
    try {
      const next = plan.status === 'active' ? 'inactive' : 'active';
      await adminSetPlanStatus(plan.id, next);
      await load();
    } catch (err) {
      setError(err.message || 'Could not change plan status.');
    } finally {
      setBusyId('');
    }
  }

  async function duplicate(plan) {
    if (busyId) return;
    setBusyId(plan.id);
    try {
      await adminDuplicatePlan(plan.id);
      await load();
    } catch (err) {
      setError(err.message || 'Could not duplicate plan.');
    } finally {
      setBusyId('');
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    setDeleteError('');
    try {
      await adminDeletePlan(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setDeleteError(err.message || 'Could not delete plan.');
    } finally {
      setBusyId('');
    }
  }

  const totals = useMemo(() => {
    const active = items.filter((p) => p.status === 'active').length;
    const subscribers = items.reduce(
      (acc, p) => acc + (Number(p.activeSubscriberCount) || 0),
      0
    );
    return { plans: items.length, active, subscribers };
  }, [items]);

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Subscription plans"
      subtitle="Tiers professionals can subscribe to. Pricing, commission, limits and feature gates are all configurable here."
    >
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="rounded-lg bg-slate-100 px-3 py-1 font-medium">
              {totals.plans} plan{totals.plans === 1 ? '' : 's'}
            </span>
            <span className="rounded-lg bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
              {totals.active} active
            </span>
            <span className="rounded-lg bg-teal-100 px-3 py-1 font-medium text-teal-700">
              {totals.subscribers} subscriber
              {totals.subscribers === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw size={15} />
              Refresh
            </Button>
            <Button href="/admin/subscriptions/new" variant="primary" size="sm">
              <Plus size={15} />
              New plan
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or slug…"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <Select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
            <Select
              name="planType"
              value={planType}
              onChange={(e) => setPlanType(e.target.value)}
              options={[
                { value: '', label: 'All types' },
                { value: 'free', label: 'Free' },
                { value: 'paid', label: 'Paid' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
          </div>
        </Card>

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
                className="h-20 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Star size={22} />}
            title="No plans yet"
            description="Create your first subscription plan to start charging professionals."
            action={
              <Button href="/admin/subscriptions/new" variant="primary">
                <Plus size={15} />
                New plan
              </Button>
            }
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5">Plan</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Monthly</th>
                    <th className="px-3 py-2.5">Annual</th>
                    <th className="px-3 py-2.5">Commission</th>
                    <th className="px-3 py-2.5">Cases</th>
                    <th className="px-3 py-2.5">Firms / Pros</th>
                    <th className="px-3 py-2.5">Featured</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Subscribers</th>
                    <th className="px-3 py-2.5">Created</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((plan) => (
                    <tr
                      key={plan.id}
                      className="border-b border-slate-100 align-top transition hover:bg-slate-50/50"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {plan.name}
                          </span>
                          {plan.recommendedBadge && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                              <Star size={10} />
                              Recommended
                            </span>
                          )}
                          {plan.featuredBadge && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                              Featured
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                          {plan.slug}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                            TYPE_PILL[plan.planType] || 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {plan.planType}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-700">
                        {plan.isCustomPlan
                          ? 'Custom'
                          : plan.monthlyEnabled
                            ? fmtMoney(plan.monthlyPrice, plan.currency)
                            : '—'}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-700">
                        {plan.annualEnabled
                          ? fmtMoney(plan.annualPrice, plan.currency)
                          : '—'}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-700">
                        {plan.isCustomPlan
                          ? 'Custom'
                          : `${Number(plan.commissionPercent || 0)}%`}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        {plan.unlimitedCases ? 'Unlimited' : (plan.caseLimit ?? '—')}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        {plan.firmCreationAllowed
                          ? `${plan.unlimitedFirms ? '∞' : (plan.firmLimit ?? 0)} firm · ${
                              plan.unlimitedProfessionals
                                ? '∞'
                                : (plan.professionalsAllowed ?? 0)
                            } pro`
                          : 'No firm'}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        {plan.featuredProfileAllowed ? (
                          <CheckCircle2 size={14} className="text-emerald-600" />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                            STATUS_PILL[plan.status] || 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {plan.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <Link
                          href={`/admin/subscriptions/${plan.id}/subscribers`}
                          className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-800"
                        >
                          <Users size={12} />
                          {plan.activeSubscriberCount || 0}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {fmtDate(plan.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/subscriptions/${plan.id}/edit`}
                            title="Edit plan"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-amber-300 hover:text-amber-700"
                          >
                            <Pencil size={14} />
                          </Link>
                          <Link
                            href={`/admin/subscriptions/${plan.id}/subscribers`}
                            title="View subscribers"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
                          >
                            <Eye size={14} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => duplicate(plan)}
                            disabled={busyId === plan.id}
                            title="Duplicate"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatus(plan)}
                            disabled={busyId === plan.id}
                            title={
                              plan.status === 'active'
                                ? 'Deactivate'
                                : 'Activate'
                            }
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white transition disabled:opacity-50 ${
                              plan.status === 'active'
                                ? 'border-amber-200 text-amber-700 hover:border-amber-300 hover:bg-amber-50'
                                : 'border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50'
                            }`}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDelete(plan);
                              setDeleteError('');
                            }}
                            disabled={busyId === plan.id}
                            title="Delete"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <h3 className="text-base font-semibold text-slate-900">
                Delete &ldquo;{confirmDelete.name}&rdquo;?
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                This permanently removes the plan and its feature rules. The
                operation is rejected if any professionals are still actively
                subscribed.
              </p>
              {deleteError && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(null)}
                  disabled={busyId === confirmDelete.id}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={doDelete}
                  disabled={busyId === confirmDelete.id}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {busyId === confirmDelete.id ? 'Deleting…' : 'Delete plan'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

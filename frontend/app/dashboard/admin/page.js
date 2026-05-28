'use client';

// Admin overview — the consolidated platform-admin dashboard.
// Fetches GET /api/admin/overview on mount and renders live stats,
// approval action cards and recent activity.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  Building2,
  Mail,
  ShieldCheck,
  Activity,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import { ROLES } from '@/utils/constants';
import { formatRelative } from '@/utils/formatters';
import { getAdminOverview } from '@/services/adminService';

/** Status → Badge variant for audit-log rows. */
function logStatusVariant(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'success') return 'green';
  if (s === 'failure' || s === 'failed' || s === 'error') return 'red';
  return 'gray';
}

function SectionTitle({ title, description }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="text-sm text-slate-500">{description}</p>}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-28 w-full animate-pulse rounded-xl bg-slate-100"
          />
        ))}
      </div>
      <div className="h-32 w-full animate-pulse rounded-xl bg-slate-100" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-28 w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="h-28 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
      <div className="h-64 w-full animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminOverview();
      setOverview(data || null);
    } catch (err) {
      setError(err.message || 'Failed to load the admin overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Defensive shape — every section reads from a safe fallback.
  const users = (overview && overview.users) || {};
  const professionals = (overview && overview.professionals) || {};
  const firms = (overview && overview.firms) || {};
  const invitations = (overview && overview.invitations) || {};
  const recentLogs = Array.isArray(overview && overview.recentAuditLogs)
    ? overview.recentAuditLogs
    : [];

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Admin overview"
      subtitle="Platform health, approvals and recent activity at a glance"
    >
      {loading ? (
        <OverviewSkeleton />
      ) : error ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={22} />
            </span>
            <p className="text-sm font-medium text-slate-700">{error}</p>
            <Button size="sm" onClick={load}>
              <RefreshCw size={15} />
              Try again
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              label="Total users"
              value={users.total || 0}
              icon={<Users size={20} />}
              variant="blue"
            />
            <StatsCard
              label="Professionals"
              value={professionals.total || 0}
              icon={<UserCheck size={20} />}
              variant="green"
              hint={`${professionals.pendingApproval || 0} pending approval`}
            />
            <StatsCard
              label="Firms"
              value={firms.total || 0}
              icon={<Building2 size={20} />}
              variant="amber"
              hint={`${firms.pendingApproval || 0} pending · ${
                firms.active || 0
              } active`}
            />
            <StatsCard
              label="Pending invitations"
              value={invitations.pending || 0}
              icon={<Mail size={20} />}
              variant="slate"
            />
          </div>

          {/* Approval workflows — professionals + firms */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Link
              href="/admin/professionals"
              className="block rounded-xl border border-amber-200 bg-amber-50 p-5 transition-colors hover:border-amber-300 hover:bg-amber-100"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                    <ShieldCheck size={22} />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      Professional approvals
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Review applications and approve, reject or request more
                      information.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {(professionals.pendingApproval || 0) > 0 && (
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-500 px-2 text-sm font-semibold text-white">
                      {professionals.pendingApproval}
                    </span>
                  )}
                  <ArrowRight size={18} className="text-amber-600" />
                </div>
              </div>
            </Link>

            <Link
              href="/admin/firms"
              className="block rounded-xl border border-amber-200 bg-amber-50 p-5 transition-colors hover:border-amber-300 hover:bg-amber-100"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                    <Building2 size={22} />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      Firm approvals
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Review law firms and approve, reject or request
                      modifications.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {(firms.pendingApproval || 0) > 0 && (
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-500 px-2 text-sm font-semibold text-white">
                      {firms.pendingApproval}
                    </span>
                  )}
                  <ArrowRight size={18} className="text-amber-600" />
                </div>
              </div>
            </Link>
          </section>

          {/* Recent activity */}
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <SectionTitle
                title="Recent activity"
                description="The latest audit-log events on the platform."
              />
              <Button size="sm" variant="outline" href="/admin/audit-logs">
                View all
                <ArrowRight size={15} />
              </Button>
            </div>
            <Card padding={false}>
              {recentLogs.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={<Activity size={24} />}
                    title="No recent activity"
                    description="Audit-log events will appear here as they happen."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recentLogs.map((log, i) => {
                    const variant = logStatusVariant(log.status);
                    const ok = variant === 'green';
                    return (
                      <li
                        key={`${log.action}-${log.createdAt}-${i}`}
                        className="flex items-center justify-between gap-3 px-5 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              ok
                                ? 'bg-emerald-100 text-emerald-600'
                                : variant === 'red'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {ok ? (
                              <CheckCircle2 size={16} />
                            ) : variant === 'red' ? (
                              <XCircle size={16} />
                            ) : (
                              <Activity size={16} />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {log.action || 'Unknown event'}
                            </p>
                            <p className="truncate text-xs text-slate-400">
                              {formatRelative(log.createdAt)}
                              {log.ipAddress ? ` · ${log.ipAddress}` : ''}
                            </p>
                          </div>
                        </div>
                        <Badge variant={variant}>
                          {log.status || 'unknown'}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}

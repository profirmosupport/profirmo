'use client';

// Admin — pending professional approvals list.
// Auth-guarded and admin-only (platform_admin). Lists every professional
// awaiting approval and links to the per-applicant review page.

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/AuthProvider';
import { ROLES } from '@/utils/constants';
import { formatDate, getInitials } from '@/utils/formatters';
import {
  listPendingProfessionals,
  setProfessionalFeatured,
} from '@/services/adminService';
import { getAll as listApprovedProfessionals } from '@/services/professionalService';
import { Star } from 'lucide-react';

/** Build a display name from a row's nested user object. */
function userName(user) {
  if (!user) return 'Unknown applicant';
  if (user.fullName) return user.fullName;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : user.email || 'Unknown applicant';
}

/** Status → { label, variant } for the approval status badge. */
function statusBadge(status) {
  if (status === 'INFO_REQUESTED') {
    return { label: 'Resubmitted', variant: 'blue' };
  }
  return { label: 'Pending approval', variant: 'amber' };
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-24 w-full animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}

export default function AdminProfessionalsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user && user.role === ROLES.PLATFORM_ADMIN;

  // Redirect unauthenticated visitors once auth has resolved.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await listPendingProfessionals({ page: 1, limit: 100 });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load pending professionals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) {
      load();
    }
  }, [authLoading, isAuthenticated, isAdmin, load]);

  // While auth resolves, DashboardLayout renders its own skeleton shell.
  if (authLoading || !isAuthenticated) {
    return (
      <DashboardLayout
        role={ROLES.PLATFORM_ADMIN}
        title="Professional approvals"
      />
    );
  }

  // Authenticated, but not an admin — show an access-denied state.
  if (!isAdmin) {
    return (
      <DashboardLayout
        role={ROLES.PLATFORM_ADMIN}
        title="Professional approvals"
      >
        <EmptyState
          icon={<ShieldAlert size={24} />}
          title="Access denied"
          description="You need a platform administrator account to view professional approvals."
          action={
            <Button href="/dashboard" variant="outline">
              Back to dashboard
            </Button>
          }
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Professional approvals"
      subtitle="Review and decide on professionals awaiting verification"
    >
      <div className="space-y-6">
        {/* Curate which approved professionals surface on the home page. */}
        <FeaturedProfessionalsPanel />

        {/* Header row with count + refresh */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <ShieldCheck size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading
                ? 'Loading applications…'
                : `${rows.length} application${
                    rows.length === 1 ? '' : 's'
                  } awaiting review`}
            </p>
          </div>
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
          <ListSkeleton />
        ) : error ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
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
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={24} />}
            title="No pending approvals"
            description="There are no professionals awaiting review right now. New applications will appear here."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Professional</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Submitted</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const badge = statusBadge(row.status);
                    const name = userName(row.user);
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-semibold text-white">
                              {getInitials(name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">
                                {name}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {row.user && row.user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="gray">
                            {row.professionalType || '—'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(row.submittedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          {row.resubmissionCount > 0 && (
                            <span className="ml-2 text-xs text-slate-400">
                              ×{row.resubmissionCount}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            href={`/admin/professionals/${row.id}`}
                          >
                            <Eye size={15} />
                            Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {rows.map((row) => {
                const badge = statusBadge(row.status);
                const name = userName(row.user);
                return (
                  <Card key={row.id}>
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-semibold text-white">
                        {getInitials(name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-800">
                          {name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {row.user && row.user.email}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="gray">
                            {row.professionalType || '—'}
                          </Badge>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                          Submitted {formatDate(row.submittedAt)}
                          {row.resubmissionCount > 0 &&
                            ` · resubmitted ×${row.resubmissionCount}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        href={`/admin/professionals/${row.id}`}
                        className="w-full"
                      >
                        <Eye size={15} />
                        Review application
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// FeaturedProfessionalsPanel — admin-curates which approved
// professionals appear in the public home page "Talk to Verified
// Consultants" directory. Lists all approved entries with a Featured
// checkbox. Toggling immediately POSTs the change (optimistic UI).
function FeaturedProfessionalsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [savingId, setSavingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await listApprovedProfessionals({ limit: 200 });
      setItems(Array.isArray(res && res.data) ? res.data : []);
    } catch (e) {
      setErr(e.message || 'Failed to load professionals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(row) {
    const next = !row.featured;
    setSavingId(row.id);
    // Optimistic — flip locally first; rollback on failure.
    setItems((arr) =>
      arr.map((r) => (r.id === row.id ? { ...r, featured: next } : r))
    );
    try {
      await setProfessionalFeatured(row.id, next);
    } catch (e) {
      setItems((arr) =>
        arr.map((r) =>
          r.id === row.id ? { ...r, featured: !next } : r
        )
      );
      setErr(e.message || `Failed to update ${row.name || row.id}.`);
    } finally {
      setSavingId('');
    }
  }

  const featuredCount = items.filter((r) => r.featured).length;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Star size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Home page directory
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              Tick a professional to surface them in the public &ldquo;Talk
              to Verified Consultants&rdquo; section. Admin-curated; not a
              ranking — Bar Council India ad rules don&apos;t permit
              promoting individual advocates as best/top.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {loading
                ? 'Loading…'
                : `${featuredCount} of ${items.length} marked featured`}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {err && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-slate-200">
        {loading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-10 w-full animate-pulse rounded bg-slate-100"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500">
            No approved professionals yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <label className="flex flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!row.featured}
                    onChange={() => toggle(row)}
                    disabled={savingId === row.id}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {row.name || row.fullName || row.id}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {row.professionalType || '—'}
                      {row.city ? ` · ${row.city}` : ''}
                    </p>
                  </div>
                </label>
                {row.featured && <Badge variant="amber">Featured</Badge>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

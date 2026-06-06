'use client';

// Admin — newsletter subscriber list.
// Lists every row from the newsletter_subscribers table with search +
// status filter + pagination. Each row can be toggled active /
// unsubscribed, deleted, or exported as CSV.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  RefreshCw,
  Search,
  AlertTriangle,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  Ban,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import EmptyState from '@/components/common/EmptyState';
import Modal from '@/components/common/Modal';
import { useAuth } from '@/components/AuthProvider';
import { ROLES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import {
  adminListSubscribers,
  adminSetSubscriberStatus,
  adminDeleteSubscriber,
} from '@/services/newsletterService';

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
];

function statusBadge(status) {
  if (status === 'unsubscribed') {
    return { label: 'Unsubscribed', variant: 'gray' };
  }
  return { label: 'Active', variant: 'green' };
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows) {
  if (!rows || rows.length === 0) return;
  const header = [
    'email',
    'fullName',
    'phone',
    'city',
    'interests',
    'source',
    'status',
    'createdAt',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(header.map((k) => csvEscape(r[k])).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `profirmo-newsletter-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function AdminNewsletterPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = user && user.role === ROLES.PLATFORM_ADMIN;

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [busy, setBusy] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminListSubscribers({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
      });
      setRows(Array.isArray(result && result.rows) ? result.rows : []);
      setMeta(result || null);
    } catch (err) {
      setError(err.message || 'Failed to load subscribers.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) load();
  }, [authLoading, isAuthenticated, isAdmin, load]);

  function applySearch(e) {
    if (e) e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function toggleStatus(row) {
    const next = row.status === 'active' ? 'unsubscribed' : 'active';
    setBusy(row.id);
    try {
      await adminSetSubscriberStatus(row.id, next);
      await load();
    } catch (err) {
      setError(err.message || 'Could not update subscriber.');
    } finally {
      setBusy('');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(deleteTarget.id);
    try {
      await adminDeleteSubscriber(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete subscriber.');
    } finally {
      setBusy('');
    }
  }

  if (authLoading || !isAuthenticated) {
    return <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Newsletter" />;
  }
  if (!isAdmin) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Newsletter">
        <EmptyState
          icon={<ShieldAlert size={24} />}
          title="Access denied"
          description="You need a platform administrator account to view newsletter subscribers."
          action={
            <Button href="/dashboard" variant="outline">
              Back to dashboard
            </Button>
          }
        />
      </DashboardLayout>
    );
  }

  const totalCount = meta && Number.isFinite(meta.total) ? meta.total : rows.length;
  const totalPages = meta && meta.totalPages ? meta.totalPages : 1;

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Newsletter"
      subtitle="Footer signups and profile details"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Mail size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading
                ? 'Loading…'
                : `${totalCount} subscriber${totalCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(rows)}
              disabled={loading || rows.length === 0}
            >
              <Download size={15} />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw size={15} />
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <form
            onSubmit={applySearch}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-[14rem] flex-1">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Search
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Email, name, phone, city, interest…"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>
            </div>
            <Select
              label="Status"
              name="status"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              options={STATUS_OPTIONS}
            />
            <Button type="submit" variant="primary" size="sm">
              Apply
            </Button>
          </form>
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
                className="h-16 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Mail size={24} />}
            title="No subscribers yet"
            description="Visitors who submit the footer form will appear here."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">City</th>
                    <th className="px-4 py-3 font-semibold">Interests</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const badge = statusBadge(row.status);
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-800">
                          {row.email}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.fullName || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.phone || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.city || '—'}
                        </td>
                        <td className="px-4 py-3 max-w-[16rem] truncate text-slate-700" title={row.interests || ''}>
                          {row.interests || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleStatus(row)}
                              disabled={busy === row.id}
                              title={
                                row.status === 'active'
                                  ? 'Mark unsubscribed'
                                  : 'Re-activate'
                              }
                            >
                              {row.status === 'active' ? (
                                <>
                                  <Ban size={14} />
                                  Unsub
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={14} />
                                  Activate
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteTarget(row)}
                              disabled={busy === row.id}
                            >
                              <Trash2 size={14} />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                  >
                    Next
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={!!deleteTarget}
        onClose={() => !busy && setDeleteTarget(null)}
        title="Delete subscriber"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={!!busy}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDelete}
              disabled={!!busy}
            >
              {busy ? 'Deleting…' : 'Delete subscriber'}
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <p className="text-sm text-slate-700">
            Permanently delete <strong>{deleteTarget.email}</strong>? This
            removes the row entirely; you can&apos;t recover it. If you
            just want them off the list, use &ldquo;Unsub&rdquo; instead.
          </p>
        )}
      </Modal>
    </DashboardLayout>
  );
}

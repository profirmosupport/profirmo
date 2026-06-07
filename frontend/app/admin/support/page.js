'use client';

// Admin — support ticket list (Pipeline → Support).
// One row per /contact submission. Status workflow: open → in_progress
// → resolved / closed. Status, admin note, and delete are all editable
// in-page; tickets are not auto-removed, so deletion is explicit.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LifeBuoy,
  Mail,
  RefreshCw,
  Search,
  AlertTriangle,
  ShieldAlert,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Select from '@/components/common/Select';
import EmptyState from '@/components/common/EmptyState';
import Modal from '@/components/common/Modal';
import { useAuth } from '@/components/AuthProvider';
import { ROLES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import {
  adminListTickets,
  adminSetTicketStatus,
  adminSetTicketNote,
  adminDeleteTicket,
  STATUS_OPTIONS,
} from '@/services/supportService';

const PAGE_SIZE = 50;

const FILTER_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...STATUS_OPTIONS,
];

function statusBadge(status) {
  if (status === 'open') return { label: 'Open', variant: 'amber' };
  if (status === 'in_progress') return { label: 'In progress', variant: 'blue' };
  if (status === 'resolved') return { label: 'Resolved', variant: 'green' };
  if (status === 'closed') return { label: 'Closed', variant: 'gray' };
  return { label: status || 'Unknown', variant: 'gray' };
}

export default function AdminSupportPage() {
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
  const [openTicket, setOpenTicket] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminListTickets({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
      });
      setRows(Array.isArray(result && result.rows) ? result.rows : []);
      setMeta(result || null);
    } catch (err) {
      setError(err.message || 'Failed to load tickets.');
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

  async function changeStatus(row, nextStatus) {
    if (!nextStatus || nextStatus === row.status) return;
    setBusy(row.id);
    try {
      const updated = await adminSetTicketStatus(row.id, nextStatus);
      setRows((arr) => arr.map((r) => (r.id === row.id ? updated : r)));
      if (openTicket && openTicket.id === row.id) setOpenTicket(updated);
    } catch (err) {
      setError(err.message || 'Could not update status.');
    } finally {
      setBusy('');
    }
  }

  async function saveNote() {
    if (!openTicket) return;
    setBusy(openTicket.id);
    try {
      const updated = await adminSetTicketNote(openTicket.id, noteDraft);
      setRows((arr) =>
        arr.map((r) => (r.id === openTicket.id ? updated : r))
      );
      setOpenTicket(updated);
    } catch (err) {
      setError(err.message || 'Could not save note.');
    } finally {
      setBusy('');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(deleteTarget.id);
    try {
      await adminDeleteTicket(deleteTarget.id);
      setDeleteTarget(null);
      if (openTicket && openTicket.id === deleteTarget.id) setOpenTicket(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete ticket.');
    } finally {
      setBusy('');
    }
  }

  function openTicketModal(row) {
    setOpenTicket(row);
    setNoteDraft(row.adminNote || '');
  }

  if (authLoading || !isAuthenticated) {
    return <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Support" />;
  }
  if (!isAdmin) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Support">
        <EmptyState
          icon={<ShieldAlert size={24} />}
          title="Access denied"
          description="You need a platform administrator account to view support tickets."
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
  const openCount = rows.filter((r) => r.status === 'open').length;

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Support"
      subtitle="/contact page submissions"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <LifeBuoy size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading
                ? 'Loading…'
                : `${totalCount} ticket${totalCount === 1 ? '' : 's'}`}
              {!loading && openCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  {openCount} open
                </span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={15} />
            Refresh
          </Button>
        </div>

        <Card>
          <form onSubmit={applySearch} className="flex flex-wrap items-end gap-3">
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
                  placeholder="Name, email, subject, message…"
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
              options={FILTER_STATUS_OPTIONS}
            />
            <Button type="submit" variant="primary" size="sm">
              Apply
            </Button>
          </form>
        </Card>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-red-700 opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
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
            title="No tickets yet"
            description="Submissions from the public /contact page will appear here."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">From</th>
                    <th className="px-4 py-3 font-semibold">Subject</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Received</th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const badge = statusBadge(row.status);
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">
                              {row.name}
                            </p>
                            <p className="truncate font-mono text-[11px] text-slate-500">
                              {row.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <button
                            type="button"
                            onClick={() => openTicketModal(row)}
                            className="text-left font-medium text-slate-800 hover:text-amber-700"
                          >
                            {row.subject}
                          </button>
                          <p className="truncate text-xs text-slate-500">
                            {row.message}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-36">
                              <Select
                                name="status"
                                value={row.status}
                                onChange={(e) => changeStatus(row, e.target.value)}
                                options={STATUS_OPTIONS}
                                disabled={busy === row.id}
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openTicketModal(row)}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteTarget(row)}
                              disabled={busy === row.id}
                            >
                              <Trash2 size={14} />
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

      {/* Ticket detail / triage modal */}
      <Modal
        open={!!openTicket}
        onClose={() => setOpenTicket(null)}
        title={openTicket ? openTicket.subject : ''}
        size="lg"
        footer={
          openTicket && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenTicket(null)}
                disabled={busy === openTicket.id}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={saveNote}
                disabled={
                  busy === openTicket.id ||
                  (openTicket.adminNote || '') === noteDraft
                }
              >
                {busy === openTicket.id ? 'Saving…' : 'Save note'}
              </Button>
            </>
          )
        }
      >
        {openTicket && (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  From
                </p>
                <p className="text-slate-800">{openTicket.name}</p>
                <a
                  href={`mailto:${openTicket.email}`}
                  className="font-mono text-xs text-amber-700 hover:text-amber-800"
                >
                  {openTicket.email}
                </a>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Status
                </p>
                <div className="mt-1 w-40">
                  <Select
                    name="status"
                    value={openTicket.status}
                    onChange={(e) => changeStatus(openTicket, e.target.value)}
                    options={STATUS_OPTIONS}
                    disabled={busy === openTicket.id}
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Message
              </p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {openTicket.message}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500">
                Admin note
              </label>
              <textarea
                rows={3}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Internal triage notes — not sent to the submitter."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div className="text-[11px] text-slate-400">
              Ticket id <span className="font-mono">{openTicket.id}</span> ·
              received {formatDate(openTicket.createdAt)}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !busy && setDeleteTarget(null)}
        title="Delete ticket"
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
              {busy ? 'Deleting…' : 'Delete ticket'}
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <p className="text-sm text-slate-700">
            Permanently delete <strong>{deleteTarget.subject}</strong> from{' '}
            <strong>{deleteTarget.email}</strong>? This removes the row
            entirely. If you want it archived, set status to{' '}
            <em>Closed</em> instead.
          </p>
        )}
      </Modal>
    </DashboardLayout>
  );
}

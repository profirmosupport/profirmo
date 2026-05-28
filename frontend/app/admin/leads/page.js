'use client';

// Admin — Leads list.
// Browse / search / filter every Lead captured from the homepage CTA and
// the gated advanced-search popup, add new leads manually, edit, delete,
// change status, and drill into the detail page for the activity timeline
// + conversion to Opportunity.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  UserPlus,
  Users,
  RefreshCw,
  AlertTriangle,
  Search,
  Pencil,
  Trash2,
  ArrowRight,
  Filter,
  ShieldAlert,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/AuthProvider';
import { ROLES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import {
  adminListLeads,
  adminCreateLead,
  adminUpdateLead,
  adminDeleteLead,
  LEAD_STATUSES,
} from '@/services/leadService';
import { listUsers } from '@/services/adminService';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...LEAD_STATUSES.map((s) => ({ value: s, label: s })),
];

const SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'Homepage AI CTA', label: 'Homepage AI CTA' },
  { value: 'Advanced Search', label: 'Advanced Search' },
  { value: 'Manual', label: 'Manual' },
];

function statusVariant(s) {
  switch (s) {
    case 'New':
      return 'blue';
    case 'Contacted':
      return 'amber';
    case 'Qualified':
      return 'green';
    case 'Opportunity':
      return 'violet';
    case 'Converted':
      return 'emerald';
    default:
      return 'gray';
  }
}

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  source: 'Manual',
  status: 'New',
  notes: '',
  assignedToUserId: '',
};

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-14 w-full animate-pulse rounded-lg bg-slate-100"
        />
      ))}
    </div>
  );
}

export default function AdminLeadsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [assignees, setAssignees] = useState([]);

  const [modal, setModal] = useState(null); // {mode, target?, form}
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const isAdmin = user && user.role === ROLES.PLATFORM_ADMIN;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, meta: m } = await adminListLeads({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
        source: source || undefined,
        assignedTo: assignedTo || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setRows(Array.isArray(data) ? data : []);
      setMeta(m || null);
    } catch (err) {
      setError(err.message || 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, source, assignedTo, dateFrom, dateTo]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) load();
  }, [authLoading, isAuthenticated, isAdmin, load]);

  // Load platform_admin users once for the "assign to" dropdown.
  useEffect(() => {
    if (!isAdmin) return;
    listUsers({ role: 'platform_admin', limit: 100 })
      .then(({ data }) => setAssignees(Array.isArray(data) ? data : []))
      .catch(() => setAssignees([]));
  }, [isAdmin]);

  function applySearch(e) {
    if (e) e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openCreate() {
    setModalError('');
    setModal({ mode: 'create', form: { ...EMPTY_FORM } });
  }
  function openEdit(row) {
    setModalError('');
    setModal({
      mode: 'edit',
      target: row,
      form: {
        fullName: row.fullName || '',
        email: row.email || '',
        phone: row.phone || '',
        source: row.source || 'Manual',
        status: row.status || 'New',
        notes: row.notes || '',
        assignedToUserId: row.assignedToUserId || '',
      },
    });
  }
  function openDelete(row) {
    setModalError('');
    setModal({ mode: 'delete', target: row });
  }
  function close() {
    if (submitting) return;
    setModal(null);
    setModalError('');
  }

  async function submit(e) {
    if (e) e.preventDefault();
    if (!modal || submitting) return;
    setSubmitting(true);
    setModalError('');
    try {
      if (modal.mode === 'create') {
        await adminCreateLead({
          fullName: modal.form.fullName,
          email: modal.form.email,
          phone: modal.form.phone,
          source: modal.form.source,
          status: modal.form.status,
          notes: modal.form.notes || null,
          assignedToUserId: modal.form.assignedToUserId || null,
        });
      } else if (modal.mode === 'edit') {
        await adminUpdateLead(modal.target.id, {
          fullName: modal.form.fullName,
          email: modal.form.email,
          phone: modal.form.phone,
          source: modal.form.source,
          status: modal.form.status,
          notes: modal.form.notes || null,
          assignedToUserId: modal.form.assignedToUserId || null,
        });
      } else if (modal.mode === 'delete') {
        await adminDeleteLead(modal.target.id);
      }
      setModal(null);
      await load();
    } catch (err) {
      setModalError(err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !isAuthenticated) {
    return <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Leads" />;
  }
  if (!isAdmin) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Leads">
        <EmptyState
          icon={<ShieldAlert size={24} />}
          title="Access denied"
          description="You need a platform administrator account to manage leads."
          action={
            <Button href="/dashboard" variant="outline">
              Back to dashboard
            </Button>
          }
        />
      </DashboardLayout>
    );
  }

  const total = (meta && meta.total) != null ? meta.total : rows.length;
  const totalPages = (meta && meta.totalPages) || 1;
  const currentPage = (meta && meta.page) || page;

  const ASSIGNEE_OPTIONS = [
    { value: '', label: 'Anyone' },
    ...assignees.map((a) => ({
      value: a.id,
      label: a.fullName || a.email,
    })),
  ];

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Leads"
      subtitle="Inbound leads from the homepage CTA and the gated advanced-search popup"
    >
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">Filters</p>
          </div>
          <form
            onSubmit={applySearch}
            className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4"
          >
            <Input
              label="Search"
              name="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, email or phone…"
            />
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
            <Select
              label="Source"
              name="source"
              value={source}
              onChange={(e) => {
                setPage(1);
                setSource(e.target.value);
              }}
              options={SOURCE_OPTIONS}
            />
            <Select
              label="Assigned to"
              name="assignedTo"
              value={assignedTo}
              onChange={(e) => {
                setPage(1);
                setAssignedTo(e.target.value);
              }}
              options={ASSIGNEE_OPTIONS}
            />
            <Input
              label="From"
              name="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setPage(1);
                setDateFrom(e.target.value);
              }}
            />
            <Input
              label="To"
              name="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
            />
            <div className="flex items-end">
              <Button type="submit" variant="outline" className="w-full">
                <Search size={15} />
                Apply
              </Button>
            </div>
          </form>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Users size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading ? 'Loading…' : `${total} lead${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw size={15} />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <UserPlus size={15} />
              Add lead
            </Button>
          </div>
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
            icon={<Users size={24} />}
            title="No leads"
            description="No leads match your filters yet."
            action={<Button onClick={openCreate}>Add lead</Button>}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Firm</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/leads/${row.id}`}
                        className="font-medium text-slate-800 hover:text-amber-700"
                      >
                        {row.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.email}</td>
                    <td className="px-4 py-3 text-slate-600">{row.phone}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.firmName || (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.source}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(row.status)}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          href={`/admin/leads/${row.id}`}
                        >
                          <ArrowRight size={14} />
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil size={14} />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDelete(row)}
                        >
                          <Trash2 size={14} />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || currentPage <= 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={loading || currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      <Modal
        open={!!modal && modal.mode !== 'delete'}
        onClose={close}
        title={modal && modal.mode === 'edit' ? 'Edit lead' : 'Add lead'}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={submit} disabled={submitting}>
              {submitting
                ? 'Saving…'
                : modal && modal.mode === 'edit'
                  ? 'Save changes'
                  : 'Create lead'}
            </Button>
          </>
        }
      >
        {modal && modal.mode !== 'delete' && (
          <form onSubmit={submit} className="space-y-3">
            <Input
              label="Full name"
              name="fullName"
              value={modal.form.fullName}
              onChange={(e) =>
                setModal((m) => ({ ...m, form: { ...m.form, fullName: e.target.value } }))
              }
              required
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={modal.form.email}
              onChange={(e) =>
                setModal((m) => ({ ...m, form: { ...m.form, email: e.target.value } }))
              }
              required
            />
            <Input
              label="Phone"
              name="phone"
              value={modal.form.phone}
              onChange={(e) =>
                setModal((m) => ({ ...m, form: { ...m.form, phone: e.target.value } }))
              }
              required
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Source"
                name="source"
                value={modal.form.source}
                onChange={(e) =>
                  setModal((m) => ({ ...m, form: { ...m.form, source: e.target.value } }))
                }
                options={SOURCE_OPTIONS.filter((o) => o.value !== '')}
              />
              <Select
                label="Status"
                name="status"
                value={modal.form.status}
                onChange={(e) =>
                  setModal((m) => ({ ...m, form: { ...m.form, status: e.target.value } }))
                }
                options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <Select
              label="Assigned to"
              name="assignedToUserId"
              value={modal.form.assignedToUserId}
              onChange={(e) =>
                setModal((m) => ({ ...m, form: { ...m.form, assignedToUserId: e.target.value } }))
              }
              options={ASSIGNEE_OPTIONS}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                rows={3}
                value={modal.form.notes}
                onChange={(e) =>
                  setModal((m) => ({ ...m, form: { ...m.form, notes: e.target.value } }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-100"
              />
            </div>
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        )}
        {modalError && <p className="mt-3 text-xs text-red-600">{modalError}</p>}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!modal && modal.mode === 'delete'}
        onClose={close}
        title="Delete lead"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={submit} disabled={submitting}>
              {submitting ? 'Deleting…' : 'Delete lead'}
            </Button>
          </>
        }
      >
        {modal && modal.mode === 'delete' && (
          <p className="text-sm text-slate-600">
            Permanently delete <strong>{modal.target.fullName}</strong>?
          </p>
        )}
        {modalError && <p className="mt-3 text-xs text-red-600">{modalError}</p>}
      </Modal>
    </DashboardLayout>
  );
}

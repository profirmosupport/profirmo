'use client';

// Admin — law firm management.
// Auth-guarded and admin-only (platform_admin). Lists every firm on the
// platform with filters and pagination, and lets an admin view, create,
// edit, or delete any firm.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Eye,
  Pencil,
  Trash2,
  Plus,
  MoreVertical,
  Star,
  StarOff,
  X,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import Avatar from '@/components/common/Avatar';
import RowMenu from '@/components/common/RowMenu';
import { useAuth } from '@/components/AuthProvider';
import { ROLES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import {
  listLawFirms,
  getLawFirm,
  createLawFirm,
  updateLawFirm,
  deleteLawFirm,
  listUsers,
} from '@/services/adminService';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'MODIFICATIONS_REQUESTED', label: 'Modifications requested' },
  { value: 'REJECTED', label: 'Rejected' },
];

// Same options as the filter, minus the "all" placeholder — used in forms.
const STATUS_FORM_OPTIONS = STATUS_OPTIONS.filter((o) => o.value !== '');

/** Status → { label, variant } for the firm status badge. */
function statusBadge(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'ACTIVE') return { label: 'Active', variant: 'green' };
  if (s === 'PENDING_APPROVAL') {
    return { label: 'Pending approval', variant: 'amber' };
  }
  if (s === 'MODIFICATIONS_REQUESTED') {
    return { label: 'Modifications requested', variant: 'amber' };
  }
  if (s === 'REJECTED') return { label: 'Rejected', variant: 'red' };
  return { label: status || 'Unknown', variant: 'gray' };
}

/** Display the firm name with a sensible fallback. */
function firmName(f) {
  if (!f) return 'Unknown firm';
  return f.firmName || 'Untitled firm';
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-16 w-full animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}

/** Empty form shape for the Create modal. */
const EMPTY_CREATE_FORM = {
  firmName: '',
  headquarters: '',
  contactEmail: '',
  contactNumber: '',
  registrationNumber: '',
  website: '',
  establishedYear: '',
  totalEmployees: '',
  status: 'ACTIVE',
  ownerUserId: '',
  about: '',
};

/**
 * FirmActionsMenu — single kebab dropdown holding View / Edit / Delete.
 * Mirrors the UserActionsMenu pattern from app/admin/users/page.js so the
 * table stays compact across widths.
 */
function FirmActionsMenu({ onView, onEdit, onDelete }) {
  return (
    <RowMenu width="w-44">
      <button
        type="button"
        role="menuitem"
        onClick={onView}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
      >
        <Eye size={14} /> View details
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onEdit}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
      >
        <Pencil size={14} /> Edit
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onDelete}
        className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
      >
        <Trash2 size={14} /> Delete
      </button>
    </RowMenu>
  );
}

/**
 * OwnerPicker — read-only display of the current owner with a "Change owner"
 * button that reveals an inline search panel. Calls listUsers({ role:
 * 'professional', search, limit: 10 }) for results.
 *
 * Props:
 *  - currentOwner: { id, name, email, profilePhoto } | null
 *  - selected: { id, name, email, profilePhoto } | null — picked but unsaved
 *  - onSelect(user): called when a professional is picked
 *  - onClear(): called when "Use current owner" is clicked to drop selection
 */
function OwnerPicker({ currentOwner, selected, onSelect, onClear }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Debounce the query so we don't spam the API on every keystroke.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setSearching(true);
    setSearchError('');
    const handle = setTimeout(async () => {
      try {
        const { data } = await listUsers({
          role: 'professional',
          search: query.trim() || undefined,
          limit: 10,
        });
        if (!cancelled) setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setSearchError(err.message || 'Failed to search professionals.');
          setResults([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, query]);

  const display = selected || currentOwner;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Owner
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        {display ? (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              src={display.profilePhoto}
              name={display.name || display.email || ''}
              size="sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-slate-800">
                  {display.name || '—'}
                </p>
                <Badge variant={selected ? 'amber' : 'green'}>
                  {selected ? 'Pending change' : 'Owner'}
                </Badge>
              </div>
              <p className="truncate text-xs text-slate-500">
                {display.email || '—'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No owner assigned.</p>
        )}
        <div className="flex items-center gap-2">
          {selected && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
            >
              Reset
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Close' : 'Change owner'}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
          <p className="text-xs text-slate-500">
            Pick any professional from the platform.
          </p>
          <Input
            name="owner-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search professionals by name or email…"
          />
          {selected && (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              Selected: {selected.name || selected.email}
            </div>
          )}
          {searchError ? (
            <p className="text-xs text-red-600">{searchError}</p>
          ) : searching ? (
            <p className="text-xs text-slate-500">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-xs text-slate-500">No professionals found.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {results.map((u) => {
                const isCurrent =
                  currentOwner && u.id === currentOwner.id && !selected;
                const isSelected = selected && u.id === selected.id;
                return (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar
                        src={u.profilePhoto}
                        name={u.name || u.email || ''}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {u.name || '—'}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {u.email || '—'}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={isSelected ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => onSelect(u)}
                      disabled={isCurrent}
                    >
                      {isSelected
                        ? 'Selected'
                        : isCurrent
                          ? 'Current'
                          : 'Select'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Build the payload for create/update from form state, omitting blanks. */
function buildFirmPayload(form) {
  const payload = {};
  const trim = (v) => (typeof v === 'string' ? v.trim() : v);

  if (trim(form.firmName)) payload.firmName = trim(form.firmName);
  if (trim(form.headquarters)) payload.headquarters = trim(form.headquarters);
  if (trim(form.contactEmail)) payload.contactEmail = trim(form.contactEmail);
  if (trim(form.contactNumber)) {
    payload.contactNumber = trim(form.contactNumber);
  }
  if (trim(form.registrationNumber)) {
    payload.registrationNumber = trim(form.registrationNumber);
  }
  if (trim(form.website)) payload.website = trim(form.website);
  if (form.establishedYear !== '' && form.establishedYear != null) {
    const n = Number(form.establishedYear);
    if (!Number.isNaN(n)) payload.establishedYear = n;
  }
  if (form.totalEmployees !== '' && form.totalEmployees != null) {
    const n = Number(form.totalEmployees);
    if (!Number.isNaN(n)) payload.totalEmployees = n;
  }
  if (form.status) payload.status = form.status;
  if (trim(form.ownerUserId)) payload.ownerUserId = trim(form.ownerUserId);
  if (trim(form.about)) payload.about = trim(form.about);
  // Pass through unchanged — undefined keeps the existing value; the
  // backend coerces strings/numbers back into a boolean.
  if (form.featured !== undefined) payload.featured = !!form.featured;

  return payload;
}

export default function AdminLawFirmsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter state. `searchInput` is the live field; `search` is the applied one.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Create modal state.
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // View modal state.
  const [viewFirm, setViewFirm] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');

  // Edit modal state.
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  // Owner pick state for the Edit modal.
  const [editSelectedOwner, setEditSelectedOwner] = useState(null);

  // Delete modal state.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Bulk selection — same shape as the users page.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkConfirm, setBulkConfirm] = useState(null);

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
      const { data, meta: m } = await listLawFirms({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
      });
      setRows(Array.isArray(data) ? data : []);
      setMeta(m || null);
    } catch (err) {
      setError(err.message || 'Failed to load firms.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) {
      load();
    }
  }, [authLoading, isAuthenticated, isAdmin, load]);

  // Drop the selection whenever the visible row set changes so a tick
  // never silently survives a filter swap.
  useEffect(() => {
    setSelectedIds(new Set());
    setBulkResult(null);
  }, [page, search, status]);

  const selectedRows = rows.filter((r) => selectedIds.has(r.id));
  const selectedCount = selectedRows.length;
  const allOnPageSelected = rows.length > 0 && selectedCount === rows.length;
  function toggleRow(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelectedIds((prev) => {
      if (rows.length > 0 && prev.size === rows.length) return new Set();
      return new Set(rows.map((r) => r.id));
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
    setBulkResult(null);
  }
  async function runBulk({ action, label, eligible, fn, destructive }) {
    if (bulkBusy) return;
    const targets = (eligible || selectedRows).filter(Boolean);
    if (targets.length === 0) {
      setBulkResult({ ok: 0, fail: 0, action, skipped: 'none-eligible', label });
      return;
    }
    const exec = async () => {
      setBulkBusy(true);
      setBulkResult(null);
      let ok = 0;
      let fail = 0;
      for (const row of targets) {
        try {
          await fn(row);
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      setBulkBusy(false);
      setBulkResult({ ok, fail, action, label });
      setSelectedIds(new Set());
      await load();
    };
    if (destructive) {
      setBulkConfirm({ action, label, run: exec, count: targets.length });
    } else {
      await exec();
    }
  }
  function bulkFeature() {
    return runBulk({
      action: 'feature',
      label: 'Mark featured',
      eligible: selectedRows,
      fn: (r) => updateLawFirm(r.id, { featured: true }),
    });
  }
  function bulkUnfeature() {
    return runBulk({
      action: 'unfeature',
      label: 'Remove from featured',
      eligible: selectedRows,
      fn: (r) => updateLawFirm(r.id, { featured: false }),
    });
  }
  function bulkSetStatus(nextStatus, label) {
    return runBulk({
      action: `status-${nextStatus}`,
      label,
      eligible: selectedRows.filter((r) => r.status !== nextStatus),
      fn: (r) => updateLawFirm(r.id, { status: nextStatus }),
    });
  }
  function bulkDelete() {
    return runBulk({
      action: 'delete',
      label: 'Delete',
      eligible: selectedRows,
      fn: (r) => deleteLawFirm(r.id),
      destructive: true,
    });
  }

  // ----- Filter handlers ---------------------------------------------------

  function applySearch(e) {
    if (e) e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function changeStatus(e) {
    setPage(1);
    setStatus(e.target.value);
  }

  // ----- Create firm -------------------------------------------------------

  function openCreate() {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateError('');
    setCreateOpen(true);
  }

  function closeCreate() {
    if (createSubmitting) return;
    setCreateOpen(false);
    setCreateError('');
  }

  function onCreateChange(e) {
    const { name, value } = e.target;
    setCreateForm((f) => ({ ...f, [name]: value }));
  }

  async function submitCreate(e) {
    if (e) e.preventDefault();
    if (createSubmitting) return;
    setCreateError('');

    if (!createForm.firmName.trim()) {
      setCreateError('Firm name is required.');
      return;
    }

    setCreateSubmitting(true);
    try {
      await createLawFirm(buildFirmPayload(createForm));
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
      await load();
    } catch (err) {
      setCreateError(err.message || 'Failed to create firm.');
    } finally {
      setCreateSubmitting(false);
    }
  }

  // ----- View firm ---------------------------------------------------------

  async function openView(row) {
    setViewError('');
    setViewLoading(true);
    setViewFirm(row); // optimistic
    try {
      const full = await getLawFirm(row.id);
      if (full) setViewFirm(full);
    } catch (err) {
      setViewError(err.message || 'Failed to load firm details.');
    } finally {
      setViewLoading(false);
    }
  }

  function closeView() {
    setViewFirm(null);
    setViewError('');
  }

  // ----- Edit firm ---------------------------------------------------------

  function openEdit(row) {
    setEditError('');
    setEditTarget(row);
    setEditSelectedOwner(null);
    setEditForm({
      firmName: row.firmName || '',
      headquarters: row.headquarters || '',
      contactEmail: row.contactEmail || '',
      contactNumber: row.contactNumber || '',
      registrationNumber: row.registrationNumber || '',
      website: row.website || '',
      establishedYear:
        row.establishedYear != null ? String(row.establishedYear) : '',
      totalEmployees:
        row.totalEmployees != null ? String(row.totalEmployees) : '',
      status: row.status || 'ACTIVE',
      ownerUserId: row.ownerUserId || '',
      about: row.about || '',
      featured: !!row.featured,
    });
  }

  function closeEdit() {
    if (editSubmitting) return;
    setEditTarget(null);
    setEditForm(null);
    setEditSelectedOwner(null);
    setEditError('');
  }

  function onEditChange(e) {
    const { name, value } = e.target;
    setEditForm((f) => ({ ...f, [name]: value }));
  }

  async function submitEdit(e) {
    if (e) e.preventDefault();
    if (!editTarget || !editForm || editSubmitting) return;
    setEditError('');

    if (!editForm.firmName.trim()) {
      setEditError('Firm name is required.');
      return;
    }

    setEditSubmitting(true);
    try {
      const payload = buildFirmPayload(editForm);
      // Override the ownerUserId only when the admin picked a different
      // professional in the owner picker.
      if (
        editSelectedOwner &&
        editSelectedOwner.id &&
        editSelectedOwner.id !== editTarget.ownerUserId
      ) {
        payload.ownerUserId = editSelectedOwner.id;
      } else {
        delete payload.ownerUserId;
      }
      await updateLawFirm(editTarget.id, payload);
      setEditTarget(null);
      setEditForm(null);
      setEditSelectedOwner(null);
      await load();
    } catch (err) {
      setEditError(err.message || 'Failed to update firm.');
    } finally {
      setEditSubmitting(false);
    }
  }

  // ----- Delete firm -------------------------------------------------------

  function openDelete(row) {
    setDeleteError('');
    setDeleteTarget(row);
  }

  function closeDelete() {
    if (deleteSubmitting) return;
    setDeleteTarget(null);
    setDeleteError('');
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteSubmitting) return;
    setDeleteSubmitting(true);
    setDeleteError('');
    try {
      await deleteLawFirm(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete firm.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  // ----- Guards ------------------------------------------------------------

  if (authLoading || !isAuthenticated) {
    return <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Firms" />;
  }

  if (!isAdmin) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Firms">
        <EmptyState
          icon={<ShieldAlert size={24} />}
          title="Access denied"
          description="You need a platform administrator account to manage firms."
          action={
            <Button href="/dashboard" variant="outline">
              Back to dashboard
            </Button>
          }
        />
      </DashboardLayout>
    );
  }

  const totalPages = (meta && meta.totalPages) || 1;
  const total = (meta && meta.total) != null ? meta.total : rows.length;
  const currentPage = (meta && meta.page) || page;

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Firms"
      subtitle="Manage every firm on the platform"
    >
      <div className="space-y-6">
        {/* Filter bar */}
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <form
              onSubmit={applySearch}
              className="flex flex-1 items-end gap-2"
            >
              <Input
                label="Search"
                name="firm-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Firm name, headquarters or email…"
              />
              <Button type="submit" variant="outline">
                <Search size={15} />
                Search
              </Button>
            </form>
            <Select
              label="Status"
              name="firm-status"
              value={status}
              onChange={changeStatus}
              options={STATUS_OPTIONS}
              className="lg:w-64"
            />
          </div>
        </Card>

        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Building2 size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading
                ? 'Loading firms…'
                : `${total} firm${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw size={15} />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus size={15} />
              Add firm
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
            icon={<Building2 size={24} />}
            title="No firms found"
            description="No firms match your current filters. Try adjusting the search or filters."
          />
        ) : (
          <>
            {selectedCount > 0 && (
              <FirmBulkActionBar
                selectedCount={selectedCount}
                busy={bulkBusy}
                onClear={clearSelection}
                onFeature={bulkFeature}
                onUnfeature={bulkUnfeature}
                onActivate={() => bulkSetStatus('ACTIVE', 'Activate')}
                onPending={() => bulkSetStatus('PENDING_APPROVAL', 'Send to pending')}
                onReject={() => bulkSetStatus('REJECTED', 'Reject')}
                onDelete={bulkDelete}
              />
            )}
            {bulkResult && (
              <FirmBulkResultBanner
                result={bulkResult}
                onDismiss={() => setBulkResult(null)}
              />
            )}

            {/* Responsive table — horizontally scrollable on narrow screens. */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        checked={allOnPageSelected}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate =
                              selectedCount > 0 && !allOnPageSelected;
                          }
                        }}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Firm</th>
                    <th className="px-4 py-3 font-semibold">Owner</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Members</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const name = firmName(row);
                    const badge = statusBadge(row.status);
                    const checked = selectedIds.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50 ${
                          checked ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Select ${name}`}
                            checked={checked}
                            onChange={() => toggleRow(row.id)}
                            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={row.logo}
                              name={name}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">
                                {name}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {row.headquarters || '—'}
                              </p>
                              {row.featured && (
                                <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0 text-[10px] font-semibold text-amber-700">
                                  <Star size={9} />
                                  Featured
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {row.owner ? (
                            <div className="min-w-0">
                              <p className="truncate text-slate-700">
                                {row.owner.name || '—'}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {row.owner.email || '—'}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.memberCount != null ? row.memberCount : 0}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <FirmActionsMenu
                              onView={() => openView(row)}
                              onEdit={() => openEdit(row)}
                              onDelete={() => openDelete(row)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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
                  <ChevronLeft size={15} />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={loading || currentPage >= totalPages}
                >
                  Next
                  <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create firm modal */}
      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Add firm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeCreate}
              disabled={createSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={submitCreate}
              disabled={createSubmitting}
            >
              {createSubmitting ? 'Creating…' : 'Create firm'}
            </Button>
          </>
        }
      >
        <form onSubmit={submitCreate} className="space-y-3">
          <Input
            label="Firm name"
            name="firmName"
            value={createForm.firmName}
            onChange={onCreateChange}
            required
          />
          <Input
            label="Headquarters"
            name="headquarters"
            value={createForm.headquarters}
            onChange={onCreateChange}
            placeholder="Optional"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Contact email"
              name="contactEmail"
              type="email"
              value={createForm.contactEmail}
              onChange={onCreateChange}
              placeholder="Optional"
            />
            <Input
              label="Contact number"
              name="contactNumber"
              value={createForm.contactNumber}
              onChange={onCreateChange}
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Registration number"
              name="registrationNumber"
              value={createForm.registrationNumber}
              onChange={onCreateChange}
              placeholder="Optional"
            />
            <Input
              label="Website"
              name="website"
              value={createForm.website}
              onChange={onCreateChange}
              placeholder="https://"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Established year"
              name="establishedYear"
              type="number"
              value={createForm.establishedYear}
              onChange={onCreateChange}
              placeholder="e.g. 2010"
            />
            <Input
              label="Total employees"
              name="totalEmployees"
              type="number"
              value={createForm.totalEmployees}
              onChange={onCreateChange}
              placeholder="e.g. 25"
            />
          </div>
          <Select
            label="Status"
            name="status"
            value={createForm.status}
            onChange={onCreateChange}
            options={STATUS_FORM_OPTIONS}
            required
          />
          <Input
            label="Owner user ID"
            name="ownerUserId"
            value={createForm.ownerUserId}
            onChange={onCreateChange}
            placeholder="Optional"
            hint="Leave blank to create a firm without an owner"
          />
          <div>
            <label
              htmlFor="create-about"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              About
            </label>
            <textarea
              id="create-about"
              name="about"
              rows={4}
              value={createForm.about}
              onChange={onCreateChange}
              placeholder="Short description of the firm…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          {/* hidden submit so Enter inside inputs works */}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
        {createError && (
          <p className="mt-3 text-xs text-red-600">{createError}</p>
        )}
      </Modal>

      {/* View firm modal */}
      <Modal
        open={!!viewFirm}
        onClose={closeView}
        title={viewFirm ? firmName(viewFirm) : 'Firm details'}
        footer={
          <Button variant="outline" size="sm" onClick={closeView}>
            Close
          </Button>
        }
      >
        {viewFirm && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar
                src={viewFirm.logo}
                name={firmName(viewFirm)}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-800">
                  {firmName(viewFirm)}
                </p>
                <div className="mt-1">
                  {(() => {
                    const b = statusBadge(viewFirm.status);
                    return <Badge variant={b.variant}>{b.label}</Badge>;
                  })()}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Owner
                </dt>
                <dd className="mt-1 text-slate-700">
                  {viewFirm.owner ? (
                    <>
                      <p className="truncate">{viewFirm.owner.name || '—'}</p>
                      <p className="truncate text-xs text-slate-500">
                        {viewFirm.owner.email || '—'}
                      </p>
                    </>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Registration number
                </dt>
                <dd className="mt-1 text-slate-700">
                  {viewFirm.registrationNumber || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Headquarters
                </dt>
                <dd className="mt-1 text-slate-700">
                  {viewFirm.headquarters || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Website
                </dt>
                <dd className="mt-1 truncate text-slate-700">
                  {viewFirm.website ? (
                    <a
                      href={viewFirm.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-700 underline-offset-2 hover:underline"
                    >
                      {viewFirm.website}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Contact email
                </dt>
                <dd className="mt-1 truncate text-slate-700">
                  {viewFirm.contactEmail || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Contact number
                </dt>
                <dd className="mt-1 text-slate-700">
                  {viewFirm.contactNumber || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Established year
                </dt>
                <dd className="mt-1 text-slate-700">
                  {viewFirm.establishedYear || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Total employees
                </dt>
                <dd className="mt-1 text-slate-700">
                  {viewFirm.totalEmployees != null
                    ? viewFirm.totalEmployees
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Created
                </dt>
                <dd className="mt-1 text-slate-700">
                  {formatDate(viewFirm.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Updated
                </dt>
                <dd className="mt-1 text-slate-700">
                  {formatDate(viewFirm.updatedAt)}
                </dd>
              </div>
            </dl>

            {viewFirm.about && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  About
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                  {viewFirm.about}
                </p>
              </div>
            )}

            {Array.isArray(viewFirm.practiceAreas) &&
              viewFirm.practiceAreas.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Practice areas
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {viewFirm.practiceAreas.map((area, i) => (
                      <span
                        key={`${area}-${i}`}
                        className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Members
              </p>
              {Array.isArray(viewFirm.members) && viewFirm.members.length > 0 ? (
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {viewFirm.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {m.name || '—'}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {m.email || '—'}
                          {m.professionalType
                            ? ` • ${m.professionalType}`
                            : ''}
                        </p>
                      </div>
                      <Badge variant="gray">{m.role || '—'}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  {viewLoading ? 'Loading members…' : 'No members yet.'}
                </p>
              )}
            </div>

            {viewLoading && (
              <p className="text-xs text-slate-400">Loading latest details…</p>
            )}
            {viewError && (
              <p className="text-xs text-red-600">{viewError}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Edit firm modal */}
      <Modal
        open={!!editTarget}
        onClose={closeEdit}
        title={editTarget ? `Edit ${firmName(editTarget)}` : 'Edit firm'}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeEdit}
              disabled={editSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={submitEdit}
              disabled={editSubmitting}
            >
              {editSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      >
        {editForm && (
          <form onSubmit={submitEdit} className="space-y-3">
            <Input
              label="Firm name"
              name="firmName"
              value={editForm.firmName}
              onChange={onEditChange}
              required
            />
            <Input
              label="Headquarters"
              name="headquarters"
              value={editForm.headquarters}
              onChange={onEditChange}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Contact email"
                name="contactEmail"
                type="email"
                value={editForm.contactEmail}
                onChange={onEditChange}
              />
              <Input
                label="Contact number"
                name="contactNumber"
                value={editForm.contactNumber}
                onChange={onEditChange}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Registration number"
                name="registrationNumber"
                value={editForm.registrationNumber}
                onChange={onEditChange}
              />
              <Input
                label="Website"
                name="website"
                value={editForm.website}
                onChange={onEditChange}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Established year"
                name="establishedYear"
                type="number"
                value={editForm.establishedYear}
                onChange={onEditChange}
              />
              <Input
                label="Total employees"
                name="totalEmployees"
                type="number"
                value={editForm.totalEmployees}
                onChange={onEditChange}
              />
            </div>
            <Select
              label="Status"
              name="status"
              value={editForm.status}
              onChange={onEditChange}
              options={STATUS_FORM_OPTIONS}
            />
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={!!editForm.featured}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, featured: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm">
                <span className="font-medium text-slate-800">
                  Feature on home page
                </span>
                <span className="block text-xs text-slate-500">
                  Surfaces this firm in the public &ldquo;Find a Law or Tax
                  Firm&rdquo; directory section. Admin-curated; not a
                  ranking.
                </span>
              </span>
            </label>
            <OwnerPicker
              currentOwner={editTarget && editTarget.owner}
              selected={editSelectedOwner}
              onSelect={(u) => setEditSelectedOwner(u)}
              onClear={() => setEditSelectedOwner(null)}
            />
            <div>
              <label
                htmlFor="edit-about"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                About
              </label>
              <textarea
                id="edit-about"
                name="about"
                rows={4}
                value={editForm.about}
                onChange={onEditChange}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        )}
        {editError && (
          <p className="mt-3 text-xs text-red-600">{editError}</p>
        )}
      </Modal>

      {/* Delete firm confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={closeDelete}
        title="Delete firm"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeDelete}
              disabled={deleteSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDelete}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? 'Deleting…' : 'Delete firm'}
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <p className="text-sm text-slate-600">
            Permanently delete <strong>{firmName(deleteTarget)}</strong>?
            Members, invitations and join requests will also be removed. This
            cannot be undone.
          </p>
        )}
        {deleteError && (
          <p className="mt-3 text-xs text-red-600">{deleteError}</p>
        )}
      </Modal>
      {/* Destructive bulk confirm */}
      <Modal
        open={!!bulkConfirm}
        onClose={() => !bulkBusy && setBulkConfirm(null)}
        title={
          bulkConfirm
            ? `${bulkConfirm.label} ${bulkConfirm.count} firm${
                bulkConfirm.count === 1 ? '' : 's'
              }?`
            : ''
        }
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkConfirm(null)}
              disabled={bulkBusy}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (bulkConfirm) await bulkConfirm.run();
                setBulkConfirm(null);
              }}
              disabled={bulkBusy}
            >
              {bulkBusy ? 'Working…' : bulkConfirm ? bulkConfirm.label : ''}
            </Button>
          </>
        }
      >
        {bulkConfirm && (
          <p className="text-sm text-slate-700">
            This will run &ldquo;{bulkConfirm.label}&rdquo; on{' '}
            <strong>{bulkConfirm.count}</strong> selected firm
            {bulkConfirm.count === 1 ? '' : 's'}. This action cannot be
            undone.
          </p>
        )}
      </Modal>
    </DashboardLayout>
  );
}

// ----- Firm bulk action bar --------------------------------------------------

function FirmBulkActionBar({
  selectedCount,
  busy,
  onClear,
  onFeature,
  onUnfeature,
  onActivate,
  onPending,
  onReject,
  onDelete,
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
            {selectedCount}
          </span>
          <span>
            <strong>{selectedCount}</strong> firm
            {selectedCount === 1 ? '' : 's'} selected
          </span>
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="ml-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
          >
            <X size={12} />
            Clear
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onFeature} disabled={busy}>
            <Star size={14} />
            Mark featured
          </Button>
          <Button size="sm" variant="outline" onClick={onUnfeature} disabled={busy}>
            <StarOff size={14} />
            Remove featured
          </Button>
          <Button size="sm" variant="outline" onClick={onActivate} disabled={busy}>
            <CheckCircle2 size={14} />
            Activate
          </Button>
          <Button size="sm" variant="outline" onClick={onPending} disabled={busy}>
            <AlertTriangle size={14} />
            Send to pending
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} disabled={busy}>
            <AlertTriangle size={14} />
            Reject
          </Button>
          <Button size="sm" variant="danger" onClick={onDelete} disabled={busy}>
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

function FirmBulkResultBanner({ result, onDismiss }) {
  if (!result) return null;
  const success = result.fail === 0 && result.ok > 0;
  const skipped = result.skipped === 'none-eligible';
  const message = skipped
    ? `No firms were eligible for "${result.label || result.action}".`
    : success
      ? `${result.label || result.action}: ${result.ok} firm${
          result.ok === 1 ? '' : 's'
        } updated.`
      : `${result.label || result.action}: ${result.ok} succeeded, ${
          result.fail
        } failed.`;
  const tone = skipped
    ? 'amber'
    : success
      ? 'emerald'
      : result.ok > 0
        ? 'amber'
        : 'red';
  const palette = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-700',
  };
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${palette[tone]}`}
    >
      <span className="flex items-center gap-2">
        {tone === 'emerald' ? (
          <CheckCircle2 size={14} />
        ) : (
          <AlertTriangle size={14} />
        )}
        {message}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-current opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

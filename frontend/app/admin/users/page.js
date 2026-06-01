'use client';

// Admin — user management.
// Auth-guarded and admin-only (platform_admin). Lists every platform user
// with filters and pagination, and lets an admin create, view, edit,
// suspend / activate, or delete accounts.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Ban,
  CheckCircle2,
  Eye,
  MailCheck,
  Pencil,
  Trash2,
  UserPlus,
  MoreVertical,
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
import { formatDate, getInitials } from '@/utils/formatters';
import Avatar from '@/components/common/Avatar';
import RowMenu from '@/components/common/RowMenu';
import {
  listUsers,
  updateUserStatus,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  markUserEmailVerified,
} from '@/services/adminService';

const PAGE_SIZE = 20;

// Firms are not users — they are entities owned by professionals, so `firm`
// is intentionally absent from both filter and create/edit role selects.
const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'client', label: 'Client' },
  { value: 'professional', label: 'Professional' },
  { value: 'platform_admin', label: 'Platform admin' },
];

// Roles selectable when creating / editing a user (no "all" placeholder).
const ROLE_FORM_OPTIONS = [
  { value: 'client', label: 'Client' },
  { value: 'professional', label: 'Professional' },
  { value: 'platform_admin', label: 'Platform admin' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pending_verification', label: 'Pending verification' },
];

const ROLE_LABELS = {
  client: 'Client',
  professional: 'Professional',
  platform_admin: 'Platform admin',
};

/** Build a display name from a user row. */
function userName(u) {
  if (!u) return 'Unknown user';
  if (u.fullName) return u.fullName;
  const parts = [u.firstName, u.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : u.email || 'Unknown user';
}

/** Status → { label, variant } for the user status badge. */
function statusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return { label: 'Active', variant: 'green' };
  if (s === 'suspended') return { label: 'Suspended', variant: 'red' };
  if (s === 'pending_verification') {
    return { label: 'Pending verification', variant: 'amber' };
  }
  return { label: status || 'Unknown', variant: 'gray' };
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
  firstName: '',
  lastName: '',
  email: '',
  mobileNumber: '',
  role: 'client',
  password: '',
  confirmPassword: '',
};

/**
 * UserActionsMenu — single kebab dropdown holding View / Edit / Suspend /
 * Activate / Delete. Replaces the previous row of inline icon buttons so the
 * table stays compact at every width.
 */
function UserActionsMenu({
  row,
  isSelf,
  onView,
  onEdit,
  onSuspend,
  onDelete,
  onVerifyEmail,
}) {
  // Suspend / activate is available for every non-self account. A
  // `pending_verification` row can be promoted to active without going
  // through email verification — admin override.
  const canToggle = !isSelf;
  const isActive = row.status === 'active';
  const canVerifyEmail = !isSelf && !row.emailVerified;

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
      {canToggle && (
        <button
          type="button"
          role="menuitem"
          onClick={onSuspend}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
            isActive ? 'text-amber-700' : 'text-emerald-700'
          }`}
        >
          {isActive ? <Ban size={14} /> : <CheckCircle2 size={14} />}
          {isActive ? 'Suspend' : 'Activate'}
        </button>
      )}
      {canVerifyEmail && (
        <button
          type="button"
          role="menuitem"
          onClick={onVerifyEmail}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-teal-700 transition hover:bg-slate-50"
        >
          <MailCheck size={14} /> Mark email verified
        </button>
      )}
      {!isSelf && (
        <button
          type="button"
          role="menuitem"
          onClick={onDelete}
          className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
        >
          <Trash2 size={14} /> Delete
        </button>
      )}
    </RowMenu>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter state. `searchInput` is the live field; `search` is the applied one.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Confirm modal for suspend / activate.
  const [target, setTarget] = useState(null); // { user, nextStatus }
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  // Create modal state.
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // View modal state.
  const [viewUser, setViewUser] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');

  // Edit modal state.
  const [editTarget, setEditTarget] = useState(null); // user being edited
  const [editForm, setEditForm] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete modal state.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      const { data, meta: m } = await listUsers({
        page,
        limit: PAGE_SIZE,
        role: role || undefined,
        status: status || undefined,
        search: search || undefined,
      });
      setRows(Array.isArray(data) ? data : []);
      setMeta(m || null);
    } catch (err) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [page, role, status, search]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) {
      load();
    }
  }, [authLoading, isAuthenticated, isAdmin, load]);

  // ----- Filter handlers ---------------------------------------------------

  function applySearch(e) {
    if (e) e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function changeRole(e) {
    setPage(1);
    setRole(e.target.value);
  }

  function changeStatus(e) {
    setPage(1);
    setStatus(e.target.value);
  }

  // ----- Status action -----------------------------------------------------

  function openConfirm(row) {
    const nextStatus = row.status === 'active' ? 'suspended' : 'active';
    setActionError('');
    setTarget({ user: row, nextStatus });
  }

  async function confirmAction() {
    if (!target || submitting) return;
    setSubmitting(true);
    setActionError('');
    try {
      await updateUserStatus(target.user.id, target.nextStatus);
      setTarget(null);
      await load();
    } catch (err) {
      setActionError(err.message || 'Failed to update the user.');
    } finally {
      setSubmitting(false);
    }
  }

  // ----- Mark email verified (admin override) ----------------------------

  // Tracks the row currently being verified so we can disable repeated clicks
  // and surface a per-row error inline.
  const [verifyingId, setVerifyingId] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  async function verifyEmail(row) {
    if (verifyingId) return;
    setVerifyError('');
    setVerifyingId(row.id);
    try {
      await markUserEmailVerified(row.id);
      await load();
    } catch (err) {
      setVerifyError(
        `Could not mark ${row.email || 'user'} as verified: ${
          err.message || 'unknown error'
        }`
      );
    } finally {
      setVerifyingId(null);
    }
  }

  // ----- Create user -------------------------------------------------------

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

    const {
      firstName,
      lastName,
      email,
      mobileNumber,
      role: newRole,
      password,
      confirmPassword,
    } = createForm;

    if (!firstName.trim() || !lastName.trim()) {
      setCreateError('First name and last name are required.');
      return;
    }
    if (!email.trim()) {
      setCreateError('Email is required.');
      return;
    }
    if (!password || password.length < 6) {
      setCreateError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setCreateError('Passwords do not match.');
      return;
    }

    setCreateSubmitting(true);
    try {
      const payload = {
        email: email.trim(),
        password,
        role: newRole,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
      };
      if (mobileNumber.trim()) {
        payload.mobileNumber = mobileNumber.trim();
      }
      await createUser(payload);
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
      await load();
    } catch (err) {
      setCreateError(err.message || 'Failed to create user.');
    } finally {
      setCreateSubmitting(false);
    }
  }

  // ----- View user ---------------------------------------------------------

  async function openView(row) {
    setViewError('');
    setViewLoading(true);
    setViewUser(row); // optimistic: show what we have immediately
    try {
      const full = await getUser(row.id);
      if (full) setViewUser(full);
    } catch (err) {
      setViewError(err.message || 'Failed to load user details.');
    } finally {
      setViewLoading(false);
    }
  }

  function closeView() {
    setViewUser(null);
    setViewError('');
  }

  // ----- Edit user ---------------------------------------------------------

  function openEdit(row) {
    setEditError('');
    setEditTarget(row);
    setEditForm({
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      email: row.email || '',
      mobileNumber: row.mobileNumber || '',
      role: row.role || 'client',
      password: '',
    });
  }

  function closeEdit() {
    if (editSubmitting) return;
    setEditTarget(null);
    setEditForm(null);
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

    const changes = {};
    const trimmedFirst = editForm.firstName.trim();
    const trimmedLast = editForm.lastName.trim();
    const trimmedEmail = editForm.email.trim();
    const trimmedMobile = editForm.mobileNumber.trim();

    if (trimmedFirst !== (editTarget.firstName || '')) {
      changes.firstName = trimmedFirst;
    }
    if (trimmedLast !== (editTarget.lastName || '')) {
      changes.lastName = trimmedLast;
    }
    if (
      trimmedFirst !== (editTarget.firstName || '') ||
      trimmedLast !== (editTarget.lastName || '')
    ) {
      changes.fullName = `${trimmedFirst} ${trimmedLast}`.trim();
    }
    if (trimmedEmail !== (editTarget.email || '')) {
      changes.email = trimmedEmail;
    }
    if (trimmedMobile !== (editTarget.mobileNumber || '')) {
      changes.mobileNumber = trimmedMobile;
    }
    if (editForm.role !== editTarget.role) {
      changes.role = editForm.role;
    }
    if (editForm.password) {
      if (editForm.password.length < 6) {
        setEditError('Password must be at least 6 characters.');
        return;
      }
      changes.password = editForm.password;
    }

    if (Object.keys(changes).length === 0) {
      closeEdit();
      return;
    }

    setEditSubmitting(true);
    try {
      await updateUser(editTarget.id, changes);
      setEditTarget(null);
      setEditForm(null);
      await load();
    } catch (err) {
      setEditError(err.message || 'Failed to update user.');
    } finally {
      setEditSubmitting(false);
    }
  }

  // ----- Delete user -------------------------------------------------------

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
      await deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete user.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  // ----- Guards ------------------------------------------------------------

  if (authLoading || !isAuthenticated) {
    return <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Users" />;
  }

  if (!isAdmin) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Users">
        <EmptyState
          icon={<ShieldAlert size={24} />}
          title="Access denied"
          description="You need a platform administrator account to manage users."
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
      title="Users"
      subtitle="Browse, filter and manage every account on the platform"
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
                name="user-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, email or mobile…"
              />
              <Button type="submit" variant="outline">
                <Search size={15} />
                Search
              </Button>
            </form>
            <Select
              label="Role"
              name="user-role"
              value={role}
              onChange={changeRole}
              options={ROLE_OPTIONS}
              className="lg:w-52"
            />
            <Select
              label="Status"
              name="user-status"
              value={status}
              onChange={changeStatus}
              options={STATUS_OPTIONS}
              className="lg:w-56"
            />
          </div>
        </Card>

        {/* Inline status banner from the "Mark email verified" action. */}
        {verifyError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1">{verifyError}</span>
            <button
              type="button"
              onClick={() => setVerifyError('')}
              className="text-xs font-medium text-red-700 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Users size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading
                ? 'Loading users…'
                : `${total} user${total === 1 ? '' : 's'}`}
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
              <UserPlus size={15} />
              Add user
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
            title="No users found"
            description="No accounts match your current filters. Try adjusting the search or filters."
          />
        ) : (
          <>
            {/* Responsive table — horizontally scrollable on narrow screens. */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const name = userName(row);
                    const badge = statusBadge(row.status);
                    const isSelf = user && row.id === user.id;
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={row.profilePhoto}
                              name={name}
                              size="sm"
                            />
                            <p className="truncate font-medium text-slate-800">
                              {name}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.email || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="gray">
                              {ROLE_LABELS[row.role] || row.role || '—'}
                            </Badge>
                            {row.role === 'professional' &&
                              row.approvalStatus && (
                                <Badge
                                  variant={
                                    row.approvalStatus === 'APPROVED'
                                      ? 'green'
                                      : row.approvalStatus === 'REJECTED'
                                        ? 'red'
                                        : 'amber'
                                  }
                                >
                                  {row.approvalStatus === 'APPROVED'
                                    ? 'Approved'
                                    : row.approvalStatus === 'REJECTED'
                                      ? 'Rejected'
                                      : row.approvalStatus === 'INFO_REQUESTED'
                                        ? 'Info requested'
                                        : 'Pending approval'}
                                </Badge>
                              )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {isSelf && (
                              <span className="text-xs text-slate-400">
                                You
                              </span>
                            )}
                            <UserActionsMenu
                              row={row}
                              isSelf={isSelf}
                              onView={() => router.push(`/admin/users/${row.id}`)}
                              onEdit={() => openEdit(row)}
                              onSuspend={() => openConfirm(row)}
                              onDelete={() => openDelete(row)}
                              onVerifyEmail={() => verifyEmail(row)}
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

      {/* Suspend / activate confirm modal */}
      <Modal
        open={!!target}
        onClose={() => !submitting && setTarget(null)}
        title={
          target && target.nextStatus === 'suspended'
            ? 'Suspend user'
            : 'Activate user'
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTarget(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant={
                target && target.nextStatus === 'suspended'
                  ? 'danger'
                  : 'primary'
              }
              size="sm"
              onClick={confirmAction}
              disabled={submitting}
            >
              {submitting
                ? 'Working…'
                : target && target.nextStatus === 'suspended'
                ? 'Confirm suspend'
                : 'Confirm activate'}
            </Button>
          </>
        }
      >
        {target && (
          <p className="text-sm text-slate-600">
            {target.nextStatus === 'suspended' ? (
              <>
                Suspend <strong>{userName(target.user)}</strong>? They will
                lose access until reactivated.
              </>
            ) : (
              <>
                Activate <strong>{userName(target.user)}</strong>? They will
                regain access to the platform.
              </>
            )}
          </p>
        )}
        {actionError && (
          <p className="mt-3 text-xs text-red-600">{actionError}</p>
        )}
      </Modal>

      {/* Create user modal */}
      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Add user"
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
              {createSubmitting ? 'Creating…' : 'Create user'}
            </Button>
          </>
        }
      >
        <form onSubmit={submitCreate} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="First name"
              name="firstName"
              value={createForm.firstName}
              onChange={onCreateChange}
              required
            />
            <Input
              label="Last name"
              name="lastName"
              value={createForm.lastName}
              onChange={onCreateChange}
              required
            />
          </div>
          <Input
            label="Email"
            name="email"
            type="email"
            value={createForm.email}
            onChange={onCreateChange}
            required
          />
          <Input
            label="Mobile number"
            name="mobileNumber"
            value={createForm.mobileNumber}
            onChange={onCreateChange}
            placeholder="Optional"
          />
          <Select
            label="Role"
            name="role"
            value={createForm.role}
            onChange={onCreateChange}
            options={ROLE_FORM_OPTIONS}
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Password"
              name="password"
              type="password"
              value={createForm.password}
              onChange={onCreateChange}
              required
              hint="Minimum 6 characters"
            />
            <Input
              label="Confirm password"
              name="confirmPassword"
              type="password"
              value={createForm.confirmPassword}
              onChange={onCreateChange}
              required
            />
          </div>
          {/* hidden submit so Enter inside inputs works */}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
        {createError && (
          <p className="mt-3 text-xs text-red-600">{createError}</p>
        )}
      </Modal>

      {/* View user modal */}
      <Modal
        open={!!viewUser}
        onClose={closeView}
        title={viewUser ? userName(viewUser) : 'User details'}
        footer={
          <Button variant="outline" size="sm" onClick={closeView}>
            Close
          </Button>
        }
      >
        {viewUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar
                src={viewUser.profilePhoto}
                name={userName(viewUser)}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">
                  {userName(viewUser)}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {viewUser.email || '—'}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Role
                </dt>
                <dd className="mt-1">
                  <Badge variant="gray">
                    {ROLE_LABELS[viewUser.role] || viewUser.role || '—'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </dt>
                <dd className="mt-1">
                  {(() => {
                    const b = statusBadge(viewUser.status);
                    return <Badge variant={b.variant}>{b.label}</Badge>;
                  })()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Email
                </dt>
                <dd className="mt-1 text-slate-700">
                  {viewUser.email || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Mobile number
                </dt>
                <dd className="mt-1 text-slate-700">
                  {viewUser.mobileNumber || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Account verified
                </dt>
                <dd className="mt-1 text-slate-700">
                  {viewUser.accountVerified ? 'Yes' : 'No'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Email verified
                </dt>
                <dd className="mt-1 text-slate-700">
                  {viewUser.emailVerified ? 'Yes' : 'No'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Member since
                </dt>
                <dd className="mt-1 text-slate-700">
                  {formatDate(viewUser.memberSince || viewUser.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Last login
                </dt>
                <dd className="mt-1 text-slate-700">
                  {viewUser.lastLogin ? formatDate(viewUser.lastLogin) : '—'}
                </dd>
              </div>
            </dl>

            {viewLoading && (
              <p className="text-xs text-slate-400">Loading latest details…</p>
            )}
            {viewError && (
              <p className="text-xs text-red-600">{viewError}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Edit user modal */}
      <Modal
        open={!!editTarget}
        onClose={closeEdit}
        title={editTarget ? `Edit ${userName(editTarget)}` : 'Edit user'}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="First name"
                name="firstName"
                value={editForm.firstName}
                onChange={onEditChange}
              />
              <Input
                label="Last name"
                name="lastName"
                value={editForm.lastName}
                onChange={onEditChange}
              />
            </div>
            <Input
              label="Email"
              name="email"
              type="email"
              value={editForm.email}
              onChange={onEditChange}
            />
            <Input
              label="Mobile number"
              name="mobileNumber"
              value={editForm.mobileNumber}
              onChange={onEditChange}
            />
            <Select
              label="Role"
              name="role"
              value={editForm.role}
              onChange={onEditChange}
              options={ROLE_FORM_OPTIONS}
            />
            <Input
              label="Password"
              name="password"
              type="password"
              value={editForm.password}
              onChange={onEditChange}
              hint="Leave blank to keep current"
            />
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        )}
        {editError && (
          <p className="mt-3 text-xs text-red-600">{editError}</p>
        )}
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={closeDelete}
        title="Delete user"
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
              {deleteSubmitting ? 'Deleting…' : 'Delete user'}
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <p className="text-sm text-slate-600">
            Permanently delete <strong>{userName(deleteTarget)}</strong>? This
            cannot be undone.
          </p>
        )}
        {deleteError && (
          <p className="mt-3 text-xs text-red-600">{deleteError}</p>
        )}
      </Modal>
    </DashboardLayout>
  );
}

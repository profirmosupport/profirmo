'use client';

// LookupTableAdminPage — shared admin UI for any simple value/description
// lookup table (case statuses, case types, cause-list types, …).
//
// Each consumer passes:
//   title          : page title shown in the DashboardLayout header
//   subtitle       : explanatory subline
//   itemLabel      : singular noun ("case status", "case type", …)
//   service        : { list, create, update, remove }  — async functions
//                    bound to whichever backend resource this page edits
//   normalizeValue : (raw) => normalised string for the value column
//                    (lets each lookup keep its own casing rules, e.g.
//                    case statuses uppercase, case types preserve case)
//   valuePlaceholder, descriptionPlaceholder — input hints

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ListTree,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  Save,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Input from '@/components/common/Input';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/AuthProvider';
import { ROLES } from '@/utils/constants';

const EMPTY_FORM = { value: '', description: '', sortOrder: 0, active: true };

export default function LookupTableAdminPage({
  title,
  subtitle,
  itemLabel,
  service,
  normalizeValue = (v) => String(v || '').trim(),
  valuePlaceholder = 'e.g. UNKNOWN',
  descriptionPlaceholder = 'Human-readable label shown in dropdowns',
}) {
  const { user, loading: authLoading } = useAuth();
  const isAdmin =
    user &&
    (user.role === ROLES.PLATFORM_ADMIN || user.role === 'platform_admin');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await service.list();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || `Failed to load ${itemLabel}.`);
    } finally {
      setLoading(false);
    }
  }, [service, itemLabel]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) return;
    load();
  }, [authLoading, isAdmin, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.value || '').toLowerCase().includes(q) ||
        String(r.description || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sortOrder: (rows.length + 1) * 10 });
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      value: row.value || '',
      description: row.description || '',
      sortOrder: Number(row.sortOrder) || 0,
      active: row.active !== false,
    });
    setFormError('');
    setModalOpen(true);
  }

  async function save() {
    if (saving) return;
    setFormError('');
    const value = normalizeValue(form.value);
    const description = String(form.description || '').trim();
    if (!value) {
      setFormError('Value is required.');
      return;
    }
    if (!description) {
      setFormError('Description is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        value,
        description,
        sortOrder: Number.isFinite(Number(form.sortOrder))
          ? Number(form.sortOrder)
          : 0,
        active: !!form.active,
      };
      if (editing) {
        await service.update(editing.id, payload);
      } else {
        await service.create(payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await service.remove(deleting.id);
      setDeleting(null);
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeleteBusy(false);
    }
  }

  async function toggleActive(row) {
    try {
      await service.update(row.id, { active: !row.active });
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, active: !r.active } : r))
      );
    } catch (err) {
      setError(err.message || 'Toggle failed.');
    }
  }

  if (authLoading) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title={title}>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      </DashboardLayout>
    );
  }
  if (!isAdmin) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title={title}>
        <EmptyState
          icon={<ShieldAlert size={24} />}
          title="Admin access only"
          description={`Sign in with a platform-admin account to manage ${itemLabel}.`}
        />
      </DashboardLayout>
    );
  }

  const previewValue = normalizeValue(form.value) || '—';

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title={title}
      subtitle={subtitle}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <ListTree size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {rows.length} {itemLabel}
              {rows.length === 1 ? '' : 's'}
              {search ? (
                <span className="ml-1 text-slate-400">
                  · {filtered.length} matching
                </span>
              ) : null}
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
            <Button variant="primary" size="sm" onClick={openAdd}>
              <Plus size={15} />
              Add {itemLabel}
            </Button>
          </div>
        </div>

        <Card>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by value or description…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
            />
          </div>
        </Card>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ListTree size={24} />}
            title={search ? 'No matches' : `No ${itemLabel} yet`}
            description={
              search
                ? 'Try a different search term, or add a new entry.'
                : `Click "Add ${itemLabel}" to create your first one.`
            }
          />
        ) : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Value</th>
                    <th className="px-4 py-2.5">Description</th>
                    <th className="px-4 py-2.5">Sort</th>
                    <th className="px-4 py-2.5">Active</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-2.5 font-mono text-[12px] font-semibold text-slate-800">
                        {row.value}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {row.description}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {row.sortOrder}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleActive(row)}
                          className="inline-flex items-center gap-1.5"
                          title={
                            row.active
                              ? 'Active — click to hide from dropdowns'
                              : 'Hidden — click to make active'
                          }
                        >
                          {row.active ? (
                            <Badge variant="green">
                              <CheckCircle2 size={11} />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="gray">
                              <XCircle size={11} />
                              Hidden
                            </Badge>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-amber-300 hover:text-amber-700"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(row)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-300 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 size={13} />
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
      </div>

      <Modal
        open={modalOpen}
        onClose={() => (saving ? null : setModalOpen(false))}
        title={editing ? `Edit ${editing.value}` : `Add ${itemLabel}`}
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              disabled={saving}
            >
              {saving ? (
                'Saving…'
              ) : (
                <>
                  <Save size={14} />
                  Save
                </>
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Value <span className="text-red-500">*</span>
            </label>
            <Input
              name="value"
              value={form.value}
              onChange={(e) =>
                setForm((f) => ({ ...f, value: e.target.value }))
              }
              placeholder={valuePlaceholder}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Stored as{' '}
              <span className="font-mono text-slate-700">{previewValue}</span>
              .
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Description <span className="text-red-500">*</span>
            </label>
            <Input
              name="description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder={descriptionPlaceholder}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Sort order
              </label>
              <Input
                name="sortOrder"
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortOrder: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Active
              </label>
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
                <input
                  type="checkbox"
                  checked={!!form.active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, active: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm text-slate-700">
                  {form.active
                    ? 'Visible in dropdowns'
                    : 'Hidden from dropdowns'}
                </span>
              </label>
            </div>
          </div>

          {formError ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => (deleteBusy ? null : setDeleting(null))}
        title={`Delete ${itemLabel}`}
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleting(null)}
              disabled={deleteBusy}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDelete}
              disabled={deleteBusy}
            >
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Remove{' '}
          <span className="font-mono font-semibold text-slate-900">
            {deleting ? deleting.value : ''}
          </span>{' '}
          from the list? Existing rows tagged with this value keep it as
          plain text, but it will no longer appear in dropdowns. This
          cannot be undone.
        </p>
      </Modal>
    </DashboardLayout>
  );
}

'use client';

// /admin/employees — listing of every Employee row with totals.
// Filter by status + free-text search across name / email / phone /
// employee code. Tap a row to view the detail page.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Search,
  RefreshCw,
  AlertCircle,
  UserPlus,
  Ban,
  PlayCircle,
  Trash2,
  X,
  Save,
  CheckCircle2,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import { ROLES } from '@/utils/constants';
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from '@/services/adminEmployeeService';

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function rupees(n) {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN')}`;
}

const STATUS_TONE = {
  active: 'green',
  inactive: 'amber',
  blocked: 'red',
};

export default function AdminEmployeesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  // Inline action UI state.
  const [createOpen, setCreateOpen] = useState(false);
  const [actionBusyId, setActionBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listEmployees({ q, status });
      setRows(data);
    } catch (err) {
      setError(err.message || 'Failed to load employees.');
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleStatus(emp) {
    if (actionBusyId) return;
    setActionBusyId(emp.id);
    setActionError('');
    setActionNotice('');
    try {
      const next = emp.status === 'blocked' ? 'active' : 'blocked';
      await updateEmployee(emp.id, { status: next });
      setActionNotice(
        next === 'blocked'
          ? `Suspended ${emp.name}.`
          : `Reactivated ${emp.name}.`
      );
      await load();
    } catch (err) {
      setActionError(err.message || 'Could not update employee.');
    } finally {
      setActionBusyId('');
    }
  }

  async function confirmRemoval() {
    if (!confirmDelete || actionBusyId) return;
    setActionBusyId(confirmDelete.id);
    setActionError('');
    setActionNotice('');
    try {
      await deleteEmployee(confirmDelete.id);
      setActionNotice(`Deleted ${confirmDelete.name}.`);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setActionError(err.message || 'Could not delete employee.');
      setConfirmDelete(null);
    } finally {
      setActionBusyId('');
    }
  }

  const totals = useMemo(() => {
    const t = {
      employees: rows.length,
      onboarded: 0,
      approved: 0,
      pending: 0,
      earned: 0,
      paid: 0,
      due: 0,
    };
    for (const r of rows) {
      t.onboarded += r.professionals?.total || 0;
      t.approved += r.professionals?.approved || 0;
      t.pending += r.professionals?.pending || 0;
      t.earned += Number(r.earnedAmount) || 0;
      t.paid += Number(r.paidAmount) || 0;
      t.due += Number(r.availablePayoutAmount) || 0;
    }
    return t;
  }, [rows]);

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Employees"
      subtitle="Field agents onboarding professionals via /join-team."
    >
      <div className="space-y-6">
        {/* Top-line totals */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Employees" value={totals.employees} />
          <Stat label="Onboarded" value={totals.onboarded} />
          <Stat label="Approved" value={totals.approved} />
          <Stat label="Pending" value={totals.pending} />
          <Stat label="Earned" value={rupees(totals.earned)} />
          <Stat label="Payable" value={rupees(totals.due)} emphasised />
        </div>

        {/* Toolbar */}
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, email, phone, or code…"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
            </select>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-amber-300 hover:text-amber-700"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-amber-700"
            >
              <UserPlus size={14} />
              Add employee
            </button>
          </div>
        </Card>

        {actionNotice ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 size={14} />
            {actionNotice}
          </div>
        ) : null}
        {actionError ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {actionError}
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading employees…
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-8 text-center text-slate-500">
              <UserPlus className="h-8 w-8" />
              <p className="text-sm font-medium">
                No employees yet. New signups via /join-team will show up here.
              </p>
            </div>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Onboarded</th>
                  <th className="px-4 py-3 font-semibold">Earned</th>
                  <th className="px-4 py-3 font-semibold">Available</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/employees/${r.id}`}
                        className="font-medium text-slate-800 hover:text-amber-700"
                      >
                        {r.name}
                      </Link>
                      {!r.otpVerified ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          OTP pending
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {r.employeeCode}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{r.email}</p>
                      <p className="text-xs text-slate-400">{r.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{r.professionals?.total ?? 0} total</div>
                      <div className="mt-0.5 flex flex-wrap gap-1 text-[10px]">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                          {r.professionals?.pending ?? 0} pending
                        </span>
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                          {r.professionals?.approved ?? 0} approved
                        </span>
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">
                          {r.professionals?.rejected ?? 0} rejected
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {rupees(r.earnedAmount)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-amber-700">
                      {rupees(r.availablePayoutAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_TONE[r.status] || 'gray'}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/employees/${r.id}`}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-amber-300 hover:text-amber-700"
                          title="Edit details"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          disabled={actionBusyId === r.id}
                          onClick={() => toggleStatus(r)}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition disabled:opacity-60 ${
                            r.status === 'blocked'
                              ? 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                              : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
                          }`}
                          title={
                            r.status === 'blocked'
                              ? 'Reactivate employee'
                              : 'Suspend employee'
                          }
                        >
                          {r.status === 'blocked' ? (
                            <>
                              <PlayCircle size={12} />
                              Activate
                            </>
                          ) : (
                            <>
                              <Ban size={12} />
                              Suspend
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={actionBusyId === r.id}
                          onClick={() =>
                            setConfirmDelete({ id: r.id, name: r.name })
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                          title="Delete employee"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateEmployeeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setActionNotice('Employee created.');
          load();
        }}
      />

      <ConfirmDeleteOverlay
        target={confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={confirmRemoval}
        busy={Boolean(actionBusyId)}
      />
    </DashboardLayout>
  );
}

function CreateEmployeeModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', phone: '', password: '' });
      setError('');
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await createEmployee(form);
      onCreated?.();
    } catch (err) {
      setError(err.message || 'Could not create employee.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Add employee</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Skips the OTP flow. The phone number doubles as the employee
          code. Share the password with the employee — they can change
          it after first login.
        </p>

        <div className="mt-4 space-y-3">
          <Field
            label="Full name"
            value={form.name}
            onChange={(v) => setForm((p) => ({ ...p, name: v }))}
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm((p) => ({ ...p, email: v }))}
          />
          <Field
            label="Phone (becomes employee code)"
            value={form.phone}
            onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
          />
          <Field
            label="Password (min 8 characters)"
            type="text"
            value={form.password}
            onChange={(v) => setForm((p) => ({ ...p, password: v }))}
            placeholder="Leave blank to require OTP login"
          />
        </div>

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-amber-700 disabled:bg-slate-300"
          >
            {busy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Create employee
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
      />
    </label>
  );
}

function ConfirmDeleteOverlay({ target, onCancel, onConfirm, busy }) {
  if (!target) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900">
          Delete {target.name}?
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          This permanently removes the employee record. Allowed only when
          the employee has no commission, payout, or onboarding history —
          otherwise set their status to <strong>blocked</strong> instead.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-rose-700 disabled:bg-slate-300"
          >
            {busy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            Delete employee
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, emphasised }) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 ${
        emphasised
          ? 'border-amber-300 ring-1 ring-amber-200'
          : 'border-slate-200'
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

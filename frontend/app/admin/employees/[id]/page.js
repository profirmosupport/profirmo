'use client';

// /admin/employees/[id] — single employee view.
// Top card with details + balance, status select + name/email edit,
// and the full list of professionals this employee has onboarded.

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Save,
  CheckCircle2,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import { ROLES } from '@/utils/constants';
import {
  getEmployee,
  getEmployeeProfessionals,
  updateEmployee,
} from '@/services/adminEmployeeService';

function rupees(n) {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN')}`;
}

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

const STATUS_VARIANT = {
  PENDING_APPROVAL: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
};

export default function AdminEmployeeDetailPage({ params }) {
  const { id } = use(params);
  const [emp, setEmp] = useState(null);
  const [pros, setPros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [e, p] = await Promise.all([
        getEmployee(id),
        getEmployeeProfessionals(id),
      ]);
      setEmp(e);
      setPros(p);
      setDraft({
        name: e.name || '',
        email: e.email || '',
        phone: e.phone || '',
        status: e.status || 'active',
      });
    } catch (err) {
      setError(err.message || 'Failed to load employee.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const next = await updateEmployee(id, draft);
      setEmp((p) => ({ ...(p || {}), ...next }));
      setNotice('Employee updated.');
    } catch (err) {
      setError(err.message || 'Could not update employee.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title={emp ? emp.name : 'Employee'}
      subtitle={emp ? `Code ${emp.employeeCode}` : 'Loading…'}
    >
      <Link
        href="/admin/employees"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={14} />
        Back to employees
      </Link>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : !emp ? null : (
        <div className="mt-6 space-y-6">
          {/* Identity + balance */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Employee
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {emp.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Code{' '}
                  <span className="font-mono font-semibold text-slate-800">
                    {emp.employeeCode}
                  </span>{' '}
                  · Joined {fmtDate(emp.createdAt)} · Last login{' '}
                  {fmtDate(emp.lastLoginAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge
                    variant={
                      emp.status === 'active'
                        ? 'green'
                        : emp.status === 'blocked'
                          ? 'red'
                          : 'amber'
                    }
                  >
                    {emp.status}
                  </Badge>
                  {emp.otpVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      <CheckCircle2 size={10} /> OTP verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      OTP pending
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Mini label="Earned" value={rupees(emp.balance?.earned)} />
                <Mini label="Paid" value={rupees(emp.balance?.paid)} />
                <Mini label="Pending" value={rupees(emp.balance?.pending)} />
                <Mini
                  label="Available"
                  value={rupees(emp.balance?.available)}
                  emphasised
                />
              </div>
            </div>
          </Card>

          {/* Edit form */}
          <Card>
            <h3 className="text-base font-semibold text-slate-900">
              Edit employee
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  value={draft.name || ''}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </Field>
              <Field label="Email">
                <input
                  value={draft.email || ''}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </Field>
              <Field label="Phone">
                <input
                  value={draft.phone || ''}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, phone: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </Field>
              <Field label="Status">
                <select
                  value={draft.status || 'active'}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, status: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
              </Field>
            </div>
            {notice ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 size={14} />
                {notice}
              </div>
            ) : null}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 disabled:bg-slate-300"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Save changes
              </button>
            </div>
          </Card>

          {/* Onboarded professionals */}
          <Card>
            <h3 className="text-base font-semibold text-slate-900">
              Onboarded professionals ({pros.length})
            </h3>
            {pros.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                This employee hasn&apos;t onboarded any professionals yet.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Submitted</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pros.map((p) => (
                      <tr key={p.userId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {p.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.email || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.professionalType || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {fmtDate(p.submittedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={STATUS_VARIANT[p.approvalStatus] || 'gray'}
                          >
                            {p.approvalStatus.replaceAll('_', ' ')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Mini({ label, value, emphasised }) {
  return (
    <div
      className={`rounded-lg border bg-white p-3 ${
        emphasised ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-base font-bold text-slate-900">{value}</p>
    </div>
  );
}

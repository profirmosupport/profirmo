'use client';

// /dashboard/professional/compliance — upcoming tax / legal compliance
// obligations across every client this pro manages. Surface aims:
//
//   1. Fast scan: rows grouped by due date, overdue items highlighted.
//   2. Quick action: mark done / not_applicable inline.
//   3. Entry point to per-client profile setup (the rule generator
//      needs an entity-type + GSTIN to produce useful rows).

import { useCallback, useEffect, useState } from 'react';
import {
  Receipt,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import {
  listObligations,
  updateObligation,
} from '@/services/complianceService';
import { ROLES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';

const STATUS_VARIANT = {
  pending: 'amber',
  done: 'green',
  missed: 'red',
  not_applicable: 'gray',
};

const STATUS_LABEL = {
  pending: 'Pending',
  done: 'Done',
  missed: 'Missed',
  not_applicable: 'N/A',
};

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CompliancePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('pending');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listObligations({
        status: filter === 'all' ? undefined : filter,
      });
      setItems(rows);
    } catch (err) {
      setError(err.message || 'Could not load compliance obligations.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(item, status) {
    setBusyId(item.id);
    try {
      await updateObligation(item.id, { status });
      await load();
    } catch (err) {
      setError(err.message || 'Could not update obligation.');
    } finally {
      setBusyId(null);
    }
  }

  const today = todayIso();
  const overdue = items.filter(
    (i) => i.status === 'pending' && i.dueDate < today
  ).length;
  const dueThisWeek = items.filter((i) => {
    if (i.status !== 'pending') return false;
    const week = new Date();
    week.setDate(week.getDate() + 7);
    const wk = week.toISOString().slice(0, 10);
    return i.dueDate >= today && i.dueDate <= wk;
  }).length;

  return (
    <DashboardLayout
      role={ROLES.PROFESSIONAL}
      title="Compliance"
      subtitle="Upcoming filings + statutory deadlines across your clients"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Overdue
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-600">
              {overdue}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Due in next 7 days
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">
              {dueThisWeek}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Total visible
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-800">
              {items.length}
            </p>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
            {[
              { k: 'pending', l: 'Pending' },
              { k: 'done', l: 'Done' },
              { k: 'missed', l: 'Missed' },
              { k: 'all', l: 'All' },
            ].map((opt) => (
              <button
                key={opt.k}
                type="button"
                onClick={() => setFilter(opt.k)}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  filter === opt.k
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading obligations…</p>
        ) : items.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Receipt size={28} className="text-slate-300" />
              <p className="text-sm font-medium text-slate-700">
                No obligations to show.
              </p>
              <p className="max-w-md text-xs text-slate-500">
                Open a client's profile, set their entity type + GSTIN, then
                click <span className="font-semibold">Generate schedule</span>{' '}
                to auto-create their upcoming filings. (UI for that is in v2 —
                today the generator is invoked via the backend service.)
              </p>
            </div>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Due</th>
                  <th className="px-4 py-3 font-semibold">Filing</th>
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it) => {
                  const isOverdue =
                    it.status === 'pending' && it.dueDate < today;
                  return (
                    <tr key={it.id} className="hover:bg-slate-50">
                      <td
                        className={`px-4 py-3 ${
                          isOverdue
                            ? 'font-semibold text-red-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {formatDate(it.dueDate)}
                        {isOverdue && (
                          <span className="ml-1 text-[10px] uppercase tracking-wide">
                            overdue
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {it.ruleKey.toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {it.periodLabel}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {it.clientUserId}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[it.status] || 'gray'}>
                          {STATUS_LABEL[it.status] || it.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {it.status !== 'done' && (
                            <button
                              type="button"
                              onClick={() => setStatus(it, 'done')}
                              disabled={busyId === it.id}
                              title="Mark done"
                              className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          {it.status !== 'not_applicable' && (
                            <button
                              type="button"
                              onClick={() => setStatus(it, 'not_applicable')}
                              disabled={busyId === it.id}
                              title="Mark not applicable"
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

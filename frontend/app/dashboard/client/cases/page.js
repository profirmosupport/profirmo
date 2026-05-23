'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, RefreshCw, AlertTriangle, Eye } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import caseService from '@/services/caseService';
import { ROLES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';

const PRIORITY_VARIANT = {
  low: 'gray',
  medium: 'gray',
  high: 'amber',
  urgent: 'red',
};

const STATUS_VARIANT = {
  open: 'blue',
  'in-progress': 'amber',
  closed: 'green',
};

function CardSkeleton() {
  return (
    <div className="h-16 w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
  );
}

export default function ClientCasesPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await caseService.getMyClientCases();
      setCases(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load your cases.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout
      role={ROLES.CLIENT}
      title="My cases"
      subtitle="Cases filed for you by your professionals or law firms"
    >
      <div className="space-y-6">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Briefcase size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading
                ? 'Loading cases…'
                : `${cases.length} case${cases.length === 1 ? '' : 's'}`}
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
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
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
        ) : cases.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={24} />}
            title="No cases yet"
            description="Cases filed for you by a professional or firm will appear here."
            action={
              <Button href="/professionals" variant="primary">
                Find a professional
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Professional</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Next hearing</th>
                  <th className="px-4 py-3 font-semibold">Filed</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {c.title || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.category || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.professionalId ? (
                        <Link
                          href={`/professionals/${c.professionalId}`}
                          className="font-medium text-amber-700 hover:text-amber-800"
                        >
                          {c.professionalId}
                        </Link>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={PRIORITY_VARIANT[c.priority] || 'gray'}>
                        {c.priority || 'medium'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[c.status] || 'gray'}>
                        {c.status || 'open'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.nextHearingDate ? formatDate(c.nextHearingDate) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        href={`/dashboard/client/cases/${c.id}`}
                      >
                        <Eye size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

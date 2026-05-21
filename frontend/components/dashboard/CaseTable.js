'use client';

import { Briefcase } from 'lucide-react';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import { formatDate } from '@/utils/formatters';
import { STATUS_LABELS, STATUS_VARIANTS } from '@/utils/constants';

/**
 * CaseTable — table of cases with status badges.
 * Props: { cases }
 */
export default function CaseTable({ cases }) {
  const list = cases || [];

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase size={24} />}
        title="No cases yet"
        description="Cases shared between clients and professionals will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{c.title}</p>
                  {c.description && (
                    <p className="mt-0.5 max-w-md truncate text-xs text-slate-500">
                      {c.description}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.category || '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANTS[c.status] || 'gray'}>
                    {STATUS_LABELS[c.status] || c.status || 'Unknown'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(c.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

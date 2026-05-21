'use client';

import { Video } from 'lucide-react';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import {
  formatDateTime,
  formatDuration,
  formatCurrency,
} from '@/utils/formatters';
import { STATUS_LABELS, STATUS_VARIANTS } from '@/utils/constants';

/**
 * ConsultationTable — table of consultations.
 * Props: { consultations, emptyTitle, emptyDescription }
 */
export default function ConsultationTable({
  consultations,
  emptyTitle = 'No consultations yet',
  emptyDescription = 'Consultation history will appear here once calls are completed.',
}) {
  const list = consultations || [];

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<Video size={24} />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Consultation</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{c.id}</p>
                  {c.bookingId && (
                    <p className="text-xs text-slate-500">
                      Booking {c.bookingId}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.startedAt ? formatDateTime(c.startedAt) : 'Not started'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDuration(c.durationMinutes)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANTS[c.callStatus] || 'gray'}>
                    {STATUS_LABELS[c.callStatus] || c.callStatus || 'Unknown'}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {formatCurrency(c.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

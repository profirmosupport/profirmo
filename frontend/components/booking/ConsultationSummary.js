import { CalendarDays, Clock, Tag, Wallet } from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import { BOOKING_TYPES } from '@/utils/constants';
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatRate,
  formatTime,
  getInitials,
} from '@/utils/formatters';

/**
 * ConsultationSummary — booking summary card.
 *
 * Props: { professional, type, date, time, duration }
 */
export default function ConsultationSummary({
  professional,
  type,
  date,
  time,
  duration,
}) {
  const rate = professional ? Number(professional.perMinuteRate) || 0 : 0;
  const mins = Number(duration) || 0;
  const estimatedCost = mins * rate;
  const isInstant = type === BOOKING_TYPES.INSTANT;

  const whenLabel = isInstant
    ? 'Now'
    : date
    ? `${formatDate(date)}${time ? `, ${formatTime(time)}` : ''}`
    : 'Date not selected';

  const rows = [
    {
      icon: <Tag size={16} className="text-slate-400" />,
      label: 'Type',
      value: (
        <Badge variant={isInstant ? 'green' : 'blue'}>
          {isInstant ? 'Instant' : 'Scheduled'}
        </Badge>
      ),
    },
    {
      icon: <CalendarDays size={16} className="text-slate-400" />,
      label: 'When',
      value: <span className="text-slate-800">{whenLabel}</span>,
    },
    {
      icon: <Clock size={16} className="text-slate-400" />,
      label: 'Duration',
      value: <span className="text-slate-800">{formatDuration(mins)}</span>,
    },
    {
      icon: <Wallet size={16} className="text-slate-400" />,
      label: 'Rate',
      value: <span className="text-slate-800">{formatRate(rate)}</span>,
    },
  ];

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-800">
        Consultation summary
      </h3>

      <div className="mt-4 flex items-center gap-3 border-b border-slate-100 pb-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
          {getInitials(professional ? professional.name : '')}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {professional ? professional.name : 'Professional'}
          </p>
          <p className="truncate text-xs text-slate-500">
            {professional ? professional.professionType : '—'}
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <dt className="flex items-center gap-2 text-slate-500">
              {row.icon}
              {row.label}
            </dt>
            <dd className="text-right font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-sm font-medium text-slate-600">
          Estimated cost
        </span>
        <span className="text-lg font-bold text-slate-900">
          {formatCurrency(estimatedCost)}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Final cost is billed per minute for the actual call duration.
      </p>
    </Card>
  );
}

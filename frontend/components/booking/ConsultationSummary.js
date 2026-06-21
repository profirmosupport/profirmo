'use client';

import { CalendarDays, Clock, Tag, Wallet } from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Avatar from '@/components/common/Avatar';
import { useLanguage } from '@/components/LanguageProvider';
import { BOOKING_TYPES, INSTANT_BOOKING_MULTIPLIER } from '@/utils/constants';
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatRate,
} from '@/utils/formatters';
import { formatSlotLabel } from '@/utils/availability';

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
  const { t } = useLanguage();
  const baseRate = professional
    ? Number(professional.consultationFee ?? professional.perMinuteRate) || 0
    : 0;
  const mins = Number(duration) || 0;
  const isInstant = type === BOOKING_TYPES.INSTANT;
  // Apply the instant-booking multiplier — clients see the 2x rate the
  // moment they toggle Instant, before they even click confirm. Same
  // formula as app/booking/[professionalId]/page.js so the surfaced cost
  // matches what's charged.
  const rate = isInstant ? baseRate * INSTANT_BOOKING_MULTIPLIER : baseRate;
  const estimatedCost = mins * rate;

  // `time` may be a plain "HH:MM" (legacy) or a range "HH:MM-HH:MM"
  // (current). formatSlotLabel handles both so the "When" row never falls
  // back to "—".
  const whenLabel = isInstant
    ? t('bookCmp.summaryNow')
    : date
      ? `${formatDate(date)}${time ? `, ${formatSlotLabel(time)}` : ''}`
      : t('bookCmp.summaryDateNotSelected');

  const rows = [
    {
      icon: <Tag size={16} className="text-slate-400" />,
      label: t('bookCmp.summaryType'),
      value: (
        <Badge variant={isInstant ? 'green' : 'blue'}>
          {isInstant
            ? t('bookCmp.summaryInstant')
            : t('bookCmp.summaryScheduled')}
        </Badge>
      ),
    },
    {
      icon: <CalendarDays size={16} className="text-slate-400" />,
      label: t('bookCmp.summaryWhen'),
      value: <span className="text-slate-800">{whenLabel}</span>,
    },
    {
      icon: <Clock size={16} className="text-slate-400" />,
      label: t('bookCmp.summaryDuration'),
      value: <span className="text-slate-800">{formatDuration(mins)}</span>,
    },
    {
      icon: <Wallet size={16} className="text-slate-400" />,
      label: t('bookCmp.summaryRate'),
      value: (
        <span className="inline-flex flex-wrap items-center gap-1.5 text-slate-800">
          {formatRate(rate)}
          {isInstant && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              {INSTANT_BOOKING_MULTIPLIER}× instant
            </span>
          )}
          {isInstant && baseRate > 0 && (
            <span className="text-[11px] text-slate-400 line-through">
              {formatRate(baseRate)}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-800">
        {t('bookCmp.summary')}
      </h3>

      <div className="mt-4 flex items-center gap-3 border-b border-slate-100 pb-4">
        <Avatar
          src={professional ? professional.profilePhoto : ''}
          name={professional ? professional.name : ''}
          size="md"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {professional
              ? professional.name
              : t('bookCmp.professionalFallback')}
          </p>
          <p className="truncate text-xs text-slate-500">
            {professional
              ? professional.professionalType || professional.professionType
              : '—'}
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
          {t('bookCmp.summaryEstimatedCost')}
        </span>
        <span className="text-lg font-bold text-slate-900">
          {formatCurrency(estimatedCost)}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {t('bookCmp.summaryNote')}
      </p>
    </Card>
  );
}

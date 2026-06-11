'use client';

import { useLanguage } from '@/components/LanguageProvider';

/**
 * BookingCalendar — selectable grid of the next 14 days.
 *
 * Props: { selectedDate, onSelectDate, disabledWeekdays }
 *   selectedDate — ISO date string 'YYYY-MM-DD'
 *   onSelectDate(isoDateString) — called when a date cell is clicked
 *   disabledWeekdays — array OR Set of weekday names ('Monday', etc)
 *                      the professional has marked off. Cells for those
 *                      days render disabled and skip onSelectDate.
 */
export default function BookingCalendar({
  selectedDate,
  onSelectDate,
  disabledWeekdays,
}) {
  const { t } = useLanguage();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Normalise the disabled set so callers can pass either a Set OR an
  // array and we can do case-insensitive lookups.
  const disabledSet =
    disabledWeekdays instanceof Set
      ? new Set([...disabledWeekdays].map((d) => String(d).toLowerCase()))
      : new Set(
          (Array.isArray(disabledWeekdays) ? disabledWeekdays : []).map(
            (d) => String(d).toLowerCase()
          )
        );

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  function toIso(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
        {days.map((d) => {
          const iso = toIso(d);
          const isSelected = selectedDate === iso;
          const isToday = d.getTime() === today.getTime();
          const weekdayLong = d
            .toLocaleDateString('en-IN', { weekday: 'long' })
            .toLowerCase();
          const isOff = disabledSet.has(weekdayLong);
          const baseClasses = isOff
            ? 'cursor-not-allowed border-rose-200 bg-rose-50 text-rose-400'
            : isSelected
              ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50';
          return (
            <button
              key={iso}
              type="button"
              disabled={isOff}
              onClick={() => (isOff ? null : onSelectDate(iso))}
              title={isOff ? 'Professional is off this day' : undefined}
              aria-disabled={isOff}
              className={`flex flex-col items-center justify-center rounded-lg border px-2 py-3 text-center transition-colors ${baseClasses}`}
            >
              <span
                className={`text-[11px] font-medium uppercase tracking-wide ${
                  isOff
                    ? 'text-rose-400'
                    : isSelected
                      ? 'text-blue-100'
                      : 'text-slate-400'
                }`}
              >
                {d.toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
              <span className="mt-0.5 text-lg font-semibold leading-none">
                {d.getDate()}
              </span>
              <span
                className={`mt-0.5 text-[11px] ${
                  isOff
                    ? 'text-rose-400'
                    : isSelected
                      ? 'text-blue-100'
                      : 'text-slate-400'
                }`}
              >
                {isOff
                  ? 'Off'
                  : isToday
                    ? t('bookCmp.today')
                    : d.toLocaleDateString('en-IN', { month: 'short' })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

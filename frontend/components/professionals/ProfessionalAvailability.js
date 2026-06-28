'use client';

import { CalendarClock } from 'lucide-react';
import Card from '@/components/common/Card';
import { useLanguage } from '@/components/LanguageProvider';
import {
  DEFAULT_AVAILABILITY_SLOT,
  formatSlotLabel,
  resolveDaySlots,
  WEEKDAYS,
} from '@/utils/availability';

/**
 * ProfessionalAvailability — weekly availability slots.
 *
 * Rendering rules per day (kept in sync with the booking widget at
 * app/booking/[professionalId]/page.js and the AvailabilityManager UI
 * at components/dashboard/AvailabilityManager.js):
 *   - `entry.enabled === false`         -> "Day off"
 *   - `entry.slots` has values          -> render those slots
 *   - no entry, OR entry with no slots  -> render the default
 *                                          09:00-17:00 window
 *
 * Props: { professional }
 */
export default function ProfessionalAvailability({ professional }) {
  const { t } = useLanguage();
  const raw =
    professional && Array.isArray(professional.availability)
      ? professional.availability
      : [];

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock size={18} className="text-blue-600" />
        <h2 className="text-base font-semibold text-slate-900">
          {t('profCmp.availability')}
        </h2>
      </div>

      <div className="space-y-4">
        {WEEKDAYS.map((day) => {
          const { isOff, slots, isDefault } = resolveDaySlots(raw, day);
          return (
            <div
              key={day}
              className="flex flex-col gap-2 border-b border-slate-100 pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center"
            >
              <p className="w-28 shrink-0 text-sm font-semibold text-slate-700">
                {day}
              </p>
              {isOff ? (
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                  Day off
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {slots.map((time) => (
                    <span
                      key={time}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {formatSlotLabel(time)}
                    </span>
                  ))}
                  {isDefault && (
                    <span className="text-[11px] text-slate-400">
                      (default — set custom slots in the dashboard)
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Surfaced only if every day is off / has no custom slots — keeps
          the existing "No availability" line meaningful as a soft fallback. */}
      {raw.length === 0 && (
        <p className="mt-3 text-[11px] text-slate-400">
          Showing default availability ({DEFAULT_AVAILABILITY_SLOT}) on every
          day except those marked off.
        </p>
      )}
    </Card>
  );
}

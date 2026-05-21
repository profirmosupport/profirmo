import { CalendarClock } from 'lucide-react';
import Card from '@/components/common/Card';
import { formatTime } from '@/utils/formatters';

/**
 * ProfessionalAvailability — weekly availability slots.
 *
 * Props: { professional }
 */
export default function ProfessionalAvailability({ professional }) {
  const slots =
    (professional && Array.isArray(professional.availabilitySlots)
      ? professional.availabilitySlots
      : []) || [];

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock size={18} className="text-blue-600" />
        <h2 className="text-base font-semibold text-slate-900">Availability</h2>
      </div>

      {slots.length === 0 ? (
        <p className="text-sm text-slate-500">
          No availability has been published yet.
        </p>
      ) : (
        <div className="space-y-4">
          {slots.map((entry) => (
            <div
              key={entry.day}
              className="flex flex-col gap-2 border-b border-slate-100 pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center"
            >
              <p className="w-28 shrink-0 text-sm font-semibold text-slate-700">
                {entry.day}
              </p>
              {Array.isArray(entry.slots) && entry.slots.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {entry.slots.map((time) => (
                    <span
                      key={time}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {formatTime(time)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No slots this day</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

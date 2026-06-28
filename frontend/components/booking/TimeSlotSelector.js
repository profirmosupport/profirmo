'use client';

import { formatSlotLabel } from '@/utils/availability';

// Default fallback used only when no slots are passed in. Hour-long ranges
// (HH:MM-HH:MM) — matches the format the booking page feeds in after
// expandSlotsToHourly().
const DEFAULT_SLOTS = [
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
  '17:00-18:00',
];

/**
 * TimeSlotSelector — grid of selectable time-slot buttons.
 *
 * Props: { slots, selectedSlot, onSelectSlot }
 *   slots — optional array of 'HH:mm' strings; falls back to a default list
 *   onSelectSlot(slot) — called when a slot is clicked
 */
export default function TimeSlotSelector({ slots, selectedSlot, onSelectSlot }) {
  const list =
    Array.isArray(slots) && slots.length > 0 ? slots : DEFAULT_SLOTS;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
      {list.map((slot) => {
        const isSelected = selectedSlot === slot;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onSelectSlot(slot)}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
              isSelected
                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            {formatSlotLabel(slot)}
          </button>
        );
      })}
    </div>
  );
}

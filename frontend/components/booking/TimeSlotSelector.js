'use client';

import { formatTime } from '@/utils/formatters';

const DEFAULT_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
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
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              isSelected
                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            {formatTime(slot)}
          </button>
        );
      })}
    </div>
  );
}

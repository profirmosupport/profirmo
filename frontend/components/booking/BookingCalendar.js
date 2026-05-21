'use client';

/**
 * BookingCalendar — selectable grid of the next 14 days.
 *
 * Props: { selectedDate, onSelectDate }
 *   selectedDate — ISO date string 'YYYY-MM-DD'
 *   onSelectDate(isoDateString) — called when a date cell is clicked
 */
export default function BookingCalendar({ selectedDate, onSelectDate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              className={`flex flex-col items-center justify-center rounded-lg border px-2 py-3 text-center transition-colors ${
                isSelected
                  ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <span
                className={`text-[11px] font-medium uppercase tracking-wide ${
                  isSelected ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {d.toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
              <span className="mt-0.5 text-lg font-semibold leading-none">
                {d.getDate()}
              </span>
              <span
                className={`mt-0.5 text-[11px] ${
                  isSelected ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {isToday
                  ? 'Today'
                  : d.toLocaleDateString('en-IN', { month: 'short' })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

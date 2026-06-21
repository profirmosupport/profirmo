'use client';

// DashboardCalendar — month-grid widget on the professional dashboard.
// Combines four signals per cell:
//   * Availability — derived from the pro's weekly schedule via
//     resolveDaySlots(); explicit days-off render with a faded "Off" chip.
//   * Bookings    — confirmed/pending consultations for that day; click a
//     pill to jump to the booking detail page.
//   * Hearings    — case.nextHearingDate falling on that day; click a pill
//     to jump to the case detail page.
//   * Reminders   — pro-authored todos persisted via /api/reminders. Click
//     an empty area inside a date cell to open the add-reminder modal.
//
// The modal lets the pro optionally pin a reminder to one of their cases or
// bookings so the entry stays linked to the work it's about.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckCircle2,
  Circle,
  Gavel,
} from 'lucide-react';
import Card from '@/components/common/Card';
import AddReminderModal from '@/components/dashboard/AddReminderModal';
import { WEEKDAYS, resolveDaySlots } from '@/utils/availability';
import {
  listReminders,
  updateReminder,
  deleteReminder,
} from '@/services/reminderService';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Sunday-first weekday header to match the calendar grid below.
const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateKey(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function todayKey() {
  const d = new Date();
  return toDateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

// Build the 6-week grid of (year, month, day, inMonth) cells starting on Sun.
function buildMonthGrid(year, monthIndex) {
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];

  // Lead-in days from previous month so the grid starts on Sunday.
  if (firstDow > 0) {
    const prevMonthDays = new Date(year, monthIndex, 0).getDate();
    for (let i = firstDow - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(year, monthIndex - 1, day);
      cells.push({
        year: date.getFullYear(),
        month: date.getMonth(),
        day: date.getDate(),
        inMonth: false,
      });
    }
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ year, month: monthIndex, day: d, inMonth: true });
  }

  // Trail-out days from next month to fill up to 42 cells (6 weeks).
  while (cells.length < 42) {
    const last = cells[cells.length - 1];
    const date = new Date(last.year, last.month, last.day + 1);
    cells.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      inMonth: false,
    });
  }

  return cells;
}

function startTimeOf(slot) {
  // Slot may be "HH:MM-HH:MM" or a bare "HH:MM" legacy value.
  const s = String(slot || '');
  const dash = s.indexOf('-');
  return dash > 0 ? s.slice(0, dash) : s;
}

function bookingClientName(b) {
  if (!b) return 'Client';
  if (b.client && b.client.name) return b.client.name;
  if (b.clientName) return b.clientName;
  return 'Client';
}

export default function DashboardCalendar({
  availability = [],
  bookings = [],
  cases = [],
}) {
  const initial = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }, []);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const [reminders, setReminders] = useState([]);
  const [loadingRem, setLoadingRem] = useState(false);
  const [error, setError] = useState('');

  // Modal state — either the prefilled date for an "add" (clicked cell)
  // or the reminder being edited (clicked pill). The form fields
  // themselves live in <AddReminderModal>.
  const [openKey, setOpenKey] = useState(null);
  const [editing, setEditing] = useState(null);

  // Pull a wide window (the visible month + spillover days) so the grid
  // shows reminders that fall on prev/next-month lead/trail cells too.
  const refresh = useCallback(async () => {
    const fromDate = new Date(year, month, 1);
    fromDate.setDate(fromDate.getDate() - 7);
    const toDate = new Date(year, month + 1, 0);
    toDate.setDate(toDate.getDate() + 7);
    const from = toDateKey(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate()
    );
    const to = toDateKey(
      toDate.getFullYear(),
      toDate.getMonth(),
      toDate.getDate()
    );
    setLoadingRem(true);
    setError('');
    try {
      const rows = await listReminders({ from, to });
      setReminders(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || 'Failed to load reminders.');
      setReminders([]);
    } finally {
      setLoadingRem(false);
    }
  }, [year, month]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for cross-component reminder changes — e.g. an "Add reminder"
  // from the global header button on the dashboard layout. Without this
  // the calendar would lag until the next month-shift.
  useEffect(() => {
    function onChanged() {
      refresh();
    }
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('profirmo:reminder-changed', onChanged);
    return () => {
      window.removeEventListener('profirmo:reminder-changed', onChanged);
    };
  }, [refresh]);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const today = todayKey();

  // Index bookings and reminders by date key for O(1) lookup per cell.
  const bookingsByDate = useMemo(() => {
    const map = new Map();
    for (const b of bookings) {
      if (!b || !b.date) continue;
      const key = String(b.date).slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    }
    for (const list of map.values()) {
      list.sort((a, b) => startTimeOf(a.time).localeCompare(startTimeOf(b.time)));
    }
    return map;
  }, [bookings]);

  const remindersByDate = useMemo(() => {
    const map = new Map();
    for (const r of reminders) {
      if (!r || !r.dueDate) continue;
      const key = String(r.dueDate).slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return map;
  }, [reminders]);

  const hearingsByDate = useMemo(() => {
    const map = new Map();
    for (const c of cases) {
      if (!c || !c.nextHearingDate) continue;
      const key = String(c.nextHearingDate).slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    }
    return map;
  }, [cases]);

  function openModal(key) {
    setEditing(null);
    setOpenKey(key);
  }

  function openEdit(r) {
    setOpenKey(null);
    setEditing(r);
  }

  function closeModal() {
    setOpenKey(null);
    setEditing(null);
  }

  async function toggleDone(r) {
    try {
      await updateReminder(r.id, { done: !r.done });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profirmo:reminder-changed'));
      }
    } catch (err) {
      setError(err.message || 'Failed to update reminder.');
    }
  }

  async function handleDelete(r) {
    try {
      await deleteReminder(r.id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profirmo:reminder-changed'));
      }
    } catch (err) {
      setError(err.message || 'Failed to delete reminder.');
    }
  }

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  }

  function goToday() {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Calendar
          </h2>
          <p className="text-sm text-slate-500">
            Your availability, bookings and reminders at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-slate-800">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Today
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-xs">
        {WEEKDAY_HEADERS.map((d) => (
          <div
            key={d}
            className="bg-slate-50 px-2 py-1.5 text-center font-medium uppercase tracking-wide text-slate-500"
          >
            {d}
          </div>
        ))}

        {cells.map((cell, idx) => {
          const key = toDateKey(cell.year, cell.month, cell.day);
          const weekday = WEEKDAYS[(new Date(cell.year, cell.month, cell.day).getDay() + 6) % 7];
          const dayInfo = resolveDaySlots(availability, weekday);
          const dayBookings = bookingsByDate.get(key) || [];
          const dayHearings = hearingsByDate.get(key) || [];
          const dayReminders = remindersByDate.get(key) || [];
          const isToday = key === today;

          return (
            <div
              key={idx}
              onClick={(e) => {
                // Ignore clicks on inner buttons/links — only the empty
                // space inside the cell opens the add-reminder modal.
                if (e.target.closest('button, a')) return;
                openModal(key);
              }}
              className={[
                'min-h-[96px] cursor-pointer bg-white p-1.5 transition-colors hover:bg-blue-50/40',
                cell.inMonth ? '' : 'opacity-40',
                isToday ? 'ring-2 ring-inset ring-blue-500' : '',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span
                  className={[
                    'text-[11px] font-semibold',
                    isToday ? 'text-blue-600' : 'text-slate-600',
                  ].join(' ')}
                >
                  {cell.day}
                </span>
                {dayInfo.isOff ? (
                  <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-500">
                    Off
                  </span>
                ) : (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                    title="Available"
                  />
                )}
              </div>

              <div className="mt-1 space-y-1">
                {dayBookings.slice(0, 2).map((b) => (
                  <a
                    key={b.id}
                    href={`/dashboard/professional/bookings/${b.id}`}
                    className="block truncate rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 hover:bg-blue-200"
                    title={`${bookingClientName(b)} • ${b.time || ''}`}
                  >
                    {startTimeOf(b.time)} {bookingClientName(b)}
                  </a>
                ))}
                {dayBookings.length > 2 && (
                  <span className="block text-[10px] text-slate-500">
                    +{dayBookings.length - 2} more
                  </span>
                )}
                {dayHearings.slice(0, 2).map((c) => (
                  <a
                    key={c.id}
                    href={`/dashboard/professional/cases/${c.id}`}
                    className="flex items-center gap-1 truncate rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800 hover:bg-violet-200"
                    title={`Hearing · ${c.title || c.caseNumber || c.id}`}
                  >
                    <Gavel size={10} className="shrink-0" />
                    <span className="truncate">
                      {c.title || c.caseNumber || 'Hearing'}
                    </span>
                  </a>
                ))}
                {dayHearings.length > 2 && (
                  <span className="block text-[10px] text-slate-500">
                    +{dayHearings.length - 2} more hearing
                    {dayHearings.length - 2 === 1 ? '' : 's'}
                  </span>
                )}
                {dayReminders.slice(0, 2).map((r) => (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      // Inner buttons (toggle done, quick delete) handle
                      // their own clicks — only pill-background clicks
                      // open the edit modal.
                      if (e.target.closest('button')) return;
                      e.stopPropagation();
                      openEdit(r);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openEdit(r);
                      }
                    }}
                    className={[
                      'group flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px]',
                      r.done
                        ? 'bg-slate-100 text-slate-400 line-through hover:bg-slate-200'
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-200',
                    ].join(' ')}
                    title={r.note ? `${r.title} — ${r.note}` : r.title}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDone(r)}
                      className="text-current"
                      aria-label={r.done ? 'Mark as not done' : 'Mark as done'}
                    >
                      {r.done ? <CheckCircle2 size={10} /> : <Circle size={10} />}
                    </button>
                    <span className="flex-1 truncate">{r.title}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Delete reminder"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                {dayReminders.length > 2 && (
                  <span className="block text-[10px] text-slate-500">
                    +{dayReminders.length - 2} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loadingRem && (
        <p className="mt-2 text-[11px] text-slate-400">Loading reminders…</p>
      )}

      <AddReminderModal
        open={!!openKey}
        defaultDate={openKey || ''}
        dateLocked
        onClose={closeModal}
        onCreated={refresh}
      />

      <AddReminderModal
        open={!!editing}
        initialReminder={editing}
        onClose={closeModal}
        onCreated={refresh}
      />
    </Card>
  );
}

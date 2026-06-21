// Shared availability helpers — the single source of truth for the rule
// "no slot for a day + day not marked off → default 09:00-17:00", PLUS the
// slot-string formatter used everywhere bookings are rendered. Used by:
//   - components/dashboard/AvailabilityManager.js (editor)
//   - components/professionals/ProfessionalAvailability.js (public profile)
//   - components/booking/ConsultationSummary.js + TimeSlotSelector.js (booking page)
//   - components/dashboard/BookingsTab.js + ProfessionalBookingsList.js (dashboards)
//   - app/booking/[professionalId]/page.js (booking calendar)
//
// All surfaces must stay aligned or the public widget, the booking
// widget, and the dashboards will disagree about what a slot looks like.

import { formatTime } from './formatters';

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// Default window shown when a day has no custom slots and isn't explicitly
// marked off. Single string in the same range format used by the editor
// ("HH:MM-HH:MM") so every consumer renders it identically.
export const DEFAULT_AVAILABILITY_SLOT = '09:00-17:00';
export const DEFAULT_AVAILABILITY_SLOTS = [DEFAULT_AVAILABILITY_SLOT];

/**
 * Resolve the renderable slot list for one weekday.
 *
 * Returns:
 *   { isOff: false, slots: [...], isDefault: false }  -> pro has set slots
 *   { isOff: false, slots: [DEFAULT], isDefault: true } -> falls back to 09-17
 *   { isOff: true,  slots: [], isDefault: false }     -> explicitly marked off
 *
 * @param {Array<{day,enabled,slots}>} availability raw availability[] from API
 * @param {string} day weekday name (matches WEEKDAYS)
 */
export function resolveDaySlots(availability, day) {
  const entry =
    Array.isArray(availability) && availability.find((e) => e && e.day === day);

  if (entry && entry.enabled === false) {
    return { isOff: true, slots: [], isDefault: false };
  }
  if (entry && Array.isArray(entry.slots) && entry.slots.length > 0) {
    return { isOff: false, slots: entry.slots, isDefault: false };
  }
  return {
    isOff: false,
    slots: DEFAULT_AVAILABILITY_SLOTS,
    isDefault: true,
  };
}

/**
 * Expand one "HH:MM-HH:MM" range string into round-hour bookable slots
 * ["HH:MM-HH:MM", ...]. Booking buttons stay sensible — clients pick a
 * one-hour window, not a six-hour block.
 *
 * Examples:
 *   "09:00-17:00" -> [
 *     "09:00-10:00", "10:00-11:00", "11:00-12:00", "12:00-13:00",
 *     "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00"
 *   ]
 *   "09:30-12:00" -> ["10:00-11:00", "11:00-12:00"]
 *     (the half-hour to 10:00 is skipped so every bucket is a clean hour)
 *   "13:00-13:30" -> []   (no full hour fits)
 *   "09:00"       -> ["09:00-10:00"]   (legacy single-time, treated as 1h)
 */
function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

function fromMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function expandToHourlyRanges(slot) {
  if (!slot || typeof slot !== 'string') return [];
  const trimmed = slot.trim();

  // Legacy single-time slot like "09:00" — treat as a 1-hour window
  // starting at that time. Older saved data uses this shape.
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const start = toMinutes(trimmed);
    if (start === null) return [];
    return [`${fromMinutes(start)}-${fromMinutes(start + 60)}`];
  }

  const parts = trimmed.split('-').map((s) => s.trim());
  if (parts.length !== 2) return [trimmed];
  const start = toMinutes(parts[0]);
  const end = toMinutes(parts[1]);
  if (start === null || end === null || end <= start) return [];

  // Round start UP to the next hour boundary so every emitted bucket is a
  // clean hour. The half-hour up to the next hour is dropped; if a pro
  // wants 30-minute granularity they can express it as smaller ranges.
  let cursor = Math.ceil(start / 60) * 60;
  // Special-case an already-aligned start: ceil(540/60)*60 === 540, OK.
  if (cursor < start) cursor = start; // safety belt (won't fire after ceil)

  const out = [];
  while (cursor + 60 <= end) {
    out.push(`${fromMinutes(cursor)}-${fromMinutes(cursor + 60)}`);
    cursor += 60;
  }
  return out;
}

/**
 * Apply expandToHourlyRanges across a list of slot strings, flattening
 * the result and removing duplicates while preserving order.
 */
export function expandSlotsToHourly(slots) {
  if (!Array.isArray(slots)) return [];
  const seen = new Set();
  const out = [];
  for (const s of slots) {
    for (const bucket of expandToHourlyRanges(s)) {
      if (!seen.has(bucket)) {
        seen.add(bucket);
        out.push(bucket);
      }
    }
  }
  return out;
}

/**
 * Format a stored slot string for display. The single source of truth so
 * the booking page's right panel, the slot-picker, and the booking lists
 * in both dashboards all render the same label for the same value.
 *
 *   "09:00"        -> "9:00 AM"
 *   "09:00-10:00"  -> "9:00 AM – 10:00 AM"
 *   "—" / null     -> "—"
 *   anything else  -> passed through verbatim
 *
 * @param {string|null|undefined} slot
 * @returns {string}
 */
export function formatSlotLabel(slot) {
  if (slot === null || slot === undefined || slot === '') return '—';
  const s = String(slot);
  const isHHMM = (v) => /^\d{1,2}:\d{2}$/.test(v);
  const parts = s.split('-').map((p) => p.trim());
  if (parts.length === 2 && isHHMM(parts[0]) && isHHMM(parts[1])) {
    return `${formatTime(parts[0])} – ${formatTime(parts[1])}`;
  }
  if (isHHMM(s.trim())) return formatTime(s.trim());
  return s;
}

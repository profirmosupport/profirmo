// Availability helpers — mirror of frontend/utils/availability.js. Single
// source of truth for the mobile booking + slot rendering: applies the
// "no slot for a day + day not marked off → default 09:00-17:00" rule,
// expands range strings into hour-long bookable buckets, and formats
// slot labels for display so every booking surface stays aligned with
// the web.

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const DEFAULT_AVAILABILITY_SLOT = '09:00-17:00';
export const DEFAULT_AVAILABILITY_SLOTS = [DEFAULT_AVAILABILITY_SLOT];

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

  let cursor = Math.ceil(start / 60) * 60;
  if (cursor < start) cursor = start;

  const out = [];
  while (cursor + 60 <= end) {
    out.push(`${fromMinutes(cursor)}-${fromMinutes(cursor + 60)}`);
    cursor += 60;
  }
  return out;
}

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

function formatTime(hhmm) {
  const [hStr, mStr] = String(hhmm).split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  if (!Number.isFinite(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

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

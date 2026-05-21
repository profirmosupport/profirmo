// Formatting helpers. None of these throw — they return safe fallbacks on bad input.

const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/**
 * Format a number as Indian Rupees, e.g. 1200 -> "₹1,200".
 */
export function formatCurrency(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return '₹0';
  return rupeeFormatter.format(value);
}

/**
 * Format a per-minute rate, e.g. 45 -> "₹45/min".
 */
export function formatRate(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return '₹0/min';
  return `${formatCurrency(value)}/min`;
}

function toDate(d) {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a date, e.g. "21 May 2026".
 */
export function formatDate(d) {
  const date = toDate(d);
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a time string "HH:mm" (or a Date) to "9:30 AM".
 */
export function formatTime(t) {
  if (!t) return '—';
  if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return '—';
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }
  const date = toDate(t);
  if (!date) return '—';
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format a full date + time, e.g. "21 May 2026, 9:30 AM".
 */
export function formatDateTime(d) {
  const date = toDate(d);
  if (!date) return '—';
  return `${formatDate(date)}, ${formatTime(date)}`;
}

/**
 * Format a duration in minutes, e.g. 90 -> "1h 30m".
 */
export function formatDuration(mins) {
  const total = Number(mins);
  if (!Number.isFinite(total) || total <= 0) return '0m';
  const hours = Math.floor(total / 60);
  const minutes = Math.round(total % 60);
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

/**
 * Build initials from a name, e.g. "Aarav Mehta" -> "AM". Max 2 letters.
 */
export function getInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Truncate a string to n characters, appending an ellipsis.
 */
export function truncate(str, n = 100) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= n) return str;
  return `${str.slice(0, n).trimEnd()}…`;
}

/**
 * Human-readable relative time, e.g. "3 days ago", "in 2 hours".
 */
export function formatRelative(d) {
  const date = toDate(d);
  if (!date) return '—';
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ];
  for (const [unit, ms] of units) {
    if (absMs >= ms) {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return 'just now';
}

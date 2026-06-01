// Currency + date helpers. INR-first since Profirmo is India-focused;
// fall back to the locale default if Intl support is missing on older
// JS engines (rare on RN/Hermes but cheap to guard).

export function formatINR(paise) {
  const rupees = Number(paise) / 100;
  if (!Number.isFinite(rupees)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(rupees);
  } catch {
    return `₹${rupees.toFixed(0)}`;
  }
}

export function formatRupees(amount, currency = 'INR') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}

export function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export function displayName(user) {
  if (!user) return '';
  return (
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email ||
    ''
  );
}

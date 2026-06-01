// Color palette mirroring the web app — Tailwind slate + amber as the
// accent. Mobile screens import from here so we only have one place to
// retune the brand identity.

export const colors = {
  // Backgrounds
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceMuted: '#f1f5f9',

  // Deep neutrals — splash, hero gradient, dark panels.
  ink: '#0f172a',
  inkSoft: '#1e293b',
  inkSofter: '#334155',

  // Text
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textInverse: '#ffffff',

  // Borders
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',

  // Brand (amber)
  primary: '#d97706',
  primaryDark: '#b45309',
  primarySoft: '#fef3c7',
  primarySoftText: '#92400e',

  // Status
  success: '#059669',
  successSoft: '#d1fae5',
  successSoftText: '#065f46',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  dangerSoftText: '#991b1b',
  warning: '#f59e0b',
  warningSoft: '#fef3c7',
  warningSoftText: '#92400e',
  info: '#2563eb',
  infoSoft: '#dbeafe',
  infoSoftText: '#1e40af',
};

// Reusable gradient stops — keep them here so swapping the brand is a
// single-file edit.
export const gradients = {
  // Splash + hero — deep ink → amber.
  splash: ['#0f172a', '#1e293b', '#b45309'],
  hero: ['#1e293b', '#0f172a'],
  amber: ['#f59e0b', '#d97706'],
  amberSoft: ['#fde68a', '#fbbf24'],
  emerald: ['#10b981', '#059669'],
  rose: ['#f43f5e', '#e11d48'],
  violet: ['#a78bfa', '#7c3aed'],
  sky: ['#38bdf8', '#0284c7'],
};

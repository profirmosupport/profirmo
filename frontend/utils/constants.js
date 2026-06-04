// Pro Firmo shared constants — single source of truth for routes, taxonomy and enums.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  health: '/api/health',
  auth: {
    login: '/api/auth/login',
    registerClient: '/api/auth/register-client',
    registerProfessional: '/api/auth/register-professional',
    registerFirm: '/api/auth/register-firm',
    me: '/api/auth/me',
  },
  professionals: '/api/professionals',
  firms: '/api/firms',
  clients: '/api/clients',
  cases: '/api/cases',
  bookings: '/api/bookings',
  consultations: '/api/consultations',
  reviews: '/api/reviews',
  admin: {
    stats: '/api/admin/stats',
    professionals: '/api/admin/professionals',
    firms: '/api/admin/firms',
  },
};

// System roles: only three user types (client, professional, firm) plus the
// platform_admin. `FIRM_ADMIN` / `FIRM_PROFESSIONAL` are kept as legacy
// aliases so older call sites continue to resolve — firm-membership roles
// (owner / co-owner / member) live on FirmMember.role, not on User.role.
export const ROLES = {
  CLIENT: 'client',
  PROFESSIONAL: 'professional',
  FIRM: 'firm',
  PLATFORM_ADMIN: 'platform_admin',
  // Legacy aliases — same values as the new roles.
  FIRM_ADMIN: 'firm',
  FIRM_PROFESSIONAL: 'professional',
};

export const SITE = {
  name: 'Pro Firmo',
  tagline:
    'AI-powered legal and tax consultation, matched with the right professional in minutes.',
  description:
    'Pro Firmo lets you explain your case to AI first, then instantly matches you with the most suitable verified lawyer, advocate, tax expert or professional firm.',
};

export const NAV_LINKS = [
  { label: 'Professionals', href: '/professionals' },
  { label: 'Firms', href: '/firms' },
  { label: 'E-Courts India', href: '/ecourts' },
  { label: 'Blog', href: '/blog' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
];

export const FOOTER_LINKS = [
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
  {
    heading: 'Explore',
    links: [
      { label: 'Professionals', href: '/professionals' },
      { label: 'Firms', href: '/firms' },
      { label: 'Search', href: '/search' },
      { label: 'Unified cases', href: '/unified-cases' },
    ],
  },
];

// Categories, sub-categories and professional taxonomy are now admin-managed
// and served by /api/app-settings/categories. Use the `useCategories` /
// `useSubCategoriesFlat` hooks from `@/hooks/useAppSettings` instead of a
// hard-coded constant.

export const LANGUAGES = [
  'English',
  'Hindi',
  'Marathi',
  'Tamil',
  'Telugu',
  'Kannada',
  'Bengali',
  'Gujarati',
];

// Cities are admin-managed and served by /api/app-settings/cities. Use the
// `useCities` hook from `@/hooks/useAppSettings` instead of a hard-coded
// constant.

export const SORT_OPTIONS = [
  { value: 'rating', label: 'Top rated' },
  { value: 'experience', label: 'Most experienced' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
  { value: 'availability', label: 'Available now' },
];

export const EXPERIENCE_RANGES = [
  { value: 'any', label: 'Any experience', min: 0, max: Infinity },
  { value: '0-5', label: '0 - 5 years', min: 0, max: 5 },
  { value: '5-10', label: '5 - 10 years', min: 5, max: 10 },
  { value: '10-20', label: '10 - 20 years', min: 10, max: 20 },
  { value: '20+', label: '20+ years', min: 20, max: Infinity },
];

export const RATE_RANGES = [
  { value: 'any', label: 'Any rate', min: 0, max: Infinity },
  { value: '0-30', label: 'Under ₹30/min', min: 0, max: 30 },
  { value: '30-60', label: '₹30 - ₹60/min', min: 30, max: 60 },
  { value: '60-100', label: '₹60 - ₹100/min', min: 60, max: 100 },
  { value: '100+', label: '₹100+/min', min: 100, max: Infinity },
];

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const CASE_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in-progress',
  CLOSED: 'closed',
};

export const CONSULTATION_STATUS = {
  SCHEDULED: 'scheduled',
  ONGOING: 'ongoing',
  ENDED: 'ended',
};

export const BOOKING_TYPES = {
  INSTANT: 'instant',
  SCHEDULED: 'scheduled',
};

export const FIRM_TYPES = ['Legal Firm', 'Tax Firm'];

export const USER_TYPES = ['individual', 'business'];

// Display labels for status badges.
export const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  open: 'Open',
  'in-progress': 'In progress',
  closed: 'Closed',
  scheduled: 'Scheduled',
  ongoing: 'Ongoing',
  ended: 'Ended',
  approved: 'Approved',
};

// Badge variant per status value (matches Badge component variants).
export const STATUS_VARIANTS = {
  pending: 'amber',
  confirmed: 'blue',
  completed: 'green',
  cancelled: 'red',
  open: 'blue',
  'in-progress': 'amber',
  closed: 'gray',
  scheduled: 'blue',
  ongoing: 'green',
  ended: 'gray',
  approved: 'green',
};

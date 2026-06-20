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

// Header nav. Items can be flat links OR dropdowns:
//   { label, href }                         -> single link
//   { label, key, dropdown: [{ label, href, description? }] }  -> dropdown
// "Firms" moved to the footer Explore section per product spec.
export const NAV_LINKS = [
  { label: 'Professionals', href: '/professionals' },
  {
    label: 'Knowledge',
    key: 'knowledge',
    dropdown: [
      { label: 'All services', href: '/services', description: 'Browse every consultation service we offer.' },
      { label: 'Blog', href: '/blog', description: 'Plain-English explainers on Indian law.' },
      { label: 'How it works', href: '/how-it-works', description: 'AI matching, then a verified professional.' },
      // PILLAR PAGES (Phase B) — comprehensive category authority hubs.
      { label: 'GST Consultation', href: '/services/gst-consultation' },
      { label: 'Income Tax & ITR', href: '/services/income-tax-itr' },
      { label: 'Company Registration & ROC', href: '/services/company-registration-and-roc' },
      { label: 'Startup Compliance', href: '/services/startup-compliance' },
      // LOW-RISK conversion pages.
      { label: 'GST Notices', href: '/services/gst-notice-consultation' },
      { label: 'ITR Filing Help', href: '/services/income-tax-filing-help' },
      { label: 'Company Registration (Quick)', href: '/services/company-registration' },
      { label: 'Trademark', href: '/services/trademark-consultation' },
      { label: 'Rental Agreement', href: '/services/rental-agreement-drafting' },
      { label: 'Business Contract Review', href: '/services/business-contract-review' },
      { label: 'Tax Notice', href: '/services/tax-notice-help' },
      { label: 'Startup Legal', href: '/services/startup-legal-consultation' },
      // ADVOCATE-TIER pages — "Information & options", access-only framing.
      { label: 'Property Disputes — Info', href: '/services/property-dispute-consultation' },
      { label: 'Divorce & Family — Info', href: '/services/divorce-and-family-consultation' },
      { label: 'Legal Notices — Info', href: '/services/legal-notice-drafting' },
      { label: 'Cheque Bounce — Info', href: '/services/cheque-bounce-matter' },
      { label: 'Consumer Complaint — Info', href: '/services/consumer-complaint-consultation' },
      { label: 'Employment Dispute — Info', href: '/services/employment-and-salary-dispute' },
      { label: 'NRI Property — Info', href: '/services/nri-property-legal-help' },
    ],
  },
  { label: 'E-Courts India', href: '/ecourts' },
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
  {
    heading: 'Free Tools',
    links: [
      { label: 'GST Calculator', href: '/tools/gst-calculator' },
      // More tools land here: ITR deadline tracker, stamp-duty calc, etc.
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

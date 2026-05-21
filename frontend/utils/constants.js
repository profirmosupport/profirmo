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

export const ROLES = {
  CLIENT: 'client',
  PROFESSIONAL: 'professional',
  FIRM_ADMIN: 'firm_admin',
  FIRM_PROFESSIONAL: 'firm_professional',
  PLATFORM_ADMIN: 'platform_admin',
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
    ],
  },
];

// The 10 canonical consultation categories.
export const CATEGORIES = [
  'Divorce Lawyer',
  'Family Lawyer',
  'Criminal Lawyer',
  'Civil Lawyer',
  'Property Lawyer',
  'Corporate Lawyer',
  'Tax Consultant',
  'GST Consultant',
  'Income Tax Consultant',
  'Company Registration Consultant',
];

// Profession types used on professional profiles.
export const PROFESSION_TYPES = [
  'Advocate',
  'Divorce Lawyer',
  'Family Lawyer',
  'Criminal Lawyer',
  'Civil Lawyer',
  'Property Lawyer',
  'Corporate Lawyer',
  'Tax Consultant',
  'GST Consultant',
  'Income Tax Consultant',
  'Company Registration Consultant',
];

export const SPECIALIZATIONS = [
  'Family & Divorce',
  'Criminal Defence',
  'Civil Litigation',
  'Property & Real Estate',
  'Corporate & Commercial',
  'Contracts & Drafting',
  'Intellectual Property',
  'Labour & Employment',
  'Direct Taxation',
  'Indirect Taxation (GST)',
  'Income Tax Filing',
  'Company Incorporation',
  'Accounting & Compliance',
];

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

export const CITIES = [
  'Mumbai',
  'Delhi',
  'Bangalore',
  'Pune',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Ahmedabad',
  'Jaipur',
];

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

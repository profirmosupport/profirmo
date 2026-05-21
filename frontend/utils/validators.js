// Form validation helpers and ready-made rule sets for Pro Firmo auth forms.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/; // Indian 10-digit mobile numbers.

/**
 * True when value is a syntactically valid email.
 */
export function isEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

/**
 * True when value is a valid Indian 10-digit mobile number.
 * Strips spaces, hyphens and a leading +91 / 0 before testing.
 */
export function isPhone(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const cleaned = String(value)
    .replace(/[\s-]/g, '')
    .replace(/^\+91/, '')
    .replace(/^0/, '');
  return PHONE_RE.test(cleaned);
}

/**
 * True when value is at least 8 characters long.
 */
export function isStrongPassword(value) {
  return typeof value === 'string' && value.length >= 8;
}

/**
 * True when value is present and non-empty (after trimming strings).
 */
export function isRequired(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Validate a values object against a rules map.
 * @param {Object} values - { field: value }
 * @param {Object} rules  - { field: [ { test, message } ] }
 *   `test` receives (value, allValues) and returns true when valid.
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validateForm(values = {}, rules = {}) {
  const errors = {};
  for (const field of Object.keys(rules)) {
    const fieldRules = rules[field] || [];
    for (const rule of fieldRules) {
      const ok = rule.test(values[field], values);
      if (!ok) {
        errors[field] = rule.message;
        break; // first failing rule wins
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

// ---------------------------------------------------------------------------
// Ready-made rule sets
// ---------------------------------------------------------------------------

export const loginRules = {
  email: [
    { test: isRequired, message: 'Email is required.' },
    { test: isEmail, message: 'Enter a valid email address.' },
  ],
  password: [{ test: isRequired, message: 'Password is required.' }],
};

export const clientRegisterRules = {
  name: [{ test: isRequired, message: 'Full name is required.' }],
  email: [
    { test: isRequired, message: 'Email is required.' },
    { test: isEmail, message: 'Enter a valid email address.' },
  ],
  phone: [
    { test: isRequired, message: 'Phone number is required.' },
    { test: isPhone, message: 'Enter a valid 10-digit mobile number.' },
  ],
  city: [{ test: isRequired, message: 'City is required.' }],
  password: [
    { test: isRequired, message: 'Password is required.' },
    {
      test: isStrongPassword,
      message: 'Password must be at least 8 characters.',
    },
  ],
};

export const professionalRegisterRules = {
  name: [{ test: isRequired, message: 'Full name is required.' }],
  email: [
    { test: isRequired, message: 'Email is required.' },
    { test: isEmail, message: 'Enter a valid email address.' },
  ],
  phone: [
    { test: isRequired, message: 'Phone number is required.' },
    { test: isPhone, message: 'Enter a valid 10-digit mobile number.' },
  ],
  professionType: [
    { test: isRequired, message: 'Profession type is required.' },
  ],
  specialization: [
    { test: isRequired, message: 'Specialization is required.' },
  ],
  city: [{ test: isRequired, message: 'City is required.' }],
  registrationNumber: [
    { test: isRequired, message: 'Registration number is required.' },
  ],
  password: [
    { test: isRequired, message: 'Password is required.' },
    {
      test: isStrongPassword,
      message: 'Password must be at least 8 characters.',
    },
  ],
};

export const firmRegisterRules = {
  name: [{ test: isRequired, message: 'Firm name is required.' }],
  firmType: [{ test: isRequired, message: 'Firm type is required.' }],
  adminName: [{ test: isRequired, message: 'Admin name is required.' }],
  email: [
    { test: isRequired, message: 'Email is required.' },
    { test: isEmail, message: 'Enter a valid email address.' },
  ],
  phone: [
    { test: isRequired, message: 'Phone number is required.' },
    { test: isPhone, message: 'Enter a valid 10-digit mobile number.' },
  ],
  city: [{ test: isRequired, message: 'City is required.' }],
  address: [{ test: isRequired, message: 'Address is required.' }],
  password: [
    { test: isRequired, message: 'Password is required.' },
    {
      test: isStrongPassword,
      message: 'Password must be at least 8 characters.',
    },
  ],
};

// Lightweight, dependency-free validation helpers plus a small rule runner.
// Rules used by `validate` are strings like: 'required', 'email', 'phone',
// 'min:6'. Multiple rules per field are pipe-separated, e.g. 'required|email'.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[0-9][0-9\s-]{6,15}$/;

/** True when value looks like an email address. */
const isEmail = (v) => typeof v === 'string' && EMAIL_RE.test(v.trim());

/** True when value is a non-empty (after trimming) string or any non-null value. */
const isNonEmpty = (v) => {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

/** True when value looks like a phone number. */
const isPhone = (v) => typeof v === 'string' && PHONE_RE.test(v.trim());

/** True when string value has at least `n` characters. */
const minLength = (v, n) => typeof v === 'string' && v.trim().length >= n;

/**
 * Validate a request body against a rules object.
 * @param {object} body - the data to validate
 * @param {object} rulesObject - { fieldName: 'required|email|min:6' }
 * @returns {{ valid: boolean, errors: object }}
 */
const validate = (body = {}, rulesObject = {}) => {
  const errors = {};

  Object.keys(rulesObject).forEach((field) => {
    const ruleStr = rulesObject[field] || '';
    const rules = ruleStr
      .split('|')
      .map((r) => r.trim())
      .filter(Boolean);
    const value = body[field];

    const isRequired = rules.includes('required');
    const isProvided = isNonEmpty(value);

    // Skip optional fields that were not provided.
    if (!isRequired && !isProvided) return;

    for (const rule of rules) {
      const [name, param] = rule.split(':');

      if (name === 'required' && !isProvided) {
        errors[field] = `${field} is required`;
        break;
      }
      if (name === 'email' && isProvided && !isEmail(value)) {
        errors[field] = `${field} must be a valid email address`;
        break;
      }
      if (name === 'phone' && isProvided && !isPhone(value)) {
        errors[field] = `${field} must be a valid phone number`;
        break;
      }
      if (name === 'min' && isProvided && !minLength(value, Number(param))) {
        errors[field] = `${field} must be at least ${param} characters`;
        break;
      }
      if (name === 'number' && isProvided && Number.isNaN(Number(value))) {
        errors[field] = `${field} must be a number`;
        break;
      }
      if (
        name === 'in' &&
        isProvided &&
        !String(param).split(',').includes(String(value))
      ) {
        errors[field] = `${field} must be one of: ${param}`;
        break;
      }
    }
  });

  return { valid: Object.keys(errors).length === 0, errors };
};

module.exports = { isEmail, isNonEmpty, isPhone, minLength, validate };

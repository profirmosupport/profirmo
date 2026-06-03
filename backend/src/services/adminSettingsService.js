// adminSettingsService — typed read/write over the AdminSetting key/value
// table. Each known setting has a default + a coercer so the rest of the
// code can call getNumber('bookingMarkupBps') without dealing with strings.

const { AdminSetting } = require('../models');
const env = require('../config/env');

// Registry of every setting we expose. Adding a new one only requires
// dropping an entry here — the admin UI reads off the same list.
//
// Per-entry hints:
//   `type`     : 'number' | 'string' | 'longtext'        (input control)
//   `secret`   : true       -> value is never echoed back on list (masked)
//   `group`    : a label the admin UI uses to group related rows
//   `isPublic` : true       -> exposed via GET /api/public/<scope>-config
const stringCoerce = (raw) => {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
};

const SETTINGS = {
  bookingMarkupBps: {
    label: 'Booking markup (basis points)',
    description:
      'Platform fee taken from each consultation payment, in basis points. 1000 = 10%. Editing this affects every NEW payment; existing payments keep the markup they were captured with.',
    defaultGetter: () => Number(env.platformFeeBps) || 1000,
    type: 'number',
    group: 'Payments',
    coerce: (raw) => {
      const n = Math.floor(Number(raw));
      if (!Number.isFinite(n) || n < 0 || n > 10000) {
        throw {
          statusCode: 422,
          message: 'bookingMarkupBps must be an integer between 0 and 10000.',
        };
      }
      return n;
    },
    format: (n) => String(Math.floor(Number(n) || 0)),
  },

  // --- Ping4SMS (transactional SMS for phone OTP) -----------------------
  // Single key — used server-side by smsService to deliver the 6-digit
  // OTPs. Never exposed via the public config endpoint.
  ping4smsApiKey: {
    label: 'Ping4SMS API key',
    description:
      'Server-side API key for Ping4SMS. Used to deliver the 6-digit OTP SMS for login, signup and phone change. Never exposed to the browser.',
    defaultGetter: () => process.env.PING4SMS_API_KEY || '',
    type: 'string',
    group: 'SMS (Ping4SMS)',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },

  // --- Razorpay payments + subscriptions --------------------------------
  // keyId is public (embedded in the Razorpay Checkout iframe URL anyway).
  // keySecret + webhookSecret are server-only — masked on the listing.
  razorpayKeyId: {
    label: 'Razorpay Key ID',
    description:
      'Razorpay test/live key ID (rzp_test_… / rzp_live_…). From Razorpay Dashboard > Settings > API Keys. Used to mint Checkout sessions for booking payments and subscription mandates.',
    defaultGetter: () => process.env.RAZORPAY_KEY_ID || '',
    type: 'string',
    group: 'Razorpay',
    isPublic: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  razorpayKeySecret: {
    label: 'Razorpay Key Secret',
    description:
      'Razorpay key secret — server-only. Used to sign API calls + verify Checkout signatures. Generated alongside the Key ID in the Razorpay Dashboard. Never sent to the browser.',
    defaultGetter: () => process.env.RAZORPAY_KEY_SECRET || '',
    type: 'string',
    group: 'Razorpay',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  razorpayWebhookSecret: {
    label: 'Razorpay Webhook Secret',
    description:
      'Secret used to verify Razorpay webhook signatures. Set in Razorpay Dashboard > Settings > Webhooks. Required for subscription state updates (subscription.activated, subscription.charged, etc.) to be trusted.',
    defaultGetter: () => process.env.RAZORPAY_WEBHOOK_SECRET || '',
    type: 'string',
    group: 'Razorpay',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
};

const KNOWN_KEYS = Object.keys(SETTINGS);

// Mask a string value for safe display when the spec is marked `secret`.
// Never echo the raw value back — the admin who set it can re-paste it if
// they need to recover it. We just confirm a value exists and show length.
const maskSecret = (raw) => {
  if (!raw) return '';
  const s = String(raw);
  return `••• ${s.length} characters set •••`;
};

/**
 * Return every known setting with its current value. Secrets are masked
 * on the listing response so the admin UI never receives the raw bytes.
 */
async function listAll() {
  const rows = await AdminSetting.findAll({ raw: true });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return KNOWN_KEYS.map((key) => {
    const spec = SETTINGS[key];
    const stored = byKey.get(key);
    const rawValue = stored ? spec.coerce(stored.value) : spec.defaultGetter();
    const value = spec.secret ? maskSecret(rawValue) : rawValue;
    return {
      key,
      value,
      label: spec.label,
      description: spec.description,
      // For secrets, defaultValue is also masked — don't leak the env-var
      // fallback either.
      defaultValue: spec.secret
        ? maskSecret(spec.defaultGetter())
        : spec.defaultGetter(),
      type: spec.type || 'number',
      group: spec.group || 'General',
      secret: !!spec.secret,
      isPublic: !!spec.isPublic,
      hasValue: Boolean(rawValue),
      updatedAt: stored ? stored.updatedAt : null,
    };
  });
}

/**
 * Return only the settings flagged `isPublic: true`, with their RAW
 * (non-masked) values. Intended for public config endpoints — these
 * values are public by design (they're embedded in client bundles).
 *
 * @returns {Promise<Object>} key -> value map (raw strings/numbers)
 */
async function getPublicConfig() {
  const rows = await AdminSetting.findAll({ raw: true });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const out = {};
  for (const key of KNOWN_KEYS) {
    const spec = SETTINGS[key];
    if (!spec.isPublic) continue;
    const stored = byKey.get(key);
    out[key] = stored ? spec.coerce(stored.value) : spec.defaultGetter();
  }
  return out;
}

/**
 * Read a raw setting value (string), DB-first, env-default fallback.
 * Server-internal — never expose through an HTTP listing of secrets.
 */
async function getString(key) {
  const spec = SETTINGS[key];
  if (!spec) throw new Error(`Unknown admin setting: ${key}`);
  const row = await AdminSetting.findByPk(key);
  if (!row || row.value === null || row.value === undefined || row.value === '') {
    return spec.defaultGetter();
  }
  try {
    return spec.coerce(row.value);
  } catch {
    return spec.defaultGetter();
  }
}

/** Typed getter — returns the coerced value or the default. */
async function getNumber(key) {
  const spec = SETTINGS[key];
  if (!spec) throw new Error(`Unknown admin setting: ${key}`);
  const row = await AdminSetting.findByPk(key);
  if (!row || row.value === null || row.value === undefined || row.value === '') {
    return spec.defaultGetter();
  }
  try {
    return spec.coerce(row.value);
  } catch {
    return spec.defaultGetter();
  }
}


/**
 * Set a setting. Validates the key + coerces the value. Returns the new
 * coerced value so the admin UI can echo it back.
 */
async function set(key, value, actorUserId) {
  const spec = SETTINGS[key];
  if (!spec) {
    throw { statusCode: 404, message: `Unknown setting: ${key}` };
  }
  const coerced = spec.coerce(value);
  const formatted = spec.format(coerced);
  const existing = await AdminSetting.findByPk(key);
  if (existing) {
    await existing.update({
      value: formatted,
      label: spec.label,
      description: spec.description,
      updatedByUserId: actorUserId || null,
    });
  } else {
    await AdminSetting.create({
      key,
      value: formatted,
      label: spec.label,
      description: spec.description,
      updatedByUserId: actorUserId || null,
    });
  }
  return coerced;
}

module.exports = {
  SETTINGS,
  KNOWN_KEYS,
  listAll,
  getPublicConfig,
  getNumber,
  getString,
  set,
};

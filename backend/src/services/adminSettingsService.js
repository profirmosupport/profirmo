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

  // --- Firebase Phone Auth ----------------------------------------------
  // The three "service account" keys are server-only — they sign ID-token
  // verifications via firebase-admin. The six "web" keys are public by
  // design (they're embedded in every client bundle that uses Firebase)
  // and surface via GET /api/public/firebase-config so the browser can
  // initialise the SDK at runtime without a rebuild.
  firebaseProjectId: {
    label: 'Firebase project ID',
    description:
      'The project ID from the Firebase Console (Project Settings -> General). Shared between server and web SDK.',
    defaultGetter: () => process.env.FIREBASE_PROJECT_ID || '',
    type: 'string',
    group: 'Firebase Phone Auth',
    isPublic: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  firebaseClientEmail: {
    label: 'Firebase client email (service account)',
    description:
      'The `client_email` field from the service-account JSON. Server-only — used by firebase-admin to verify ID tokens.',
    defaultGetter: () => process.env.FIREBASE_CLIENT_EMAIL || '',
    type: 'string',
    group: 'Firebase Phone Auth',
    coerce: stringCoerce,
    format: stringCoerce,
  },
  firebasePrivateKey: {
    label: 'Firebase private key (service account)',
    description:
      'The `private_key` field from the service-account JSON (the entire "-----BEGIN PRIVATE KEY-----..." block, newlines preserved). Server-only — never exposed on a public endpoint.',
    defaultGetter: () => process.env.FIREBASE_PRIVATE_KEY || '',
    type: 'longtext',
    group: 'Firebase Phone Auth',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  firebaseApiKey: {
    label: 'Firebase Web API key',
    description:
      'From the Firebase Console (Project Settings -> Your apps -> Web app -> SDK setup). Embedded in the client bundle — not a secret.',
    defaultGetter: () => process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    type: 'string',
    group: 'Firebase Phone Auth',
    isPublic: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  firebaseAuthDomain: {
    label: 'Firebase auth domain',
    description: 'Usually `<project-id>.firebaseapp.com`.',
    defaultGetter: () => process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    type: 'string',
    group: 'Firebase Phone Auth',
    isPublic: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  firebaseStorageBucket: {
    label: 'Firebase storage bucket',
    description: 'Optional — usually `<project-id>.appspot.com`.',
    defaultGetter: () => process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    type: 'string',
    group: 'Firebase Phone Auth',
    isPublic: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  firebaseMessagingSenderId: {
    label: 'Firebase messaging sender ID',
    description: 'Optional — numeric ID from the web-app SDK config.',
    defaultGetter: () =>
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    type: 'string',
    group: 'Firebase Phone Auth',
    isPublic: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  firebaseAppId: {
    label: 'Firebase web app ID',
    description: 'The `appId` value from the web-app SDK config.',
    defaultGetter: () => process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    type: 'string',
    group: 'Firebase Phone Auth',
    isPublic: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  firebaseRecaptchaEnterpriseSiteKey: {
    label: 'reCAPTCHA Enterprise site key',
    description:
      'reCAPTCHA Enterprise site key used by Firebase Phone Auth for App verification. Stored here for record only - the SDK picks the key up from the Firebase Console (Authentication > Settings > reCAPTCHA Enterprise). After pasting it here, register the same key in the Firebase Console for Phone Auth to honour it.',
    defaultGetter: () =>
      process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY || '',
    type: 'string',
    group: 'Firebase Phone Auth',
    isPublic: true,
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
 * (non-masked) values. Intended for the public `/api/public/firebase-config`
 * endpoint — these values are public by design (they're embedded in every
 * client SDK config).
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

// Keys that, when changed, must invalidate cached integrations elsewhere
// in the process (e.g. the firebase-admin App instance).
const FIREBASE_ADMIN_KEYS = new Set([
  'firebaseProjectId',
  'firebaseClientEmail',
  'firebasePrivateKey',
]);

/**
 * Set a setting. Validates the key + coerces the value. Returns the new
 * coerced value so the admin UI can echo it back.
 *
 * Side-effect: when a Firebase service-account key changes we tear the
 * cached firebase-admin app down so the next /api/auth/firebase call
 * re-initialises against the new credentials. Without this the server
 * would have to restart for the new key to take effect.
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
  if (FIREBASE_ADMIN_KEYS.has(key)) {
    try {
      // Required lazily — avoids a circular import at module load time.
      const firebase = require('../config/firebase');
      if (typeof firebase.reset === 'function') firebase.reset();
    } catch {
      /* ignore — reset is best-effort */
    }
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

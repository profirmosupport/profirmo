// adminSettingsService — typed read/write over the AdminSetting key/value
// table. Each known setting has a default + a coercer so the rest of the
// code can call getNumber('bookingMarkupBps') without dealing with strings.

const { AdminSetting } = require('../models');
const env = require('../config/env');
const { encryptSecret, decryptSecret, isEncrypted } = require('../utils/secretCrypto');

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
  // Two parallel credential sets — live + test — and a `razorpayMode`
  // switch that picks which one the payments service uses. The keyId
  // for the active mode is exposed via the public config endpoint
  // (Checkout iframe needs it client-side); secrets are always masked.
  razorpayMode: {
    label: 'Razorpay Mode',
    description:
      '"live" charges real money against the production credentials. "test" routes through the Razorpay sandbox using the *Test* credentials below. Toggle to switch the entire payment + subscription flow with no redeploy.',
    defaultGetter: () => process.env.RAZORPAY_MODE || 'test',
    type: 'string',
    group: 'Razorpay',
    isPublic: true,
    // The admin UI renders a <Select> instead of a text input when
    // `options` is set. Each option is { value, label }.
    options: [
      { value: 'test', label: 'Test (sandbox)' },
      { value: 'live', label: 'Live (real money)' },
    ],
    coerce: (raw) => {
      const v = stringCoerce(raw).toLowerCase();
      if (v && v !== 'live' && v !== 'test') {
        throw {
          statusCode: 422,
          message: 'razorpayMode must be "live" or "test".',
        };
      }
      return v || 'test';
    },
    format: stringCoerce,
  },

  // -- LIVE credentials --
  razorpayKeyId: {
    label: 'Razorpay Key ID (Live)',
    description:
      'Live mode Razorpay key ID (rzp_live_…). From Razorpay Dashboard > Settings > API Keys. Used when razorpayMode = "live".',
    defaultGetter: () => process.env.RAZORPAY_KEY_ID || '',
    type: 'string',
    group: 'Razorpay',
    isPublic: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  razorpayKeySecret: {
    label: 'Razorpay Key Secret (Live)',
    description:
      'Live key secret — server-only. Generated alongside the Live Key ID in the Razorpay Dashboard. Never sent to the browser.',
    defaultGetter: () => process.env.RAZORPAY_KEY_SECRET || '',
    type: 'string',
    group: 'Razorpay',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  razorpayWebhookSecret: {
    label: 'Razorpay Webhook Secret (Live)',
    description:
      'Webhook signing secret for the LIVE webhook endpoint. Set in Razorpay Dashboard > Settings > Webhooks. Required for subscription state updates in live mode.',
    defaultGetter: () => process.env.RAZORPAY_WEBHOOK_SECRET || '',
    type: 'string',
    group: 'Razorpay',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },

  // -- TEST credentials --
  razorpayKeyIdTest: {
    label: 'Razorpay Key ID (Test)',
    description:
      'Test mode Razorpay key ID (rzp_test_…). From Razorpay Dashboard (test mode toggle) > Settings > API Keys. Used when razorpayMode = "test".',
    defaultGetter: () => process.env.RAZORPAY_KEY_ID_TEST || '',
    type: 'string',
    group: 'Razorpay',
    isPublic: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  razorpayKeySecretTest: {
    label: 'Razorpay Key Secret (Test)',
    description:
      'Test mode key secret — server-only. Generated alongside the Test Key ID in the Razorpay Dashboard (test mode).',
    defaultGetter: () => process.env.RAZORPAY_KEY_SECRET_TEST || '',
    type: 'string',
    group: 'Razorpay',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  razorpayWebhookSecretTest: {
    label: 'Razorpay Webhook Secret (Test)',
    description:
      'Webhook signing secret for the TEST webhook endpoint. Set in Razorpay Dashboard > Settings > Webhooks (test mode).',
    defaultGetter: () => process.env.RAZORPAY_WEBHOOK_SECRET_TEST || '',
    type: 'string',
    group: 'Razorpay',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },

  // --- E-Courts India (case lookup proxy) -------------------------------
  // Used by /api/ecourts/* to call ecourtsindia.com on behalf of the
  // browser. Server-only — the partner key is never exposed to clients
  // (would leak our quota). Sent as Bearer in the Authorization header.
  ecourtsApiKey: {
    label: 'E-Courts India API key',
    description:
      'Partner API key (eci_live_…) for ecourtsindia.com. Used server-side to proxy case search + detail + order-download calls from the /ecourts page. Never sent to the browser. Get one at https://ecourtsindia.com/api/docs.',
    defaultGetter: () => process.env.ECOURTS_API_KEY || '',
    type: 'string',
    group: 'E-Courts India',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },

  // --- Attestr Unified eCourt API ---------------------------------------
  // Token for https://api.attestr.com/api/v2/public/ecourtx/case-details/basic
  // — sent as `Authorization: Basic <token>`. Generated from the Attestr
  // dashboard ("Register App"). Server-only.
  attestrApiKey: {
    label: 'Attestr API token',
    description:
      'Authorization token for https://api.attestr.com — used to proxy the Unified eCourt Case Details API for the /unified-cases page. Generated in your Attestr dashboard under "Register App". Sent as Basic auth.',
    defaultGetter: () => process.env.ATTESTR_API_TOKEN || '',
    type: 'string',
    group: 'Attestr',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },

  // --- Support / contact form ------------------------------------------
  // Destination inbox for the /contact page submissions. Defaults to the
  // public-facing support address; admin can route the notifications
  // elsewhere without code changes.
  supportEmail: {
    label: 'Support inbox',
    description:
      'Email address that receives every /contact form submission. Defaults to support@profirmo.com. Change to route support notifications to your ticketing system / shared inbox.',
    defaultGetter: () =>
      process.env.SUPPORT_EMAIL || 'support@profirmo.com',
    type: 'string',
    group: 'Support',
    coerce: stringCoerce,
    format: stringCoerce,
  },

  // --- Storage / AWS S3 -------------------------------------------------
  // The `storage_driver` key flips the entire upload pipeline between
  // local disk and AWS S3 at runtime (no restart required). The S3
  // sub-keys configure the SDK client. `aws_secret_access_key` is
  // stored as plaintext + masked from the admin GET response by the
  // `secret: true` flag; encryption at rest is intentionally OFF here
  // because it was tied to JWT_SECRET and silently broke whenever the
  // signing secret was rotated.
  storage_driver: {
    label: 'Storage driver',
    description:
      'Where uploaded files are stored. "local" writes to backend/uploads on the server filesystem; "s3" pushes to the configured AWS S3 bucket. Switch live from this panel — existing local files keep resolving via /uploads regardless of this setting.',
    defaultGetter: () => process.env.STORAGE_DRIVER || 'local',
    type: 'string',
    group: 'Storage / AWS S3',
    options: [
      { value: 'local', label: 'Local (backend/uploads)' },
      { value: 's3', label: 'AWS S3' },
    ],
    coerce: (raw) => {
      const v = stringCoerce(raw).toLowerCase();
      if (v && v !== 'local' && v !== 's3') {
        throw { statusCode: 422, message: 'storage_driver must be "local" or "s3".' };
      }
      return v || 'local';
    },
    format: stringCoerce,
  },
  aws_access_key_id: {
    label: 'AWS Access Key ID',
    description:
      'IAM Access Key ID with s3:PutObject / s3:DeleteObject / s3:GetObject permission on the configured bucket. Used server-side only — never sent to the browser.',
    defaultGetter: () => process.env.AWS_ACCESS_KEY_ID || '',
    type: 'string',
    group: 'Storage / AWS S3',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  aws_secret_access_key: {
    label: 'AWS Secret Access Key',
    description:
      'Secret half of the IAM access key. Stored as plaintext in admin_settings; the admin GET response masks the value via `secret: true` so it never leaves the server in cleartext. Re-enter to rotate.',
    defaultGetter: () => process.env.AWS_SECRET_ACCESS_KEY || '',
    type: 'string',
    group: 'Storage / AWS S3',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  aws_default_region: {
    label: 'AWS Default Region',
    description:
      'AWS region of the bucket, e.g. "ap-south-1" (Mumbai), "us-east-1" (N. Virginia). Must match the bucket\'s region.',
    defaultGetter: () => process.env.AWS_REGION || 'ap-south-1',
    type: 'string',
    group: 'Storage / AWS S3',
    coerce: stringCoerce,
    format: stringCoerce,
  },
  aws_bucket: {
    label: 'AWS Bucket Name',
    description:
      'Name of the S3 bucket where uploads land — e.g. "profirmomain". Uploads are placed under prefixes such as profile-images/, documents/, case-files/.',
    defaultGetter: () => process.env.AWS_BUCKET || 'profirmomain',
    type: 'string',
    group: 'Storage / AWS S3',
    coerce: stringCoerce,
    format: stringCoerce,
  },
  aws_url: {
    label: 'AWS Base URL / CDN URL',
    description:
      'Public base URL used to build readable file URLs. Defaults to the bucket\'s virtual-hosted-style endpoint (https://<bucket>.s3.<region>.amazonaws.com) when blank. Set this to your CloudFront / custom domain to serve via CDN.',
    defaultGetter: () => process.env.AWS_URL || '',
    type: 'string',
    group: 'Storage / AWS S3',
    isPublic: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  aws_use_path_style_endpoint: {
    label: 'Use Path-Style Endpoint',
    description:
      '"true" forces path-style URLs (https://s3.region.amazonaws.com/<bucket>/<key>) instead of virtual-hosted-style. Only needed for S3-compatible providers like MinIO; leave "false" for AWS.',
    defaultGetter: () => 'false',
    type: 'string',
    group: 'Storage / AWS S3',
    options: [
      { value: 'false', label: 'false (AWS default)' },
      { value: 'true', label: 'true (path-style, MinIO etc.)' },
    ],
    coerce: (raw) => {
      const v = stringCoerce(raw).toLowerCase();
      if (v && v !== 'true' && v !== 'false') {
        throw { statusCode: 422, message: 'aws_use_path_style_endpoint must be "true" or "false".' };
      }
      return v || 'false';
    },
    format: stringCoerce,
  },

  // --- Integrations / Gmail OAuth --------------------------------------
  // Server-side credentials for the Gmail OAuth flow. Mirrors the AWS
  // model: secret values are stored as plaintext and only the admin GET
  // response masks them (`secret: true`). NO encryption-at-rest — see
  // the AWS comment above for why.
  gmail_oauth_client_id: {
    label: 'Gmail OAuth Client ID',
    description:
      'OAuth 2.0 Client ID for the GCP project that backs the Gmail integration. Visible in the Google Cloud Console under APIs & Services → Credentials.',
    defaultGetter: () => process.env.GMAIL_OAUTH_CLIENT_ID || '',
    type: 'string',
    group: 'Integrations / Gmail',
    coerce: stringCoerce,
    format: stringCoerce,
  },
  gmail_oauth_client_secret: {
    label: 'Gmail OAuth Client Secret',
    description:
      'Matching client secret. Stored as plaintext; the admin GET response masks the value via `secret: true`. Re-enter to rotate.',
    defaultGetter: () => process.env.GMAIL_OAUTH_CLIENT_SECRET || '',
    type: 'string',
    group: 'Integrations / Gmail',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  gmail_redirect_uri: {
    label: 'Gmail OAuth Redirect URI',
    description:
      'Where Google sends the user back after consent. Must exactly match the redirect URI registered in the GCP OAuth client. Example: https://proapi.profirmo.com/api/integrations/gmail/callback',
    defaultGetter: () =>
      process.env.GMAIL_REDIRECT_URI ||
      'http://localhost:5001/api/integrations/gmail/callback',
    type: 'string',
    group: 'Integrations / Gmail',
    coerce: stringCoerce,
    format: stringCoerce,
  },

  // --- AI / Anthropic Claude --------------------------------------
  // Drives the per-case AI Clerk (summarise / suggest next step /
  // free-prompt help). Key is stored plaintext + masked on admin GET
  // by `secret: true` — same model as the AWS S3 + Gmail credentials.
  claude_api_key: {
    label: 'Claude (Anthropic) API key',
    description:
      'Anthropic console key (starts with sk-ant-…). Used by the per-case AI Clerk for summary, next-step suggestions and prompt-based help. Stored plaintext; masked in the admin UI via `secret: true`.',
    defaultGetter: () => process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    type: 'string',
    group: 'AI / Anthropic',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  claude_model: {
    label: 'Claude model',
    description:
      'Model identifier passed to /v1/messages. Default: claude-sonnet-4-6 (good balance of cost + capability). Switch to claude-opus-4-7 for harder analytical tasks or claude-haiku-4-5-20251001 for cheaper drafts.',
    defaultGetter: () => process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    type: 'string',
    group: 'AI / Anthropic',
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

// Read the raw column value, decrypting if the spec flags this key as
// encrypted. Returns '' when nothing is stored so callers can fall back
// to the spec's defaultGetter.
const readStoredValue = (spec, row) => {
  if (!row || row.value === null || row.value === undefined || row.value === '') {
    return '';
  }
  if (spec.encrypted) {
    return decryptSecret(row.value);
  }
  // Legacy rows written before a key was upgraded to encrypted will pass
  // through verbatim (decryptSecret already handles the unprefixed case).
  if (isEncrypted(row.value)) {
    // Defensive: if the column happens to look like an encrypted blob,
    // try to decrypt even when the spec doesn't ask for it.
    return decryptSecret(row.value);
  }
  return row.value;
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
    // Decrypt encrypted values before coercing so the length-aware mask
    // reflects the plaintext, not the ciphertext.
    const decrypted = readStoredValue(spec, stored);
    const rawValue = decrypted
      ? spec.coerce(decrypted)
      : spec.defaultGetter();
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
      encrypted: !!spec.encrypted,
      isPublic: !!spec.isPublic,
      // Enum-style options for fields the admin UI should render as a
      // dropdown rather than a free-text input.
      options: Array.isArray(spec.options) ? spec.options : null,
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
    const decrypted = readStoredValue(spec, stored);
    out[key] = decrypted ? spec.coerce(decrypted) : spec.defaultGetter();
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
  const decrypted = readStoredValue(spec, row && row.toJSON ? row.toJSON() : row);
  if (!decrypted) {
    return spec.defaultGetter();
  }
  try {
    return spec.coerce(decrypted);
  } catch {
    return spec.defaultGetter();
  }
}

/** Typed getter — returns the coerced value or the default. */
async function getNumber(key) {
  const spec = SETTINGS[key];
  if (!spec) throw new Error(`Unknown admin setting: ${key}`);
  const row = await AdminSetting.findByPk(key);
  const decrypted = readStoredValue(spec, row && row.toJSON ? row.toJSON() : row);
  if (!decrypted) {
    return spec.defaultGetter();
  }
  try {
    return spec.coerce(decrypted);
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
  // Encrypted keys are stored as ciphertext; everything else stays as
  // plain text in the DB. Empty values short-circuit to '' so a clear
  // doesn't leave behind a misleading ciphertext blob.
  const persisted = spec.encrypted
    ? formatted
      ? encryptSecret(formatted)
      : ''
    : formatted;
  const existing = await AdminSetting.findByPk(key);
  if (existing) {
    await existing.update({
      value: persisted,
      label: spec.label,
      description: spec.description,
      updatedByUserId: actorUserId || null,
    });
  } else {
    await AdminSetting.create({
      key,
      value: persisted,
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

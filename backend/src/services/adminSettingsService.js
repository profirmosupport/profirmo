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

  // --- SMTP (outgoing mail) --------------------------------------------
  // Live-editable transport config used by services/emailService.js. The
  // service reads these on every send (cheap in-process getString lookup)
  // so a credentials change takes effect on the next message without
  // restarting the API.
  //
  // smtp_pass carries the (Gmail app password / provider secret) so it's
  // marked secret + masked from the admin GET response. Empty values
  // here fall back to the SMTP_* env vars in env.js, preserving the
  // env-only behaviour of older deployments.
  smtp_host: {
    label: 'SMTP host',
    description:
      'Outgoing-mail server. For Gmail with an app password use smtp.gmail.com.',
    defaultGetter: () => process.env.SMTP_HOST || '',
    type: 'string',
    group: 'SMTP (outgoing mail)',
    coerce: stringCoerce,
    format: stringCoerce,
  },
  smtp_port: {
    label: 'SMTP port',
    description:
      'TCP port. 587 for STARTTLS (most providers, recommended); 465 for legacy implicit-TLS; 25 for unencrypted (avoid).',
    defaultGetter: () => process.env.SMTP_PORT || '587',
    type: 'number',
    group: 'SMTP (outgoing mail)',
    coerce: (raw) => {
      const n = Number(stringCoerce(raw));
      if (!Number.isFinite(n) || n <= 0 || n > 65535) {
        throw { statusCode: 422, message: 'smtp_port must be a TCP port (1-65535).' };
      }
      return String(n);
    },
    format: stringCoerce,
  },
  smtp_secure: {
    label: 'SMTP encryption',
    description:
      'Set "true" for implicit TLS (port 465). Leave "false" for STARTTLS (port 587, gmail.com).',
    defaultGetter: () =>
      String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'
        ? 'true'
        : 'false',
    type: 'string',
    group: 'SMTP (outgoing mail)',
    options: [
      { value: 'false', label: 'false — STARTTLS (port 587)' },
      { value: 'true', label: 'true — implicit TLS (port 465)' },
    ],
    coerce: (raw) => {
      const v = stringCoerce(raw).toLowerCase();
      if (v && v !== 'true' && v !== 'false') {
        throw { statusCode: 422, message: 'smtp_secure must be "true" or "false".' };
      }
      return v || 'false';
    },
    format: stringCoerce,
  },
  smtp_user: {
    label: 'SMTP username',
    description:
      'Authenticating mailbox. For Gmail this is the full address (e.g. support@profirmo.com).',
    defaultGetter: () => process.env.SMTP_USER || '',
    type: 'string',
    group: 'SMTP (outgoing mail)',
    coerce: stringCoerce,
    format: stringCoerce,
  },
  smtp_pass: {
    label: 'SMTP password',
    description:
      'Authenticating password. For Gmail this MUST be an App Password (16 chars, generated at https://myaccount.google.com/apppasswords). Stored plaintext on the row; masked from the admin GET response via `secret: true`. Re-enter to rotate.',
    defaultGetter: () => process.env.SMTP_PASS || '',
    type: 'string',
    group: 'SMTP (outgoing mail)',
    secret: true,
    coerce: stringCoerce,
    format: stringCoerce,
  },
  smtp_from_email: {
    label: 'Default From email',
    description:
      'Address that appears in the "From:" header on every system email. Usually identical to smtp_user; Gmail rewrites mismatches to the authenticating mailbox.',
    defaultGetter: () =>
      process.env.SMTP_FROM_EMAIL ||
      process.env.SMTP_USER ||
      'support@profirmo.com',
    type: 'string',
    group: 'SMTP (outgoing mail)',
    coerce: stringCoerce,
    format: stringCoerce,
  },
  smtp_from_name: {
    label: 'Default From name',
    description:
      'Display name on the "From:" header. Example: "Profirmo Support".',
    defaultGetter: () => process.env.SMTP_FROM_NAME || 'Profirmo',
    type: 'string',
    group: 'SMTP (outgoing mail)',
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
  // --- AI blog featured-image generator -----------------------------
  // The AI blog flow uses Pollinations.ai (free, no API key, no
  // signup) for featured-image generation. No admin setting is needed
  // — the endpoint is hard-coded in pollinationsImageService.js.

  claude_model: {
    label: 'Claude model',
    description:
      'Model identifier passed to /v1/messages. Default is Haiku 4.5 — the cheapest currently-supported model, ideal for trialling the AI Clerk. Move to Sonnet for production once token usage stabilises, or Opus for the hardest analytical work.',
    // Default to Haiku 4.5 — roughly $0.80 / $4 per 1M tokens, ~10×
    // cheaper than Sonnet 4.6. Right pick while piloting.
    defaultGetter: () => process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
    type: 'string',
    group: 'AI / Anthropic',
    options: [
      {
        value: 'claude-haiku-4-5-20251001',
        label: 'Haiku 4.5 — cheapest (~$0.80 / $4 per 1M tokens)',
      },
      {
        value: 'claude-sonnet-4-6',
        label: 'Sonnet 4.6 — balanced (~$3 / $15 per 1M)',
      },
      {
        value: 'claude-opus-4-7',
        label: 'Opus 4.7 — strongest (~$15 / $75 per 1M)',
      },
      {
        value: 'claude-opus-4-8',
        label: 'Opus 4.8 — latest strongest (~$15 / $75 per 1M)',
      },
    ],
    coerce: (raw) => {
      const v = stringCoerce(raw);
      const allowed = [
        'claude-haiku-4-5-20251001',
        'claude-sonnet-4-6',
        'claude-opus-4-7',
        'claude-opus-4-8',
      ];
      if (v && !allowed.includes(v)) {
        throw {
          statusCode: 422,
          message: `claude_model must be one of: ${allowed.join(', ')}`,
        };
      }
      return v || 'claude-haiku-4-5-20251001';
    },
    format: stringCoerce,
  },

  // --- Buffer.com (social sharing for AI blog posts) ---------------
  // When set, the AI blog flow (cron + admin button) calls Buffer's
  // /1/updates/create.json with `now: true` after publishing a post,
  // sharing it across every social profile linked in the admin's
  // Buffer dashboard. Empty value disables the share step silently
  // (post still publishes; just nothing goes to Buffer).
  buffer_access_token: {
    label: 'Buffer access token',
    description:
      'Personal access token from buffer.com → Settings → Apps & Extras → Access Tokens (or any custom OAuth app). When set, freshly published AI blog posts are auto-shared to every linked Buffer profile via /1/updates/create.json. Leave empty to skip the share step.',
    defaultGetter: () => process.env.BUFFER_ACCESS_TOKEN || '',
    type: 'string',
    group: 'AI / Anthropic',
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
  // Side effects: drop caches that depend on this key so the change is
  // picked up on the next read without a process restart.
  if (key.startsWith('smtp_')) {
    try {
      // eslint-disable-next-line global-require
      require('./emailService').invalidateSmtpTransport();
    } catch {
      // Best-effort: emailService is optional during early bootstrap.
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

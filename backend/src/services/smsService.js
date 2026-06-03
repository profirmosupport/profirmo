// smsService — Ping4SMS gateway helper for transactional SMS (OTP).
//
// API contract (from the project spec):
//   GET https://site.ping4sms.com/api/smsapi
//     ?key=<API_KEY>
//     &route=2
//     &sender=PNGOTP
//     &number=<phone>
//     &sms=<message-with-{#var#}-already-replaced>
//     &templateid=1507165967974501361
//
// We construct the final `sms` body by replacing `{#var#}` with the
// 6-digit OTP value the caller provides. The phone number is sent as
// digits-only (Ping4SMS expects the local 10-digit form for India).
//
// Designed to be a thin wrapper: the OTP service decides WHEN to send,
// this module only knows HOW to send.

const env = require('../config/env');
const adminSettingsService = require('./adminSettingsService');

const PING4SMS_BASE = 'https://site.ping4sms.com/api/smsapi';

// The message template approved against templateid=1507165967974501361:
//   "Dear Customer, {#var#} is your verification code -PNGOTP"
// `{#var#}` is replaced with the OTP at send time.
const MESSAGE_TEMPLATE =
  'Dear Customer, {#var#} is your verification code -PNGOTP';
const PING4SMS_TEMPLATE_ID = '1507165967974501361';
const PING4SMS_SENDER = 'PNGOTP';
const PING4SMS_ROUTE = '2';

// Strip everything that isn't a digit; Ping4SMS only wants digits. India
// numbers in our DB sometimes carry the +91 prefix, sometimes don't —
// normalise to a digits-only string. We pass the 10-digit local form
// when the input matches +91xxxxxxxxxx, else send the full digit string.
function normaliseRecipient(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
  return digits;
}

// Resolve the API key from the admin settings registry first (so
// rotating the key via the admin UI takes effect without a redeploy),
// then fall back to the env-time default.
async function resolveApiKey() {
  try {
    const value = await adminSettingsService.getString('ping4smsApiKey');
    if (value) return value;
  } catch {
    /* fall through to env default */
  }
  return env.ping4sms && env.ping4sms.apiKey;
}

function isConfigured() {
  // Best-effort sync check used by callers that just want to surface a
  // banner ("SMS not configured"). The actual send-path re-resolves.
  return Boolean(env.ping4sms && env.ping4sms.apiKey);
}

/**
 * Send a 6-digit OTP via Ping4SMS. Returns { ok, providerResponse }.
 * Throws on transport errors or a non-2xx HTTP response.
 *
 * @param {string} phone  recipient phone number (any common format)
 * @param {string} code   6-digit OTP value
 */
async function sendOtpSms(phone, code) {
  const apiKey = await resolveApiKey();
  if (!apiKey) {
    throw {
      statusCode: 500,
      message: 'SMS provider is not configured.',
      code: 'SMS_NOT_CONFIGURED',
    };
  }
  const recipient = normaliseRecipient(phone);
  if (!recipient) {
    throw {
      statusCode: 422,
      message: 'Invalid phone number.',
      code: 'INVALID_PHONE',
    };
  }
  const message = MESSAGE_TEMPLATE.replace('{#var#}', String(code));
  const params = new URLSearchParams({
    key: apiKey,
    route: PING4SMS_ROUTE,
    sender: PING4SMS_SENDER,
    number: recipient,
    sms: message,
    templateid: PING4SMS_TEMPLATE_ID,
  });
  const url = `${PING4SMS_BASE}?${params.toString()}`;

  let res;
  try {
    res = await fetch(url, { method: 'GET' });
  } catch (err) {
    console.error('[smsService] Ping4SMS request failed', err && err.message);
    throw {
      statusCode: 502,
      message: 'Could not reach the SMS provider. Please try again.',
      code: 'SMS_PROVIDER_UNREACHABLE',
    };
  }
  const text = await res.text();
  if (!res.ok) {
    console.warn(
      '[smsService] Ping4SMS non-2xx response',
      res.status,
      text
    );
    throw {
      statusCode: 502,
      message: 'SMS provider rejected the request. Please try again.',
      code: 'SMS_PROVIDER_ERROR',
    };
  }
  // Ping4SMS returns a short ack string on success (e.g. an SMS id) and
  // an error keyword like "Invalid Apikey" / "Insufficient Balance" on
  // failure. Surface obvious failure keywords as errors.
  const lower = String(text || '').toLowerCase();
  const failed =
    lower.includes('invalid') ||
    lower.includes('error') ||
    lower.includes('insufficient') ||
    lower.includes('failed');
  if (failed) {
    console.warn('[smsService] Ping4SMS returned a failure response', text);
    throw {
      statusCode: 502,
      message: 'SMS provider rejected the request. Please try again.',
      code: 'SMS_PROVIDER_ERROR',
    };
  }
  return { ok: true, providerResponse: text };
}

module.exports = { sendOtpSms, isConfigured, normaliseRecipient };


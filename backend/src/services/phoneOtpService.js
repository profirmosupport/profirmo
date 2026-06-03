// phoneOtpService — wraps the PhoneOtpCode table + the Ping4SMS gateway
// to implement the phone-OTP flow shared by login, signup and change-
// phone.
//
// Spec (per project requirements):
//   • Generate a 6-digit numeric OTP on send.
//   • Persist it in the database against the recipient phone for 10
//     minutes.
//   • If a NON-expired, non-consumed OTP already exists for that phone +
//     purpose, RESEND the same OTP (do not generate a new one). This
//     matches the user expectation "resend same OTP if request within
//     10 mins".
//   • Verify on POST /api/auth/phone/verify-otp by comparing the user-
//     supplied code to the stored row.
//
// Public API:
//   sendOtp({ phone, purpose })
//   verifyOtp({ phone, purpose, code })       — checks but doesn't mark consumed
//   consumeOtp({ phone, purpose })            — marks the just-verified row
//                                               as consumed after a downstream
//                                               flow (login / signup) commits.

const { Op } = require('sequelize');
const crypto = require('crypto');
const { PhoneOtpCode } = require('../models');
const smsService = require('./smsService');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;

const ALLOWED_PURPOSES = new Set(['login', 'signup', 'change-phone']);

function genCode() {
  // crypto.randomInt is uniform over [0, 1_000_000)
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, '0');
}

function normalisePurpose(p) {
  const v = String(p || 'login').toLowerCase();
  return ALLOWED_PURPOSES.has(v) ? v : 'login';
}

// Find a live (non-expired, not consumed) OTP for this phone+purpose,
// most-recent first.
async function findLiveOtp(phone, purpose) {
  return PhoneOtpCode.findOne({
    where: {
      phone,
      purpose,
      consumedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
    order: [['createdAt', 'DESC']],
  });
}

/**
 * Send (or resend) a phone OTP.
 *
 * @param {object} opts
 * @param {string} opts.phone   — recipient phone (E.164 or local digits)
 * @param {string} opts.purpose — 'login' | 'signup' | 'change-phone'
 * @returns {Promise<{ phone: string, expiresAt: Date, resent: boolean }>}
 */
async function sendOtp({ phone, purpose }) {
  if (!phone) {
    throw {
      statusCode: 422,
      message: 'phone is required.',
      code: 'INVALID_PHONE',
    };
  }
  const p = normalisePurpose(purpose);

  // Reuse the existing live OTP if one exists in the 10-minute window —
  // the user just asked for another SMS, send the SAME code again.
  let row = await findLiveOtp(phone, p);
  let resent = false;
  if (row) {
    row.resendCount = (row.resendCount || 0) + 1;
    row.lastSentAt = new Date();
    await row.save();
    resent = true;
  } else {
    // Mint a fresh 6-digit OTP with a 10-minute lifetime.
    const code = genCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    row = await PhoneOtpCode.create({
      phone,
      purpose: p,
      code,
      expiresAt,
      lastSentAt: new Date(),
    });
  }

  // Deliver via Ping4SMS. If the provider rejects we throw — the OTP
  // row stays in place so a subsequent retry can reuse it.
  await smsService.sendOtpSms(phone, row.code);

  return {
    phone,
    expiresAt: row.expiresAt,
    resent,
    // Surfaced only to ease local testing — controller decides whether
    // to forward it (only in non-production environments).
    debugCode: row.code,
  };
}

/**
 * Verify a candidate OTP. Does NOT consume the row — call consumeOtp()
 * after the downstream flow (login / signup / change-phone) commits, so
 * a transient failure (e.g. duplicate email) leaves the OTP redeemable
 * on retry.
 *
 * @returns {Promise<{ ok: true } | never>} throws on failure
 */
async function verifyOtp({ phone, purpose, code }) {
  if (!phone || !code) {
    throw {
      statusCode: 422,
      message: 'phone and code are required.',
      code: 'OTP_INVALID',
    };
  }
  const p = normalisePurpose(purpose);
  const row = await findLiveOtp(phone, p);
  if (!row) {
    throw {
      statusCode: 400,
      message:
        'This OTP has expired or was never issued. Please request a new code.',
      code: 'OTP_EXPIRED',
    };
  }
  if (row.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    throw {
      statusCode: 429,
      message:
        'Too many incorrect attempts. Please request a new code.',
      code: 'OTP_ATTEMPTS_EXCEEDED',
    };
  }
  const candidate = String(code).replace(/[^0-9]/g, '').slice(0, 6);
  if (candidate !== row.code) {
    row.attemptCount = (row.attemptCount || 0) + 1;
    await row.save();
    const attemptsRemaining = Math.max(
      0,
      MAX_VERIFY_ATTEMPTS - row.attemptCount
    );
    throw {
      statusCode: 400,
      message: 'The code you entered is incorrect.',
      code: 'OTP_INCORRECT',
      data: { attemptsRemaining },
    };
  }
  row.verified = true;
  await row.save();
  return { ok: true };
}

/**
 * Mark the most recent verified OTP row as consumed. Call this after the
 * downstream login/signup/change-phone flow has committed its DB writes.
 * Idempotent — no-op when nothing is found.
 */
async function consumeOtp({ phone, purpose }) {
  const p = normalisePurpose(purpose);
  const row = await PhoneOtpCode.findOne({
    where: {
      phone,
      purpose: p,
      verified: true,
      consumedAt: null,
    },
    order: [['createdAt', 'DESC']],
  });
  if (!row) return;
  row.consumedAt = new Date();
  await row.save();
}

/**
 * Check whether a recent OTP for (phone, purpose) is currently in the
 * verified-but-not-yet-consumed state. Used by the downstream login /
 * signup flows to gate their endpoints — they expect the caller to have
 * just hit /verify-otp.
 */
async function hasVerifiedOtp({ phone, purpose }) {
  const p = normalisePurpose(purpose);
  const row = await PhoneOtpCode.findOne({
    where: {
      phone,
      purpose: p,
      verified: true,
      consumedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
    order: [['createdAt', 'DESC']],
  });
  return Boolean(row);
}

module.exports = {
  sendOtp,
  verifyOtp,
  consumeOtp,
  hasVerifiedOtp,
  OTP_TTL_MS,
  MAX_VERIFY_ATTEMPTS,
};

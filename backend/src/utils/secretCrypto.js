// secretCrypto — symmetric AES-256-GCM helper for protecting secrets at
// rest in the admin_settings table (and anywhere else we don't want to
// store provider tokens as plain text). The encryption key is derived
// deterministically from JWT_SECRET so we don't need a second secret to
// manage, but ciphertexts are tagged with a version prefix so we can
// rotate to a dedicated key in future without a destructive migration.
//
// Encoded format: `enc:v1:<base64(iv || tag || ciphertext)>` where
//   iv  = 12 random bytes (GCM standard)
//   tag = 16 bytes (GCM auth tag)
//   ciphertext = UTF-8 plaintext bytes
//
// Values without the `enc:v1:` prefix are treated as legacy plaintext and
// pass through unchanged — important so admin settings written before
// this helper existed (Razorpay, eCourts, etc.) keep resolving.

const crypto = require('crypto');
const env = require('../config/env');

const VERSION_TAG = 'enc:v1:';
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  // Derive a 32-byte key from JWT_SECRET. JWT_SECRET is already required
  // for the auth system, so reusing it avoids an additional environment
  // variable. SHA-256 normalises any length input to 32 bytes.
  const seed = String(env.jwtSecret || 'profirmo-fallback-secret');
  cachedKey = crypto.createHash('sha256').update(seed).digest();
  return cachedKey;
}

/**
 * Encrypt a UTF-8 string. Empty / nullish input → empty string so it is
 * indistinguishable from "not set" downstream.
 */
function encryptSecret(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return '';
  }
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, enc]).toString('base64');
  return `${VERSION_TAG}${payload}`;
}

/**
 * Decrypt an encoded value. Anything not starting with the version tag is
 * returned unchanged (legacy plaintext compatibility).
 */
function decryptSecret(stored) {
  if (!stored) return '';
  const s = String(stored);
  if (!s.startsWith(VERSION_TAG)) return s;
  let buf;
  try {
    buf = Buffer.from(s.slice(VERSION_TAG.length), 'base64');
  } catch {
    return '';
  }
  if (buf.length < IV_LEN + TAG_LEN + 1) return '';
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
      'utf8'
    );
  } catch {
    // Wrong key / tampered ciphertext — treat as not set so callers fall
    // back to defaults instead of crashing.
    return '';
  }
}

/** True if the encoded value carries our encryption version prefix. */
function isEncrypted(stored) {
  return typeof stored === 'string' && stored.startsWith(VERSION_TAG);
}

module.exports = { encryptSecret, decryptSecret, isEncrypted };

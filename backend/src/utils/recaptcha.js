// Server-side Google reCAPTCHA v2 verification for public forms.
//
// Enforcement is OPT-IN: it activates only when a secret key is configured
// (admin panel → reCAPTCHA setting, or the RECAPTCHA_SECRET_KEY env
// fallback), so environments without keys (local dev, or production before
// the key is provisioned) keep working with the form open. Once the secret
// AND the matching site key are set, submissions without a valid token are
// rejected.

const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

// Read the secret from the admin_settings registry (DB-first, env-default
// fallback baked into the setting's defaultGetter). Lazy-require to avoid a
// require cycle with the service layer.
async function getSecret() {
  try {
    // eslint-disable-next-line global-require
    const adminSettings = require('../services/adminSettingsService');
    const v = await adminSettings.getString('recaptcha_secret_key');
    if (v) return v;
  } catch {
    /* fall through to env */
  }
  return process.env.RECAPTCHA_SECRET_KEY || '';
}

// True when CAPTCHA enforcement is active (a secret is configured).
async function isEnabled() {
  return Boolean(await getSecret());
}

/**
 * Verify a reCAPTCHA v2 token with Google.
 *   - Returns true immediately when enforcement is disabled (no secret), so
 *     callers don't need to branch on config.
 *   - Returns false for a missing/invalid token or any verification error
 *     (fail-closed — a bot shouldn't slip through on a transient failure).
 *
 * @param {string} token    - the g-recaptcha-response from the client
 * @param {string} remoteIp - optional client IP (extra signal for Google)
 * @returns {Promise<boolean>}
 */
async function verifyToken(token, remoteIp) {
  const secret = await getSecret();
  if (!secret) return true; // enforcement disabled
  if (!token || typeof token !== 'string') return false;
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) params.append('remoteip', remoteIp);
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return Boolean(data && data.success);
  } catch (err) {
    console.warn('[reCAPTCHA] verification error:', (err && err.message) || err);
    return false;
  }
}

module.exports = { isEnabled, verifyToken };

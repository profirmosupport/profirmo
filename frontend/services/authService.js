// Authentication service — wraps the /api/auth endpoints.
// Every call returns the parsed `data` object from the API envelope
// `{ success, message, data }`.

import { get, post } from '@/services/api';

const ENDPOINTS = {
  login: '/api/auth/login',
  // Phone-OTP flow (replaces Firebase Phone Auth)
  sendPhoneOtp: '/api/auth/phone/send-otp',
  verifyPhoneOtp: '/api/auth/phone/verify-otp',
  phoneLogin: '/api/auth/phone-login',
  phoneSignup: '/api/auth/phone-signup',
  checkPhone: '/api/auth/check-phone',
  changePhone: '/api/auth/change-phone',
  signup: '/api/auth/signup',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout',
  me: '/api/auth/me',
  verifyEmail: '/api/auth/verify-email',
  resendVerification: '/api/auth/resend-verification',
  forgotPassword: '/api/auth/forgot-password',
  resendOtp: '/api/auth/resend-otp',
  verifyPasswordOtp: '/api/auth/verify-password-otp',
  resetPassword: '/api/auth/reset-password',
  claimInfo: '/api/auth/claim-info',
  claimAccount: '/api/auth/claim-account',
  // Legacy register endpoints still exist on the backend.
  registerClient: '/api/auth/register-client',
  registerProfessional: '/api/auth/register-professional',
  registerFirm: '/api/auth/register-firm',
  checkAvailability: '/api/auth/check-availability',
};

/** Unwrap the API envelope and return its `data` payload. */
function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

/**
 * Log in with email + password.
 * Sets the httpOnly pf_refresh cookie server-side.
 * @returns {Promise<{accessToken,token,user}>}
 */
export async function login(email, password) {
  const res = await post(ENDPOINTS.login, { email, password });
  return unwrap(res);
}

/**
 * Send a phone-OTP SMS. `purpose` is one of 'login' | 'signup' |
 * 'change-phone'. The backend reuses an existing live OTP (≤10 min)
 * when present so a "resend" request sends the SAME code, then ships it
 * to the user via Ping4SMS.
 *
 * @param {string} phone   recipient phone (E.164 or local digits)
 * @param {string} purpose 'login' | 'signup' | 'change-phone'
 * @returns {Promise<{ phone:string, expiresAt:string, resent:boolean }>}
 */
export async function sendPhoneOtp(phone, purpose) {
  const res = await post(ENDPOINTS.sendPhoneOtp, { phone, purpose });
  return unwrap(res);
}

/**
 * Verify a phone OTP. Throws when the code is wrong / expired — inspect
 * `err.payload.code` ('OTP_INCORRECT' | 'OTP_EXPIRED' |
 * 'OTP_ATTEMPTS_EXCEEDED') and `err.payload.data.attemptsRemaining`.
 *
 * @param {string} phone
 * @param {string} purpose
 * @param {string} code   6-digit OTP
 * @returns {Promise<{phone, purpose}>}
 */
export async function verifyPhoneOtp(phone, purpose, code) {
  const res = await post(ENDPOINTS.verifyPhoneOtp, { phone, purpose, code });
  return unwrap(res);
}

/**
 * Complete a phone-OTP login. Must be called immediately after a
 * successful verifyPhoneOtp({purpose:'login'}). Returns the standard
 * session payload.
 */
export async function loginWithPhone(phone) {
  const res = await post(ENDPOINTS.phoneLogin, { phone });
  return unwrap(res);
}

/**
 * Phone existence lookup — used before sending an OTP on the sign-in page
 * to route unregistered numbers to signup instead of burning an SMS.
 * @param {string} phone E.164 phone string
 * @returns {Promise<{ exists: boolean }>}
 */
export async function checkPhone(phone) {
  const res = await post(ENDPOINTS.checkPhone, { phone });
  return unwrap(res);
}

/**
 * Complete the phone-first signup wizard. Must be called immediately
 * after a successful verifyPhoneOtp({purpose:'signup'}).
 */
export async function signupWithPhone(payload) {
  const res = await post(ENDPOINTS.phoneSignup, payload);
  return unwrap(res);
}

/**
 * Change the logged-in user's mobile number. Must be called immediately
 * after verifyPhoneOtp({purpose:'change-phone'}) for the new number.
 */
export async function changePhone(phone) {
  const res = await post(ENDPOINTS.changePhone, { phone });
  return unwrap(res);
}

/**
 * Create a new account.
 * As of the email-verification flow, signup does NOT return a token and does
 * NOT log the user in — verification is required first.
 * @param {Object} data - { firstName, lastName, email, mobileNumber, password, role }
 *   role is one of 'client' | 'professional' | 'law_firm'.
 * @returns {Promise<{user, emailVerificationRequired}>}
 */
export async function signup(data) {
  const res = await post(ENDPOINTS.signup, data);
  return unwrap(res);
}

/**
 * Verify an email address with the token from the verification link.
 * On success the backend sets the httpOnly refresh cookie and returns an
 * access token — i.e. it auto-logs the user in.
 * @param {string} token - the verification token from the email link
 * @returns {Promise<{accessToken,token,user}>}
 */
export async function verifyEmail(token) {
  const res = await post(ENDPOINTS.verifyEmail, { token });
  return unwrap(res);
}

/**
 * Request a fresh verification email. Always resolves with a generic message
 * regardless of whether the email exists.
 * @param {string} email
 * @returns {Promise<{success,message}>}
 */
export async function resendVerification(email) {
  return post(ENDPOINTS.resendVerification, { email });
}

/**
 * Fetch the email + display name attached to a client-invitation token, so
 * the claim page can pre-fill the form. Throws on expired / invalid tokens.
 * @param {string} token
 * @returns {Promise<{email,name,role}>}
 */
export async function getClaimInfo(token) {
  const res = await get(ENDPOINTS.claimInfo, { params: { token } });
  return unwrap(res);
}

/**
 * Submit the client-claim form. On success the backend sets the refresh
 * cookie and returns an access token — i.e. it auto-logs the user in.
 * @param {{token,password,fullName?}} payload
 * @returns {Promise<{accessToken,token,user}>}
 */
export async function claimAccount({ token, password, fullName }) {
  const res = await post(ENDPOINTS.claimAccount, { token, password, fullName });
  return unwrap(res);
}

/**
 * Silently restore the session using the httpOnly refresh cookie.
 * Throws if there is no/expired session (HTTP 401).
 * @returns {Promise<{accessToken,token,user}>}
 */
export async function refresh() {
  const res = await post(ENDPOINTS.refresh);
  return unwrap(res);
}

/**
 * Log out — clears the refresh cookie server-side.
 * @returns {Promise<{success,message}>}
 */
export async function logout() {
  return post(ENDPOINTS.logout);
}

/**
 * Fetch the currently authenticated user.
 * Uses the held access token unless an explicit one is given.
 * @returns {Promise<{user}>}
 */
export async function getMe(token) {
  const res = await get(ENDPOINTS.me, token !== undefined ? { token } : {});
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Password-reset flow (email OTP).
// ---------------------------------------------------------------------------

/**
 * Request a password-reset OTP for the given email. The backend always
 * resolves with a generic message regardless of whether the account exists.
 * @param {string} email
 * @returns {Promise<*>} the parsed `data` payload (may be null)
 */
export async function forgotPassword(email) {
  const res = await post(ENDPOINTS.forgotPassword, { email });
  return unwrap(res);
}

/**
 * Request a fresh password-reset OTP. Throws HTTP 429 if within the
 * 60-second cooldown or once the 5-resend cap is reached.
 * @param {string} email
 * @returns {Promise<*>} the parsed `data` payload (may be null)
 */
export async function resendOtp(email) {
  const res = await post(ENDPOINTS.resendOtp, { email });
  return unwrap(res);
}

/**
 * Verify a 6-digit password-reset OTP.
 * On success returns `{ resetToken }`. On failure throws — inspect
 * `err.payload.code` ('OTP_INVALID' | 'OTP_INCORRECT' | 'OTP_ATTEMPTS_EXCEEDED')
 * and `err.payload.data.attemptsRemaining`.
 * @param {string} email
 * @param {string} otp - 6-digit code
 * @returns {Promise<{resetToken:string}>}
 */
export async function verifyPasswordOtp(email, otp) {
  const res = await post(ENDPOINTS.verifyPasswordOtp, { email, otp });
  return unwrap(res);
}

/**
 * Complete a password reset with the token from verifyPasswordOtp.
 * On failure throws — `422` carries `err.payload.errors.newPassword`,
 * `401`/`400` mean the reset session is stale/expired.
 * @param {Object} payload - { resetToken, newPassword, confirmPassword }
 * @returns {Promise<*>} the parsed `data` payload (may be null)
 */
export async function resetPassword({ resetToken, newPassword, confirmPassword }) {
  const res = await post(ENDPOINTS.resetPassword, {
    resetToken,
    newPassword,
    confirmPassword,
  });
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Backward-compatible legacy exports.
// Older pages call registerClient/registerProfessional/registerFirm — map them
// onto the unified signup flow so they keep working against the new contract.
// ---------------------------------------------------------------------------

const LEGACY_ROLE = {
  client: 'client',
  professional: 'professional',
  firm: 'law_firm',
};

/** Normalise a legacy register payload into the signup contract. */
function toSignupPayload(data = {}, role) {
  // Already in the new shape — pass straight through.
  if (data.firstName || data.lastName || data.mobileNumber) {
    return { role, ...data };
  }
  // Map a legacy { name, phone, ... } payload.
  const name = (data.name || data.adminName || '').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || name || '',
    lastName: parts.slice(1).join(' ') || '',
    email: data.email || '',
    mobileNumber: data.mobileNumber || data.phone || '',
    password: data.password || '',
    role,
  };
}

export async function registerClient(data) {
  return signup(toSignupPayload(data, LEGACY_ROLE.client));
}

/**
 * Register a professional with the full Phase-7 payload.
 * Hits POST /api/auth/register-professional. This does NOT return a token and
 * does NOT log the user in — email verification + admin approval are required.
 * @param {Object} payload - the full professional registration payload
 *   (personal + professional details, nested `legal` or `tax`, file URLs).
 * @returns {Promise<{user, emailVerificationRequired, approvalStatus}>}
 */
/**
 * Check whether an email and/or phone is already linked to an existing
 * account. Used by the signup wizard before it tries to create the user
 * so we can show "account exists, login or recover" early.
 *
 * @param {{email?: string, mobileNumber?: string}} payload
 * @returns {Promise<{emailTaken,mobileTaken,takenBy}>}
 */
export async function checkAvailability(payload) {
  const res = await post(ENDPOINTS.checkAvailability, payload);
  return unwrap(res);
}

export async function registerProfessional(payload) {
  const res = await post(ENDPOINTS.registerProfessional, payload);
  return unwrap(res);
}

export async function registerFirm(data) {
  return signup(toSignupPayload(data, LEGACY_ROLE.firm));
}

export default {
  login,
  sendPhoneOtp,
  verifyPhoneOtp,
  loginWithPhone,
  signupWithPhone,
  checkPhone,
  changePhone,
  signup,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resendOtp,
  verifyPasswordOtp,
  resetPassword,
  refresh,
  logout,
  getMe,
  registerClient,
  registerProfessional,
  registerFirm,
  checkAvailability,
};

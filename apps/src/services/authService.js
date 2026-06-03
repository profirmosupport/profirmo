// Auth API — login / signup / me / logout. Mirrors the web frontend's
// /api/auth surface; the backend rejects 'platform_admin' for self-
// service signup so the mobile-only client/professional roles are safe.

import { apiGet, apiPost, unwrap } from './api';

export async function login(email, password) {
  const res = await apiPost('/api/auth/login', { email, password });
  return unwrap(res);
}

export async function signup({
  firstName,
  lastName,
  email,
  password,
  role,
  mobileNumber,
}) {
  const res = await apiPost('/api/auth/signup', {
    firstName,
    lastName,
    email,
    password,
    role,
    mobileNumber: mobileNumber || undefined,
  });
  return unwrap(res);
}

export async function getMe() {
  const res = await apiGet('/api/auth/me');
  return unwrap(res);
}

export async function logout() {
  try {
    await apiPost('/api/auth/logout');
  } catch {
    /* logout is best-effort — local token clearing is the source of truth */
  }
}

export async function forgotPassword(email) {
  const res = await apiPost('/api/auth/forgot-password', { email });
  return unwrap(res);
}

// --- Phone OTP (Ping4SMS) -------------------------------------------------
// Mirrors the web's flow. `purpose` is one of 'login' | 'signup' |
// 'change-phone'. The backend re-sends the SAME code when a non-expired
// row exists for the same (phone, purpose), so a retry within 10 min
// doesn't mint a new OTP.

export async function sendPhoneOtp(phone, purpose) {
  const res = await apiPost('/api/auth/phone/send-otp', { phone, purpose });
  return unwrap(res);
}

export async function verifyPhoneOtp(phone, purpose, code) {
  const res = await apiPost('/api/auth/phone/verify-otp', {
    phone,
    purpose,
    code,
  });
  return unwrap(res);
}

// Complete phone-OTP LOGIN — must follow a successful verifyPhoneOtp
// with purpose='login' for the same number within 10 minutes.
export async function loginWithPhone(phone) {
  const res = await apiPost('/api/auth/phone-login', { phone });
  return unwrap(res);
}

// Complete phone-first SIGNUP — must follow a successful verifyPhoneOtp
// with purpose='signup' for the same number within 10 minutes.
export async function signupWithPhone({
  phone,
  firstName,
  lastName,
  email,
  role,
}) {
  const res = await apiPost('/api/auth/phone-signup', {
    phone,
    firstName,
    lastName,
    email,
    role,
  });
  return unwrap(res);
}

// Public phone-existence lookup — used before sending an OTP so the
// login screen can route unregistered numbers to signup.
export async function checkPhone(phone) {
  const res = await apiPost('/api/auth/check-phone', { phone });
  return unwrap(res);
}

// Professional registration — the richer signup path that creates a
// user + ProfessionalDetail + a pending ProfessionalApproval row. The
// backend validates per-type required fields and surfaces field
// errors via the `errors` map on a 422.
export async function registerProfessional(payload) {
  const res = await apiPost('/api/auth/register-professional', payload);
  return unwrap(res);
}

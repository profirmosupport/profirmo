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

// Professional registration — the richer signup path that creates a
// user + ProfessionalDetail + a pending ProfessionalApproval row. The
// backend validates per-type required fields and surfaces field
// errors via the `errors` map on a 422.
export async function registerProfessional(payload) {
  const res = await apiPost('/api/auth/register-professional', payload);
  return unwrap(res);
}

// Profile service — wraps the user-facing profile endpoints.
//   GET  /api/profile         current user's complete profile
//   PUT  /api/profile         update personal info + address (no phone)
//
// `mobileNumber` is intentionally NOT updateable here — the backend
// drops it from the writable field list. Phone changes go through
// /api/auth/change-phone, which requires an OTP-verified new number
// and rejects numbers already in use by another account.

import { apiGet, apiPut, unwrap } from './api';

export async function getMyProfile() {
  const res = await apiGet('/api/profile');
  return unwrap(res);
}

export async function updateMyProfile(payload) {
  const res = await apiPut('/api/profile', payload);
  return unwrap(res);
}

// PUT /api/profile/professional — upsert the caller's professional
// detail row (designation, experience, fee, bio, languages, documents,
// etc.). Only available to users with role='professional'. Returns
// the refreshed complete profile.
export async function updateMyProfessionalProfile(payload) {
  const res = await apiPut('/api/profile/professional', payload);
  return unwrap(res);
}

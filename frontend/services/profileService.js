// Profile service — wraps the /api/profile and /api/law-firm endpoints.
// Every call returns the parsed `data` object from the API envelope
// `{ success, message, data }`. The access token is attached automatically
// by api.js, so callers never pass tokens here.

import { apiRequest, get, post, del } from '@/services/api';

/** Unwrap the API envelope and return its `data` payload. */
function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/**
 * Fetch the current user's full profile.
 * @returns {Promise<{user,address,professionalDetail,lawyerDetail,techDetail,lawFirm,profileCompletion}>}
 */
export async function getProfile() {
  const res = await get('/api/profile');
  return unwrap(res);
}

/**
 * Update personal information + address.
 * @param {Object} data - { firstName, lastName, mobileNumber, profilePhoto?,
 *                           coverPhoto?, address: {...} }
 * @returns {Promise<Object>} refreshed profile
 */
export async function updateProfile(data) {
  const res = await apiRequest('/api/profile', { method: 'PUT', body: data });
  return unwrap(res);
}

/**
 * Update professional details (professional / firm_professional only).
 * Send a `lawyer` object when professionalType is 'Lawyer' and a `tech`
 * object when professionalType is 'Tech Consultant'.
 * @returns {Promise<Object>} refreshed profile
 */
export async function updateProfessionalDetails(data) {
  const res = await apiRequest('/api/profile/professional', {
    method: 'PUT',
    body: data,
  });
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Law firm
// ---------------------------------------------------------------------------

/**
 * Fetch the firm owned by the current firm_admin and its members.
 * @returns {Promise<{lawFirm: Object|null, members: Array}>}
 */
export async function getLawFirm() {
  const res = await get('/api/law-firm/mine');
  return unwrap(res);
}

/**
 * Create a new law firm (firm_admin).
 * @returns {Promise<Object>}
 */
export async function createLawFirm(data) {
  const res = await post('/api/law-firm', data);
  return unwrap(res);
}

/**
 * Update the current firm_admin's law firm.
 * @returns {Promise<Object>}
 */
export async function updateLawFirm(data) {
  const res = await apiRequest('/api/law-firm/mine', {
    method: 'PUT',
    body: data,
  });
  return unwrap(res);
}

/**
 * Add a member to the firm (deprecated — superseded by invitations).
 * @param {{email:string, role:string}} payload
 * @returns {Promise<Object>}
 */
export async function addFirmMember({ email, role }) {
  const res = await post('/api/law-firm/mine/members', { email, role });
  return unwrap(res);
}

/**
 * Send a firm invitation to a professional. The invitee must register as a
 * professional first; once they accept, they join the firm as a member.
 * @param {{email:string, role?:string, message?:string}} payload
 * @returns {Promise<Object>}
 */
export async function createFirmInvitation({ email, role, message }) {
  const res = await post('/api/law-firm/mine/invitations', {
    email,
    role: role || 'member',
    message,
  });
  return unwrap(res);
}

/**
 * Update a firm member's role / status.
 * @param {string} id - member id
 * @param {{role?:string, status?:string}} payload
 * @returns {Promise<Object>}
 */
export async function updateFirmMember(id, { role, status }) {
  const res = await apiRequest(`/api/law-firm/mine/members/${id}`, {
    method: 'PUT',
    body: { role, status },
  });
  return unwrap(res);
}

/**
 * Remove a firm member.
 * @param {string} id - member id
 * @returns {Promise<Object>}
 */
export async function removeFirmMember(id) {
  const res = await del(`/api/law-firm/mine/members/${id}`);
  return unwrap(res);
}

export default {
  getProfile,
  updateProfile,
  updateProfessionalDetails,
  getLawFirm,
  createLawFirm,
  updateLawFirm,
  addFirmMember,
  createFirmInvitation,
  updateFirmMember,
  removeFirmMember,
};

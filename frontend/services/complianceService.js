// complianceService — wraps /api/compliance/* for client-side
// compliance profile + obligation flows.

import { get, put, post, patch, API_BASE_URL, getAccessToken } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

export async function getProfile(clientUserId) {
  const res = await get(
    `/api/compliance/profiles/${encodeURIComponent(clientUserId)}`
  );
  return unwrap(res);
}

export async function saveProfile(clientUserId, payload) {
  const res = await put(
    `/api/compliance/profiles/${encodeURIComponent(clientUserId)}`,
    payload
  );
  return unwrap(res);
}

/** Materialise upcoming obligations from the profile + rules JSON. */
export async function generateForClient(clientUserId) {
  const res = await post(
    `/api/compliance/profiles/${encodeURIComponent(clientUserId)}/generate`,
    {}
  );
  return unwrap(res);
}

/**
 * List upcoming obligations across every client. Used by the
 * dashboard calendar overlay + the compliance overview page.
 */
export async function listObligations({ from, to, status } = {}) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  if (status) params.status = status;
  const res = await get('/api/compliance/obligations', { params });
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}

export async function updateObligation(id, payload) {
  const res = await patch(
    `/api/compliance/obligations/${encodeURIComponent(id)}`,
    payload
  );
  return unwrap(res);
}

/** Upload an optional supporting document for an obligation. */
export async function uploadObligationAttachment(id, file) {
  const fd = new FormData();
  fd.append('file', file);
  const token = getAccessToken();
  const resp = await fetch(
    `${API_BASE_URL}/api/compliance/obligations/${encodeURIComponent(id)}/attachment`,
    {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: fd,
    }
  );
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.message || 'Upload failed');
  return unwrap(json);
}

export async function getObligationAttachmentUrl(id) {
  const res = await get(
    `/api/compliance/obligations/${encodeURIComponent(id)}/attachment/url`
  );
  return unwrap(res);
}

// --- Entity-type requirements catalog -------------------------------

export async function getRequirements(entityType) {
  if (!entityType) return null;
  const res = await get(
    `/api/compliance/requirements/${encodeURIComponent(entityType)}`
  );
  return unwrap(res);
}

// --- Client self-service -------------------------------------------

export async function getMyProfile() {
  const res = await get('/api/compliance/profile/me');
  return unwrap(res);
}

export async function saveMyProfile(payload) {
  const res = await put('/api/compliance/profile/me', payload);
  return unwrap(res);
}

export async function listMyObligations({ from, to, status } = {}) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  if (status) params.status = status;
  const res = await get('/api/compliance/obligations/me', { params });
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}

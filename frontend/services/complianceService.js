// complianceService — wraps /api/compliance/* for client-side
// compliance profile + obligation flows.

import { get, put, post, patch } from '@/services/api';

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

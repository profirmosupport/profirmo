// firmJoinService — wraps the /api/firm-join endpoints. Mobile-side
// mirror of frontend/services/firmJoinService.js, so the pro firm
// screen can read/leave membership in the same way the web does.

import { apiGet, apiPost, unwrap } from './api';

/** The caller's current firm membership ({ firm, member }) or null. */
export async function getMyMembership() {
  const res = await apiGet('/api/firm-join/membership');
  return unwrap(res);
}

/** ACTIVE law firms the caller can request to join. */
export async function listJoinableFirms() {
  const res = await apiGet('/api/firm-join/joinable');
  return unwrap(res) || [];
}

/** The caller's own join requests (newest first). */
export async function listMyRequests() {
  const res = await apiGet('/api/firm-join/requests/mine');
  return unwrap(res) || [];
}

/** Send a join request to a firm. */
export async function requestJoin(firmId, message) {
  const res = await apiPost('/api/firm-join/requests', { firmId, message });
  return unwrap(res);
}

/** Cancel a pending join request. */
export async function cancelRequest(id) {
  const res = await apiPost(`/api/firm-join/requests/${id}/cancel`, {});
  return unwrap(res);
}

/** Leave the firm the caller belongs to. Owners cannot leave. */
export async function leaveFirm() {
  const res = await apiPost('/api/firm-join/leave', {});
  return unwrap(res);
}

/** Join requests for the firm the caller owns ({ firm, requests }). */
export async function listFirmRequests() {
  const res = await apiGet('/api/firm-join/requests/firm');
  return unwrap(res);
}

/** Approve or reject a join request. `decision` is 'approve' | 'reject'. */
export async function decideRequest(id, decision) {
  const res = await apiPost(`/api/firm-join/requests/${id}/decide`, {
    decision,
  });
  return unwrap(res);
}

export default {
  getMyMembership,
  listJoinableFirms,
  listMyRequests,
  requestJoin,
  cancelRequest,
  leaveFirm,
  listFirmRequests,
  decideRequest,
};

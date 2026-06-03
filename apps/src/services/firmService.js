import { apiGet, unwrap } from './api';

// Firm-side helpers — the professional sees firm members + cases when
// they own or co-own a firm. The public read helpers below power the
// guest-facing firm directory + detail screens.

// Public — fetch a single firm by id. Returns the unwrapped detail
// object (firmName, logo, contactEmail, contactNumber, website, etc.).
export async function getFirm(id) {
  const res = await apiGet(`/api/firms/${id}`);
  return unwrap(res);
}

// Public — fetch all professionals belonging to a firm.
export async function listFirmProfessionals(id) {
  const res = await apiGet(`/api/firms/${id}/professionals`);
  const data = unwrap(res);
  return (data && data.items) || data || [];
}

export async function getMyFirm() {
  const res = await apiGet('/api/firms/mine');
  return unwrap(res);
}

export async function listFirmMembers(firmId) {
  const res = await apiGet(`/api/firms/${firmId}/members`);
  const data = unwrap(res);
  return (data && data.items) || data || [];
}

export async function listFirmInvitations() {
  const res = await apiGet('/api/firm-invitations/mine');
  const data = unwrap(res);
  return (data && data.items) || data || [];
}

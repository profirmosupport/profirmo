import { apiGet, unwrap } from './api';

// Firm-side helpers — the professional sees firm members + cases when
// they own or co-own a firm.

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

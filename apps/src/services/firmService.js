import { apiGet, apiPost, unwrap } from './api';

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

// The caller's firm + members + role + approval. Same endpoint the
// web's getLawFirm() uses; works for any firm member (owner / co-owner
// / member), not just the owner of a public firm row.
export async function getMyFirm() {
  const res = await apiGet('/api/law-firm/mine');
  return unwrap(res);
}

export async function listFirmMembers() {
  const res = await apiGet('/api/law-firm/mine/members');
  const data = unwrap(res);
  return (data && (data.items || data.members)) || data || [];
}

export async function listFirmInvitations() {
  const res = await apiGet('/api/firm-invitations/mine');
  const data = unwrap(res);
  return (data && data.items) || data || [];
}

// Create the caller's law firm. Backend gates on the caller being an
// approved professional. Returns { lawFirm, approval }.
export async function createMyFirm(payload) {
  const res = await apiPost('/api/law-firm', payload);
  return unwrap(res);
}

// Firm-side: clients across firm members' cases. Same endpoint the
// web's getLawFirmClients() hits.
export async function listFirmClients() {
  const res = await apiGet('/api/law-firm/mine/clients');
  const data = unwrap(res);
  return (data && (data.items || data.clients)) || data || [];
}

// Firm-side: cases across every firm member. Backend returns
// { items, firmId }.
export async function listFirmCases() {
  const res = await apiGet('/api/cases/firm');
  const data = unwrap(res);
  return (data && data.items) || data || [];
}

// Firm-side: reviews aggregated across firm members.
export async function listFirmReviewsForOwner() {
  const res = await apiGet('/api/law-firm/mine/reviews');
  const data = unwrap(res);
  return (data && (data.items || data.reviews)) || data || [];
}

// Firm-owner only: leads captured for the firm's owned professionals.
export async function listMyFirmLeads() {
  const res = await apiGet('/api/law-firm/mine/leads');
  const data = unwrap(res);
  return (data && data.leads) || [];
}

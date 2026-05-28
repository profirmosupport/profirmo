// leadService — wrappers for the public lead-capture + cookie-check
// endpoints and the admin CRUD / activity / conversion endpoints.

import { get, post, patch, del } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

// --- Public --------------------------------------------------------------

export async function submitLead({
  fullName,
  email,
  phone,
  source,
  message,
  firmId,
}) {
  const res = await post('/api/leads', {
    fullName,
    email,
    phone,
    source,
    message,
    firmId,
  });
  return unwrap(res);
}

// Firm-only: list the inquiries submitted via the firm-profile "Contact firm"
// modal. Auth-gated on the backend (only the firm owner / member sees these).
export async function listMyFirmLeads() {
  const res = await get('/api/law-firm/mine/leads');
  const data = unwrap(res);
  return (data && data.leads) || [];
}

// Firm-only: convert a lead into a firm client. Reuses an existing client-user
// matched by email/phone server-side, or creates one fresh.
export async function addLeadAsClient(leadId) {
  const res = await post(`/api/law-firm/mine/leads/${leadId}/add-client`, {});
  return unwrap(res);
}

export async function fetchMyLeadStatus() {
  try {
    const res = await get('/api/leads/me');
    const data = unwrap(res);
    return Boolean(data && data.hasLead);
  } catch {
    return false;
  }
}

// --- Admin: leads --------------------------------------------------------

export async function adminListLeads(params = {}) {
  const res = await get('/api/admin/leads', { params });
  return {
    data: (res && res.data) || [],
    meta: (res && res.meta) || null,
  };
}

export async function adminGetLead(id) {
  const res = await get(`/api/admin/leads/${id}`);
  return unwrap(res);
}

export async function adminCreateLead(payload) {
  const res = await post('/api/admin/leads', payload);
  return unwrap(res);
}

export async function adminUpdateLead(id, changes) {
  const res = await patch(`/api/admin/leads/${id}`, changes);
  return unwrap(res);
}

export async function adminDeleteLead(id) {
  const res = await del(`/api/admin/leads/${id}`);
  return unwrap(res);
}

export async function adminListLeadActivities(id) {
  const res = await get(`/api/admin/leads/${id}/activities`);
  return unwrap(res) || [];
}

export async function adminAddLeadNote(id, message) {
  const res = await post(`/api/admin/leads/${id}/notes`, { message });
  return unwrap(res);
}

export async function adminConvertLead(id) {
  const res = await post(`/api/admin/leads/${id}/convert`);
  return unwrap(res);
}

// --- Admin: opportunities ------------------------------------------------

export async function adminListOpportunities(params = {}) {
  const res = await get('/api/admin/opportunities', { params });
  return {
    data: (res && res.data) || [],
    meta: (res && res.meta) || null,
  };
}

export async function adminGetOpportunity(id) {
  const res = await get(`/api/admin/opportunities/${id}`);
  return unwrap(res);
}

export async function adminUpdateOpportunity(id, changes) {
  const res = await patch(`/api/admin/opportunities/${id}`, changes);
  return unwrap(res);
}

export async function adminDeleteOpportunity(id) {
  const res = await del(`/api/admin/opportunities/${id}`);
  return unwrap(res);
}

export async function adminListOpportunityActivities(id) {
  const res = await get(`/api/admin/opportunities/${id}/activities`);
  return unwrap(res) || [];
}

export async function adminAddOpportunityNote(id, message) {
  const res = await post(`/api/admin/opportunities/${id}/notes`, { message });
  return unwrap(res);
}

export async function adminConvertOpportunity(id) {
  const res = await post(`/api/admin/opportunities/${id}/convert`);
  return unwrap(res);
}

export const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Qualified',
  'Opportunity',
  'Converted',
];

export const OPPORTUNITY_STATUSES = [
  'Open',
  'In Discussion',
  'Won',
  'Lost',
  'Converted',
];

export default {
  submitLead,
  fetchMyLeadStatus,
  adminListLeads,
  adminGetLead,
  adminCreateLead,
  adminUpdateLead,
  adminDeleteLead,
  adminListLeadActivities,
  adminAddLeadNote,
  adminConvertLead,
  adminListOpportunities,
  adminGetOpportunity,
  adminUpdateOpportunity,
  adminDeleteOpportunity,
  adminListOpportunityActivities,
  adminAddOpportunityNote,
  adminConvertOpportunity,
  LEAD_STATUSES,
  OPPORTUNITY_STATUSES,
};

// clientService — wraps /api/clients. Mobile mirror of the web's
// clientService. Clients are first-class users (role='client'); the
// API returns `{ id, name, email, phone, city, ... }` envelopes
// scoped to the caller's professional links.

import { apiGet, apiPost, apiPut, unwrap } from './api';

export async function listClients() {
  const res = await apiGet('/api/clients');
  const data = unwrap(res);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return data || [];
}

export async function getClient(id) {
  const res = await apiGet(`/api/clients/${id}`);
  return unwrap(res);
}

// Create-or-link: backend matches on phone/email and reuses an existing
// user-row when one is found.
export async function createClient(payload) {
  const res = await apiPost('/api/clients', payload);
  return unwrap(res);
}

// Link an existing client user to the calling professional.
export async function linkExistingClient(userId) {
  const res = await apiPost(`/api/clients/${userId}/link`, {});
  return unwrap(res);
}

export async function updateClient(id, payload) {
  const res = await apiPut(`/api/clients/${id}`, payload);
  return unwrap(res);
}

export async function searchClientByPhone(phone) {
  const qs = `?phone=${encodeURIComponent(phone || '')}`;
  const res = await apiGet(`/api/clients/search-by-phone${qs}`);
  return unwrap(res) || { user: null };
}

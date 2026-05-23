// Client service — wraps the /api/clients endpoints. Clients are first-class
// users (role='client'); the API returns the legacy `{ id, name, email,
// phone, city }` envelope so existing consumers continue to work, but `id`
// is now a real users.id and the same client can be linked with multiple
// professionals (link table: professional_clients).

import { get, post, patch } from '@/services/api';
import { API_ENDPOINTS } from '@/utils/constants';

const BASE = API_ENDPOINTS.clients;

function unwrap(res) {
  if (res && Object.prototype.hasOwnProperty.call(res, 'data')) {
    return res.data;
  }
  return res;
}

/** List clients (scoped to the caller's links when called as a professional). */
export function getAll(params = {}) {
  return get(BASE, { params });
}

/** Fetch a single client by id. */
export async function getById(id) {
  const res = await get(`${BASE}/${id}`);
  return unwrap(res);
}

/** Create a new client. Always reuses an existing user matched by phone/email. */
export async function create(data) {
  const res = await post(BASE, data);
  return unwrap(res);
}

/** Link an existing client-user to the calling professional. */
export async function linkExisting(userId) {
  const res = await post(`${BASE}/${userId}/link`, {});
  return unwrap(res);
}

/** Update an existing client (the underlying user row). */
export async function update(id, data) {
  const res = await patch(`${BASE}/${id}`, data);
  return unwrap(res);
}

/**
 * Look up an existing platform user by phone. Returns `{ user }` — null when
 * no user matches. The Add-Client UI uses this for find-or-create.
 */
export async function searchByPhone(phone) {
  const res = await get(`${BASE}/search-by-phone`, { params: { phone } });
  return unwrap(res) || { user: null };
}

export default { getAll, getById, create, linkExisting, update, searchByPhone };

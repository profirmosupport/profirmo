// Client service — wraps the /api/clients endpoints.

import { get, post, patch } from '@/services/api';
import { API_ENDPOINTS } from '@/utils/constants';

const BASE = API_ENDPOINTS.clients;

/** List clients, optionally filtered via query params. */
export function getAll(params = {}) {
  return get(BASE, { params });
}

/** Fetch a single client by id. */
export function getById(id) {
  return get(`${BASE}/${id}`);
}

/** Create a new client (auth required). */
export function create(data, token) {
  return post(BASE, data, { token });
}

/** Update an existing client (auth required). */
export function update(id, data, token) {
  return patch(`${BASE}/${id}`, data, { token });
}

export default { getAll, getById, create, update };

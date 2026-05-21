// Case service — wraps the /api/cases endpoints.

import { get, post, patch, del } from '@/services/api';
import { API_ENDPOINTS } from '@/utils/constants';

const BASE = API_ENDPOINTS.cases;

/** List cases, optionally filtered via query params. */
export function getAll(params = {}) {
  return get(BASE, { params });
}

/** Fetch a single case by id. */
export function getById(id) {
  return get(`${BASE}/${id}`);
}

/** Create a new case (auth required). */
export function create(data, token) {
  return post(BASE, data, { token });
}

/** Update an existing case (auth required). */
export function update(id, data, token) {
  return patch(`${BASE}/${id}`, data, { token });
}

/** Delete a case (auth required). */
export function remove(id, token) {
  return del(`${BASE}/${id}`, { token });
}

/** Fetch all cases for a given client. */
export function getByClient(clientId) {
  return get(BASE, { params: { clientId } });
}

/** Fetch all cases for a given professional. */
export function getByProfessional(professionalId) {
  return get(BASE, { params: { professionalId } });
}

export default {
  getAll,
  getById,
  create,
  update,
  remove,
  getByClient,
  getByProfessional,
};

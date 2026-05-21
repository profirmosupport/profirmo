// Firm service — wraps the /api/firms endpoints.

import { get, post } from '@/services/api';
import { API_ENDPOINTS } from '@/utils/constants';

const BASE = API_ENDPOINTS.firms;

/** List firms, optionally filtered via query params. */
export function getAll(params = {}) {
  return get(BASE, { params });
}

/** Fetch a single firm by id. */
export function getById(id) {
  return get(`${BASE}/${id}`);
}

/** Fetch all professionals belonging to a firm. */
export function getProfessionals(id) {
  return get(`${BASE}/${id}/professionals`);
}

/** Fetch all clients associated with a firm. */
export function getClients(id) {
  return get(`${BASE}/${id}/clients`);
}

/** Fetch all cases associated with a firm. */
export function getCases(id) {
  return get(`${BASE}/${id}/cases`);
}

/** Add a professional to a firm (auth required). */
export function addProfessional(id, data, token) {
  return post(`${BASE}/${id}/professionals`, data, { token });
}

export default {
  getAll,
  getById,
  getProfessionals,
  getClients,
  getCases,
  addProfessional,
};

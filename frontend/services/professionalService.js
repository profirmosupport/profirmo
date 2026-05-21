// Professional service — wraps the /api/professionals endpoints.

import { get, patch } from '@/services/api';
import { API_ENDPOINTS } from '@/utils/constants';

const BASE = API_ENDPOINTS.professionals;

/** List professionals, optionally filtered/sorted via query params. */
export function getAll(params = {}) {
  return get(BASE, { params });
}

/** Fetch a single professional by id. */
export function getById(id) {
  return get(`${BASE}/${id}`);
}

/** Search professionals by a free-text query string. */
export function search(query) {
  return get(BASE, { params: { q: query } });
}

/** Fetch reviews for a professional. */
export function getReviews(id) {
  return get(`${BASE}/${id}/reviews`);
}

/** Fetch availability slots for a professional. */
export function getAvailability(id) {
  return get(`${BASE}/${id}/availability`);
}

/** Update a professional's `availableNow` toggle (auth required). */
export function updateAvailability(id, value, token) {
  return patch(`${BASE}/${id}/availability`, { availableNow: value }, { token });
}

/** Update a professional's per-minute rate (auth required). */
export function updateRate(id, value, token) {
  return patch(`${BASE}/${id}/rate`, { perMinuteRate: value }, { token });
}

export default {
  getAll,
  getById,
  search,
  getReviews,
  getAvailability,
  updateAvailability,
  updateRate,
};

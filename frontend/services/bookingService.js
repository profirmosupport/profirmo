// Booking service — wraps the /api/bookings endpoints.

import { get, post, patch } from '@/services/api';
import { API_ENDPOINTS } from '@/utils/constants';

const BASE = API_ENDPOINTS.bookings;

/** List bookings, optionally filtered via query params. */
export function getAll(params = {}) {
  return get(BASE, { params });
}

/** Fetch a single booking by id. */
export function getById(id) {
  return get(`${BASE}/${id}`);
}

/** Create a new booking (auth required). */
export function create(data, token) {
  return post(BASE, data, { token });
}

/** Update the status of a booking (auth required). */
export function updateStatus(id, status, token) {
  return patch(`${BASE}/${id}/status`, { status }, { token });
}

/** Fetch all bookings for a given client. */
export function getByClient(clientId) {
  return get(BASE, { params: { clientId } });
}

/** Fetch all bookings for a given professional. */
export function getByProfessional(professionalId) {
  return get(BASE, { params: { professionalId } });
}

export default {
  getAll,
  getById,
  create,
  updateStatus,
  getByClient,
  getByProfessional,
};

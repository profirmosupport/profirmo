// Consultation service — wraps the /api/consultations endpoints.

import { get, post } from '@/services/api';
import { API_ENDPOINTS } from '@/utils/constants';

const BASE = API_ENDPOINTS.consultations;

function unwrap(res) {
  if (res && Object.prototype.hasOwnProperty.call(res, 'data')) {
    return res.data;
  }
  return res;
}

/** Fetch a single consultation by id (decorated with client + professional). */
export async function getById(id) {
  const res = await get(`${BASE}/${id}`);
  return unwrap(res);
}

/** Fetch the consultation linked to a booking. */
export async function getByBooking(bookingId) {
  const res = await get(`${BASE}/by-booking/${bookingId}`);
  return unwrap(res);
}

/** Start a consultation call. */
export async function start(id) {
  const res = await post(`${BASE}/${id}/start`, {});
  return unwrap(res);
}

/** End a consultation call. */
export async function end(id) {
  const res = await post(`${BASE}/${id}/end`, {});
  return unwrap(res);
}

/** Fetch the recording URL for a consultation. */
export async function getRecording(id) {
  const res = await get(`${BASE}/${id}/recording`);
  return unwrap(res);
}

/** Fetch the transcript for a consultation. */
export async function getTranscript(id) {
  const res = await get(`${BASE}/${id}/transcript`);
  return unwrap(res);
}

/** Persist notes on a consultation (server uses POST /notes). */
export async function addNotes(id, notes) {
  const res = await post(`${BASE}/${id}/notes`, { notes });
  return unwrap(res);
}

export default {
  getById,
  getByBooking,
  start,
  end,
  getRecording,
  getTranscript,
  addNotes,
};

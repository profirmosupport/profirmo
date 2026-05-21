// Consultation service — wraps the /api/consultations endpoints.

import { get, post, patch } from '@/services/api';
import { API_ENDPOINTS } from '@/utils/constants';

const BASE = API_ENDPOINTS.consultations;

/** Fetch a single consultation by id. */
export function getById(id) {
  return get(`${BASE}/${id}`);
}

/** Start a consultation call (auth required). */
export function start(id, token) {
  return post(`${BASE}/${id}/start`, {}, { token });
}

/** End a consultation call (auth required). */
export function end(id, token) {
  return post(`${BASE}/${id}/end`, {}, { token });
}

/** Fetch the recording URL for a consultation. */
export function getRecording(id) {
  return get(`${BASE}/${id}/recording`);
}

/** Fetch the transcript for a consultation. */
export function getTranscript(id) {
  return get(`${BASE}/${id}/transcript`);
}

/** Add or update notes on a consultation (auth required). */
export function addNotes(id, notes, token) {
  return patch(`${BASE}/${id}/notes`, { notes }, { token });
}

export default {
  getById,
  start,
  end,
  getRecording,
  getTranscript,
  addNotes,
};

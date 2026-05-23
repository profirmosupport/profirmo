// Review service — wraps the /api/reviews endpoints.

import { get, post } from '@/services/api';
import { API_ENDPOINTS } from '@/utils/constants';

const BASE = API_ENDPOINTS.reviews;

/** Unwrap the API envelope and return its `data` payload. */
function unwrap(res) {
  if (res && Object.prototype.hasOwnProperty.call(res, 'data')) {
    return res.data;
  }
  return res;
}

/** Published reviews for a professional (newest first). */
export async function getByProfessional(professionalId) {
  const res = await get(`${BASE}/professional/${professionalId}`);
  return unwrap(res) || [];
}

/** Published reviews for a firm — the collective reviews of its professionals. */
export async function getByFirm(firmId) {
  const res = await get(`${BASE}/firm/${firmId}`);
  return unwrap(res) || [];
}

/**
 * Create a review for a professional. Requires an authenticated user.
 * @param {{ professionalId:string, rating:number, comment?:string }} data
 */
export async function create({ professionalId, rating, comment }) {
  const res = await post(BASE, { professionalId, rating, comment });
  return unwrap(res);
}

/** The logged-in professional's own reviews, each with its appeal (if any). */
export async function getMine() {
  const res = await get(`${BASE}/mine`);
  return unwrap(res) || [];
}

/** Appeal a review the logged-in professional believes is wrong. */
export async function appeal(reviewId, reason) {
  const res = await post(`${BASE}/${reviewId}/appeal`, { reason });
  return unwrap(res);
}

/**
 * Appeal a review on behalf of a firm member. The caller must be the firm
 * owner or a co-owner. Returns the persisted appeal record.
 */
export async function appealOnBehalf(reviewId, reason) {
  const res = await post(`${BASE}/${reviewId}/appeal-on-behalf`, { reason });
  return unwrap(res);
}

export default {
  getByProfessional,
  getByFirm,
  create,
  getMine,
  appeal,
  appealOnBehalf,
};

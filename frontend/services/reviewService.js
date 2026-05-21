// Review service — wraps the /api/reviews endpoints.

import { get, post } from '@/services/api';
import { API_ENDPOINTS } from '@/utils/constants';

const BASE = API_ENDPOINTS.reviews;

/** Fetch all reviews for a given professional. */
export function getByProfessional(professionalId) {
  return get(BASE, { params: { professionalId } });
}

/** Fetch all reviews for a given firm. */
export function getByFirm(firmId) {
  return get(BASE, { params: { firmId } });
}

/** Create a new review (auth required). */
export function create(data, token) {
  return post(BASE, data, { token });
}

export default { getByProfessional, getByFirm, create };

import { apiGet, apiPost, unwrap } from './api';

// Reviews tied to a single professional.
//   GET  /api/reviews/professional/:id  (public)
//   POST /api/reviews                   (auth)

export async function listProfessionalReviews(professionalId) {
  const res = await apiGet(`/api/reviews/professional/${professionalId}`);
  const data = unwrap(res);
  if (Array.isArray(data)) return data;
  return (data && data.items) || data || [];
}

export async function listFirmReviews(firmId) {
  const res = await apiGet(`/api/reviews/firm/${firmId}`);
  const data = unwrap(res);
  if (Array.isArray(data)) return data;
  return (data && data.items) || data || [];
}

export async function createReview({ professionalId, rating, comment }) {
  const res = await apiPost('/api/reviews', {
    professionalId,
    rating,
    comment,
  });
  return unwrap(res);
}

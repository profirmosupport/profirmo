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

// Submit a review. `kind` selects between the three review surfaces:
//   - 'professional'  — client → pro (anchor: professionalId)
//   - 'consultation'  — either side → the specific booking
//                        (anchor: bookingId, reviewedUserId optional)
//   - 'client'        — pro → client (anchor: bookingId + reviewedUserId)
// When kind is omitted the backend defaults to 'professional' for
// back-compat with the public profile review form.
export async function createReview({
  professionalId,
  rating,
  comment,
  kind,
  bookingId,
  reviewedUserId,
}) {
  const res = await apiPost('/api/reviews', {
    professionalId,
    rating,
    comment,
    kind,
    bookingId,
    reviewedUserId,
  });
  return unwrap(res);
}

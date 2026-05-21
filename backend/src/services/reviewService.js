const db = require('../data/mockData');
const { createReview } = require('../models/Review');
const { paginate } = require('./professionalService');

/**
 * List reviews with optional filters and pagination.
 * Supported filters: professionalId, firmId, minRating.
 */
const list = ({ filters = {}, page, limit } = {}) => {
  let result = [...db.reviews];

  if (filters.professionalId) {
    result = result.filter((r) => r.professionalId === filters.professionalId);
  }
  if (filters.firmId) {
    result = result.filter((r) => r.firmId === filters.firmId);
  }
  if (filters.minRating !== undefined) {
    const min = Number(filters.minRating) || 0;
    result = result.filter((r) => r.rating >= min);
  }

  return paginate(result, page, limit);
};

/**
 * Create a review. When tied to a professional, the professional's
 * aggregate rating and reviewsCount are recalculated.
 */
const create = (data = {}) => {
  const rating = Number(data.rating);
  if (Number.isNaN(rating) || rating < 0 || rating > 5) {
    throw { statusCode: 422, message: 'rating must be a number between 0 and 5' };
  }

  let clientName = data.clientName || '';
  if (!clientName && data.clientId) {
    const client = db.clients.find((c) => c.id === data.clientId);
    if (client) clientName = client.name;
  }

  const review = createReview({
    clientId: data.clientId,
    clientName,
    professionalId: data.professionalId || null,
    firmId: data.firmId || null,
    rating,
    comment: data.comment,
    date: data.date,
  });
  db.reviews.push(review);

  if (review.professionalId) {
    recalcProfessionalRating(review.professionalId);
  }
  if (review.firmId) {
    recalcFirmRating(review.firmId);
  }

  return review;
};

// Recalculate a professional's rating average and review count.
const recalcProfessionalRating = (professionalId) => {
  const professional = db.professionals.find((p) => p.id === professionalId);
  if (!professional) return;
  const related = db.reviews.filter(
    (r) => r.professionalId === professionalId
  );
  professional.reviewsCount = related.length;
  if (related.length > 0) {
    const avg =
      related.reduce((sum, r) => sum + r.rating, 0) / related.length;
    professional.rating = Math.round(avg * 10) / 10;
  }
};

// Recalculate a firm's rating average and review count.
const recalcFirmRating = (firmId) => {
  const firm = db.firms.find((f) => f.id === firmId);
  if (!firm) return;
  const related = db.reviews.filter((r) => r.firmId === firmId);
  firm.reviewsCount = related.length;
  if (related.length > 0) {
    const avg =
      related.reduce((sum, r) => sum + r.rating, 0) / related.length;
    firm.rating = Math.round(avg * 10) / 10;
  }
};

/** Get all reviews for a given professional. */
const getByProfessional = (professionalId) =>
  db.reviews.filter((r) => r.professionalId === professionalId);

/** Get all reviews for a given firm. */
const getByFirm = (firmId) =>
  db.reviews.filter((r) => r.firmId === firmId);

module.exports = { list, create, getByProfessional, getByFirm };

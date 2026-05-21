const reviewService = require('../services/reviewService');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');

// GET /api/reviews
const listReviews = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const { items, ...meta } = reviewService.list({ filters, page, limit });
  return paginatedResponse(res, 'Reviews fetched', items, meta);
});

// POST /api/reviews
const createReview = asyncHandler(async (req, res) => {
  const review = reviewService.create(req.body);
  return successResponse(res, 201, 'Review created', review);
});

// GET /api/reviews/professional/:professionalId
const getReviewsByProfessional = asyncHandler(async (req, res) => {
  const reviews = reviewService.getByProfessional(req.params.professionalId);
  return successResponse(res, 200, 'Professional reviews fetched', reviews);
});

// GET /api/reviews/firm/:firmId
const getReviewsByFirm = asyncHandler(async (req, res) => {
  const reviews = reviewService.getByFirm(req.params.firmId);
  return successResponse(res, 200, 'Firm reviews fetched', reviews);
});

module.exports = {
  listReviews,
  createReview,
  getReviewsByProfessional,
  getReviewsByFirm,
};

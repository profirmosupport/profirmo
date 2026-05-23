const reviewService = require('../services/reviewService');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');

// POST /api/reviews  (authenticated — any signed-in user)
const createReview = asyncHandler(async (req, res) => {
  const review = await reviewService.create({
    user: req.user,
    professionalId: req.body.professionalId,
    rating: req.body.rating,
    comment: req.body.comment,
  });
  return successResponse(res, 201, 'Review submitted', review);
});

// GET /api/reviews/professional/:professionalId  (public)
const getReviewsByProfessional = asyncHandler(async (req, res) => {
  const reviews = await reviewService.getByProfessional(
    req.params.professionalId
  );
  return successResponse(res, 200, 'Professional reviews fetched', reviews);
});

// GET /api/reviews/firm/:firmId  (public — collective professional reviews)
const getReviewsByFirm = asyncHandler(async (req, res) => {
  const reviews = await reviewService.getByFirm(req.params.firmId);
  return successResponse(res, 200, 'Firm reviews fetched', reviews);
});

// GET /api/reviews/mine  (authenticated professional)
const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await reviewService.getMineForProfessional(req.user);
  return successResponse(res, 200, 'Your reviews fetched', reviews);
});

// POST /api/reviews/:id/appeal  (authenticated professional)
const appealReview = asyncHandler(async (req, res) => {
  const appeal = await reviewService.createAppeal({
    user: req.user,
    reviewId: req.params.id,
    reason: req.body.reason,
  });
  return successResponse(res, 201, 'Appeal submitted', appeal);
});

// POST /api/reviews/:id/appeal-on-behalf  (firm owner / co-owner)
const appealOnBehalf = asyncHandler(async (req, res) => {
  const appeal = await reviewService.createAppealOnBehalf({
    user: req.user,
    reviewId: req.params.id,
    reason: req.body.reason,
  });
  return successResponse(res, 201, 'Appeal submitted on behalf of member', appeal);
});

module.exports = {
  createReview,
  getReviewsByProfessional,
  getReviewsByFirm,
  getMyReviews,
  appealReview,
  appealOnBehalf,
};

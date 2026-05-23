const express = require('express');
const reviewController = require('../controllers/reviewController');
const { authenticate } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

// --- Public reads ----------------------------------------------------------
router.get(
  '/professional/:professionalId',
  reviewController.getReviewsByProfessional
);
router.get('/firm/:firmId', reviewController.getReviewsByFirm);

// --- Authenticated professional: their own reviews -------------------------
// Declared before any '/:id' route so it is not shadowed.
router.get('/mine', authenticate, reviewController.getMyReviews);

// --- Authenticated: a signed-in user writes a review -----------------------
router.post(
  '/',
  authenticate,
  validateBody({ professionalId: 'required', rating: 'required|number' }),
  reviewController.createReview
);

// --- Authenticated professional: appeal a review ---------------------------
router.post(
  '/:id/appeal',
  authenticate,
  validateBody({ reason: 'required' }),
  reviewController.appealReview
);

// --- Firm owner / co-owner: appeal a review on behalf of a member ---------
router.post(
  '/:id/appeal-on-behalf',
  authenticate,
  validateBody({ reason: 'required' }),
  reviewController.appealOnBehalf
);

module.exports = router;

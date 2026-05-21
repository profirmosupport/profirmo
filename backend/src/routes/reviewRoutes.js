const express = require('express');
const reviewController = require('../controllers/reviewController');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

router.get('/', reviewController.listReviews);

router.post(
  '/',
  validateBody({
    clientId: 'required',
    rating: 'required|number',
    comment: 'required',
  }),
  reviewController.createReview
);

router.get(
  '/professional/:professionalId',
  reviewController.getReviewsByProfessional
);
router.get('/firm/:firmId', reviewController.getReviewsByFirm);

module.exports = router;

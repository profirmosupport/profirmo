const express = require('express');
const professionalController = require('../controllers/professionalController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

// Public listing and search.
router.get('/', professionalController.listProfessionals);

// NOTE: /search must be declared before /:id so it is not shadowed.
router.get('/search', professionalController.searchProfessionals);

router.get('/:id', professionalController.getProfessional);
router.get('/:id/reviews', professionalController.getProfessionalReviews);
router.get(
  '/:id/availability',
  professionalController.getProfessionalAvailability
);

// Protected: professionals (and firm staff) manage their own availability/rate.
router.patch(
  '/:id/availability',
  authenticate,
  authorize('professional', 'firm_admin', 'firm_professional'),
  validateBody({ availableNow: 'required' }),
  professionalController.updateAvailability
);

router.patch(
  '/:id/rate',
  authenticate,
  authorize('professional', 'firm_admin', 'firm_professional'),
  validateBody({ perMinuteRate: 'required|number' }),
  professionalController.updateRate
);

module.exports = router;

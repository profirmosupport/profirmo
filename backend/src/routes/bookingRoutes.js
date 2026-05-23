const express = require('express');
const bookingController = require('../controllers/bookingController');
const { authenticate } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

// All booking routes require an authenticated user.
router.use(authenticate);

router.get('/', bookingController.listBookings);

// Caller-scoped routes — must come before /:id.
router.get('/mine', bookingController.getMyBookings);
router.get('/mine-as-professional', bookingController.getMyAssignedBookings);

router.get('/client/:clientId', bookingController.getBookingsByClient);
router.get(
  '/professional/:professionalId',
  bookingController.getBookingsByProfessional
);

router.post(
  '/',
  validateBody({
    professionalId: 'required',
    duration: 'required|number',
  }),
  bookingController.createBooking
);

router.get('/:id', bookingController.getBooking);
router.patch(
  '/:id/status',
  validateBody({ status: 'required' }),
  bookingController.updateBookingStatus
);

module.exports = router;

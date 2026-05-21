const express = require('express');
const bookingController = require('../controllers/bookingController');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

router.get('/', bookingController.listBookings);

// NOTE: /client and /professional sub-routes are declared before /:id.
router.get('/client/:clientId', bookingController.getBookingsByClient);
router.get(
  '/professional/:professionalId',
  bookingController.getBookingsByProfessional
);

router.post(
  '/',
  validateBody({
    clientId: 'required',
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

const express = require('express');
const consultationController = require('../controllers/consultationController');
const { authenticate } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

// All consultation routes require an authenticated user.
router.use(authenticate);

router.get('/', consultationController.listConsultations);

// Lookup the consultation for a booking — must come before /:id.
router.get(
  '/by-booking/:bookingId',
  consultationController.getConsultationByBooking
);

router.get('/:id', consultationController.getConsultation);
router.post('/:id/start', consultationController.startConsultation);
router.post('/:id/end', consultationController.endConsultation);
router.get('/:id/recording', consultationController.getRecording);
router.get('/:id/transcript', consultationController.getTranscript);
router.post(
  '/:id/notes',
  validateBody({ notes: 'required' }),
  consultationController.addNotes
);

module.exports = router;

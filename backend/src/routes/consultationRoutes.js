const express = require('express');
const consultationController = require('../controllers/consultationController');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

router.get('/', consultationController.listConsultations);
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

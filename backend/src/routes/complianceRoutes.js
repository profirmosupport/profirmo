const express = require('express');
const ctrl = require('../controllers/complianceController');
const { authenticate } = require('../middleware/authMiddleware');
const {
  uploadSingle,
  handleUploadErrors,
} = require('../middleware/uploadMiddleware');

const router = express.Router();
router.use(authenticate);

// --- Entity-type catalog (public-ish reference data) -----------------
// Lists which documents + recurring services typically apply to each
// entity type so the pro modal + client dashboard can render a
// checklist without having to hardcode it on the frontend.
router.get('/entities', ctrl.listEntities);
router.get('/requirements/:entityType', ctrl.getRequirements);

// --- Client self-service -------------------------------------------
// Order matters: /profile/me must come BEFORE the /profiles/:id
// catch-all so 'me' isn't interpreted as a userId.
router.get('/profile/me', ctrl.getMyProfile);
router.put('/profile/me', ctrl.putMyProfile);
router.get('/obligations/me', ctrl.listMyObligations);

// --- Professional surfaces -----------------------------------------
router.get('/profiles/:clientUserId', ctrl.getProfile);
router.put('/profiles/:clientUserId', ctrl.putProfile);
router.post('/profiles/:clientUserId/generate', ctrl.generate);
router.get('/obligations', ctrl.listMine);
router.patch('/obligations/:id', ctrl.updateObligation);
router.post(
  '/obligations/:id/attachment',
  uploadSingle,
  handleUploadErrors,
  ctrl.uploadAttachment
);
router.get('/obligations/:id/attachment/url', ctrl.getAttachmentUrl);

module.exports = router;

const express = require('express');
const ctrl = require('../controllers/complianceController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate);

// Per-client compliance profile (the entity-type + GSTIN etc. that
// drives which rules apply).
router.get('/profiles/:clientUserId', ctrl.getProfile);
router.put('/profiles/:clientUserId', ctrl.putProfile);

// Materialize upcoming obligations from the profile + rules JSON.
router.post('/profiles/:clientUserId/generate', ctrl.generate);

// All my obligations across all clients — drives the calendar overlay
// + the /dashboard/professional/compliance page.
router.get('/obligations', ctrl.listMine);
router.patch('/obligations/:id', ctrl.updateObligation);

module.exports = router;

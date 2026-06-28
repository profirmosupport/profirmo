const express = require('express');
const payoutController = require('../controllers/payoutController');
const { authenticate } = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const { ACTIONS } = require('../config/permissions');

const router = express.Router();
router.use(authenticate);

// Payouts are firm-financial actions. Placeholder matrix grants
// finance.read/write to partner + accountant. Solo pros (no FirmMember)
// resolve to partner inside the permission service so the existing
// single-pro flow keeps working.
router.get(
  '/me/available',
  requirePermission(ACTIONS.FINANCE_READ),
  payoutController.getAvailable
);
router.get(
  '/mine',
  requirePermission(ACTIONS.FINANCE_READ),
  payoutController.listMine
);
router.post(
  '/mine',
  requirePermission(ACTIONS.FINANCE_WRITE),
  payoutController.createMine
);

module.exports = router;

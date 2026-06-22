const express = require('express');
const auditController = require('../controllers/auditController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate);

// GET /api/audit/:entityType/:entityId — newest-first event list for one
// row. Access is gated per entity type inside the controller.
router.get('/:entityType/:entityId', auditController.list);

module.exports = router;

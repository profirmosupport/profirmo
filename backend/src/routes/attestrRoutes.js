// attestrRoutes — public proxy for Attestr-powered lookups.

const express = require('express');
const attestrController = require('../controllers/attestrController');

const router = express.Router();

router.get('/court-types', attestrController.courtTypes);
router.post('/unified-case', attestrController.unifiedCase);

module.exports = router;

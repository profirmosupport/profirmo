const express = require('express');
const ctrl = require('../controllers/userPreferenceController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate);

// Bulk read — single call to hydrate the UI's pref cache on login.
router.get('/', ctrl.getAll);
// Per-key read + write.
router.get('/:key', ctrl.getOne);
router.put('/:key', ctrl.setOne);

module.exports = router;

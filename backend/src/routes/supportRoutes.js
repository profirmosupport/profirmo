// Public support / contact-form routes. The submit endpoint is
// intentionally unauthenticated — the /contact page is the
// production entry point. Rate limiting comes from the shared
// globalLimiter mounted in app.js.

const express = require('express');
const ctrl = require('../controllers/supportController');
const { optionalAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/contact', optionalAuth, ctrl.submitContact);

module.exports = router;

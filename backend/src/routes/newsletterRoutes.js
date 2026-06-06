// Public newsletter signup routes. The first POST creates the row
// with just the email; the PATCH /complete fills in the optional
// modal-collected fields. No auth required — that's the point of a
// footer newsletter signup. The shared global rate limiter (mounted
// in app.js) prevents abuse.

const express = require('express');
const ctrl = require('../controllers/newsletterController');

const router = express.Router();

router.post('/subscribe', ctrl.subscribe);
router.patch('/complete', ctrl.complete);

module.exports = router;

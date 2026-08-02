// Public lead-capture endpoints.
//   POST /            — save a lead (unverified) + send a phone OTP.
//   POST /verify-otp  — verify the OTP → mark verified + set the pf_lead
//                       access cookie that unlocks /search.
//   POST /resend-otp  — resend the OTP (cooldown + cap in the service).
//   GET  /me          — reads the httpOnly pf_lead cookie; true only for a
//                       phone-verified lead.
// authLimiter throttles the OTP-sending endpoints so the SMS gateway can't
// be spammed (30 requests / 15 min per IP in production).

const express = require('express');
const leadController = require('../controllers/leadController');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/', authLimiter, leadController.captureLead);
router.post('/verify-otp', authLimiter, leadController.verifyLeadOtp);
router.post('/resend-otp', authLimiter, leadController.resendLeadOtp);
router.get('/me', leadController.getMyLead);

module.exports = router;

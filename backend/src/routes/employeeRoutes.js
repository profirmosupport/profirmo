// /api/employee/* — public signup + login surface for the Employee
// module (Phase 1). Dashboard / onboarding / payout endpoints land
// here in later phases under the employee auth guard.

const express = require('express');
const employeeController = require('../controllers/employeeController');
const {
  authenticateEmployee,
} = require('../middleware/employeeAuthMiddleware');

const router = express.Router();

// --- Public --------------------------------------------------------------
router.post('/signup', employeeController.signup);
router.post('/signup/resend-otp', employeeController.resendSignupOtp);
router.post('/signup/verify-otp', employeeController.verifySignupOtp);

router.post('/login', employeeController.loginWithPassword);
router.post('/login/otp/send', employeeController.sendLoginOtp);
router.post('/login/otp/verify', employeeController.loginWithOtp);

// --- Authenticated employee --------------------------------------------
router.get('/me', authenticateEmployee, employeeController.getMe);

// Dashboard reads.
router.get(
  '/dashboard/summary',
  authenticateEmployee,
  employeeController.getSummary
);
router.get(
  '/professionals',
  authenticateEmployee,
  employeeController.listOnboardedProfessionals
);
router.get(
  '/commissions',
  authenticateEmployee,
  employeeController.listCommissions
);
router.get(
  '/payouts',
  authenticateEmployee,
  employeeController.listPayouts
);

// Payout request flow.
router.post(
  '/payouts',
  authenticateEmployee,
  employeeController.requestPayout
);
router.post(
  '/payouts/:id/cancel',
  authenticateEmployee,
  employeeController.cancelPayout
);

// Onboard a new professional. Reuses the existing pro-registration
// service; the controller stamps the employee context onto the
// payload so the resulting ProfessionalDetail row carries
// employeeId / employeeCode.
router.post(
  '/onboard-professional',
  authenticateEmployee,
  employeeController.onboardProfessional
);

module.exports = router;

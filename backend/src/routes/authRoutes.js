const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validateRequest');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// --- Signup / login / session ---------------------------------------------

// Public signup. role: client | professional | law_firm.
// authLimiter throttles brute-force / mass-registration abuse.
router.post(
  '/signup',
  authLimiter,
  validateBody({
    firstName: 'required',
    lastName: 'required',
    email: 'required|email',
    password: 'required|min:6',
    role: 'required|in:client,professional,law_firm',
    mobileNumber: 'phone',
  }),
  authController.signup
);

// authLimiter throttles credential-stuffing / brute-force attempts.
router.post(
  '/login',
  authLimiter,
  validateBody({ email: 'required|email', password: 'required' }),
  authController.login
);

// Phone-OTP: send. Body: { phone, purpose }. `purpose` is one of
// 'login' | 'signup' | 'change-phone'. Reuses an existing live OTP (≤10
// min old) when present, otherwise mints a fresh 6-digit code and posts
// it to Ping4SMS. authLimiter keeps SMS spam in check.
router.post(
  '/phone/send-otp',
  authLimiter,
  validateBody({ phone: 'required', purpose: 'required' }),
  authController.sendPhoneOtp
);

// Phone-OTP: verify. Body: { phone, purpose, code }. On success the
// stored row is marked verified but NOT consumed — the downstream
// /phone-login | /phone-signup | /change-phone endpoint redeems it.
router.post(
  '/phone/verify-otp',
  authLimiter,
  validateBody({ phone: 'required', purpose: 'required', code: 'required' }),
  authController.verifyPhoneOtp
);

// Phone login. Requires a verified OTP for (phone, 'login') in the last
// 10 minutes. Returns the standard { accessToken, user } session payload.
router.post(
  '/phone-login',
  authLimiter,
  validateBody({ phone: 'required' }),
  authController.phoneLogin
);

// Phone-first signup completion. Requires a verified OTP for (phone,
// 'signup'). Creates the user, returns the standard session payload.
router.post(
  '/phone-signup',
  authLimiter,
  validateBody({
    phone: 'required',
    firstName: 'required',
    lastName: 'required',
    email: 'required|email',
    role: 'required|in:client,professional',
  }),
  authController.phoneSignup
);

// Phone existence lookup — used by the sign-in flow to route unknown
// numbers to signup BEFORE burning an OTP. authLimiter keeps enumeration
// in check; the response only reveals the boolean.
router.post(
  '/check-phone',
  authLimiter,
  validateBody({ phone: 'required' }),
  authController.checkPhone
);

// Change the logged-in user's phone after verifying OTP on the new number.
// Requires an authenticated session AND a verified OTP for (newPhone,
// 'change-phone').
router.post(
  '/change-phone',
  authenticate,
  authLimiter,
  validateBody({ phone: 'required' }),
  authController.changePhone
);

// Public Razorpay config — just the key_id. Used by booking checkout and
// subscription checkout to open Razorpay without baking a key into the
// frontend build.
router.get('/razorpay-config', authController.razorpayConfig);

// Logout + refresh read the httpOnly cookie; no body validation needed.
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);

// Availability check — public, used by the signup wizard before it tries
// to register so we can show "account exists" with login / recover prompts.
router.post('/check-availability', authController.checkAvailability);

// --- Email verification (Phase 6) -----------------------------------------

// Confirm an email-verification token. On success the account is activated
// and the user is logged in.
router.post(
  '/verify-email',
  validateBody({ token: 'required' }),
  authController.verifyEmail
);

// Resend the verification email. authLimiter throttles abuse; the response
// is intentionally generic so it never reveals whether an account exists.
router.post(
  '/resend-verification',
  authLimiter,
  validateBody({ email: 'required|email' }),
  authController.resendVerification
);

// --- Legacy registration endpoints (kept for the existing frontend) -------

router.post(
  '/register-client',
  authLimiter,
  validateBody({
    name: 'required',
    email: 'required|email',
    password: 'required|min:6',
    phone: 'phone',
  }),
  authController.registerClient
);

// Phase 7: dynamic professional registration. Field-level validation is done
// in professionalRegistrationService (it varies by professionalType), so no
// static validateBody schema is applied here — the service returns a 422 with
// a per-field errors object on failure.
router.post(
  '/register-professional',
  authLimiter,
  authController.registerProfessional
);

router.post(
  '/register-firm',
  authLimiter,
  validateBody({
    name: 'required',
    email: 'required|email',
    password: 'required|min:6',
    firmType: 'required',
    city: 'required',
    phone: 'phone',
  }),
  authController.registerFirm
);

// --- Client invitation / claim --------------------------------------------

// Fetch the email + name attached to a claim token so the frontend form can
// pre-fill the UI before the user sets a password.
router.get('/claim-info', authController.getClaimInfo);

// Set a password against a valid claim token, mark the account active, and
// return an access + refresh token (auto-login).
router.post(
  '/claim-account',
  authLimiter,
  validateBody({ token: 'required', password: 'required|min:8' }),
  authController.claimAccount
);

// --- Password reset (forgot-password + email OTP) -------------------------

// Begin a password reset. authLimiter throttles abuse; the response is
// intentionally generic so it never reveals whether an account exists.
// The `identifier` field accepts either an email or a phone number; the
// controller validates the format. `email` is also accepted as a legacy
// alias so older clients in flight keep working.
router.post(
  '/forgot-password',
  authLimiter,
  authController.forgotPassword
);

// Resend the password-reset OTP. authLimiter throttles abuse on top of the
// service-level 60s cooldown / 5-resend cap. Optional body `channel: 'phone'`
// forces an SMS dispatch even when the original identifier was an email.
router.post(
  '/resend-otp',
  authLimiter,
  authController.resendOtp
);

// Verify the 6-digit OTP; on success a short-lived resetToken is returned.
// Accepts `identifier` (email or phone) + `otp`. Validation is done in the
// controller so the email/phone routing can share one validator path.
router.post(
  '/verify-password-otp',
  authLimiter,
  validateBody({ otp: 'required' }),
  authController.verifyPasswordOtp
);

// Complete the reset using a verified resetToken.
router.post(
  '/reset-password',
  authLimiter,
  validateBody({
    resetToken: 'required',
    newPassword: 'required',
    confirmPassword: 'required',
  }),
  authController.resetPassword
);

// Current authenticated user (requires Bearer access token).
router.get('/me', authenticate, authController.getMe);

module.exports = router;

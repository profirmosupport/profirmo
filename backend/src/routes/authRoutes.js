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

// Firebase Phone Auth login. Client completes SMS-OTP via the Firebase JS
// SDK, then posts the resulting ID token here. authLimiter still applies —
// Firebase has its own per-phone rate limits but we keep the IP-level cap.
router.post(
  '/firebase',
  authLimiter,
  validateBody({ idToken: 'required' }),
  authController.firebaseLogin
);

// Firebase Phone Auth SIGNUP completion. The wizard sends idToken (proves
// phone ownership) + first/last name + email + role. Rejects on duplicate
// phone/email.
router.post(
  '/firebase-signup',
  authLimiter,
  validateBody({
    idToken: 'required',
    firstName: 'required',
    lastName: 'required',
    email: 'required|email',
    role: 'required|in:client,professional',
  }),
  authController.firebaseSignup
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
// Requires an authenticated session AND a fresh Firebase idToken for the
// new number.
router.post(
  '/change-phone',
  authenticate,
  authLimiter,
  validateBody({ idToken: 'required' }),
  authController.changePhone
);

// Public Firebase web-SDK config — apiKey, authDomain, etc. The client
// fetches this on the login page to initialise the Firebase JS SDK at
// runtime, so admins can rotate keys via the settings UI without rebuilding.
router.get('/firebase-config', authController.firebaseConfig);

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
router.post(
  '/forgot-password',
  authLimiter,
  validateBody({ email: 'required|email' }),
  authController.forgotPassword
);

// Resend the password-reset OTP. authLimiter throttles abuse on top of the
// service-level 60s cooldown / 5-resend cap.
router.post(
  '/resend-otp',
  authLimiter,
  validateBody({ email: 'required|email' }),
  authController.resendOtp
);

// Verify the 6-digit OTP; on success a short-lived resetToken is returned.
router.post(
  '/verify-password-otp',
  authLimiter,
  validateBody({ email: 'required|email', otp: 'required' }),
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

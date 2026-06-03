const authService = require('../services/authService');
const professionalRegistrationService = require('../services/professionalRegistrationService');
const phoneOtpService = require('../services/phoneOtpService');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const { logAudit } = require('../utils/auditLogger');
const env = require('../config/env');

// --- Cookie helpers --------------------------------------------------------

// Options shared between res.cookie and res.clearCookie so the browser can
// match the cookie for deletion. Scoped to /api/auth.
const cookieOptions = () => ({
  httpOnly: true,
  secure: env.cookie.secure,
  sameSite: env.cookie.sameSite,
  path: '/api/auth',
});

// Set the long-lived httpOnly refresh-token cookie.
const setRefreshCookie = (res, refreshToken) => {
  res.cookie(env.cookie.name, refreshToken, {
    ...cookieOptions(),
    maxAge: env.refreshTokenDays * 86400000,
  });
};

// Remove the refresh-token cookie.
const clearRefreshCookie = (res) => {
  res.clearCookie(env.cookie.name, cookieOptions());
};

// Extract client metadata for the session row.
const reqMeta = (req) => ({
  userAgent: req.headers['user-agent'] || null,
  ipAddress:
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    (req.connection && req.connection.remoteAddress) ||
    null,
});

// Build the response data: sets the refresh cookie and returns the access
// token. `token` is included alongside `accessToken` for frontend back-compat.
const sendAuth = (res, statusCode, message, result) => {
  setRefreshCookie(res, result.refreshToken);
  return successResponse(res, statusCode, message, {
    accessToken: result.accessToken,
    token: result.accessToken,
    user: result.user,
  });
};

// --- Controllers -----------------------------------------------------------

// Build the no-auto-login signup response (Phase 6). Signup no longer issues
// a token or sets the refresh cookie — the user must verify their email.
const sendSignup = (res, result) =>
  successResponse(
    res,
    201,
    'Account created. Please verify your email.',
    {
      user: result.user,
      emailVerificationRequired: true,
    }
  );

// POST /api/auth/signup
const signup = asyncHandler(async (req, res) => {
  const result = await authService.signup(req.body);
  await logAudit({
    req,
    userId: result.user && result.user.id,
    action: 'auth.signup',
    entity: 'user',
    entityId: result.user && result.user.id,
    status: 'success',
    metadata: {
      email: result.user && result.user.email,
      role: result.user && result.user.role,
      emailVerificationRequired: true,
    },
  });
  return sendSignup(res, result);
});

// GET /api/auth/razorpay-config
// Returns the Razorpay key_id needed by Checkout. The key_id is public by
// design (it's in every Checkout iframe URL); the key_secret stays
// server-side. Exposed via /api/auth/* so frontends can read it at
// runtime without rebuilding when the admin rotates keys.
const razorpayConfig = asyncHandler(async (req, res) => {
  // Lazy require to avoid pulling Razorpay SDK on routes that don't need it.
  const paymentsService = require('../services/paymentsService');
  const keyId = await paymentsService.getPublicKeyId();
  return successResponse(res, 200, 'Razorpay config', {
    keyId: keyId || '',
    configured: Boolean(keyId),
  });
});

// --- Phone-OTP send / verify ----------------------------------------------
//
// Two-step flow used by login, signup and change-phone:
//   POST /api/auth/phone/send-otp    body: { phone, purpose }
//   POST /api/auth/phone/verify-otp  body: { phone, purpose, code }
//
// After /verify-otp succeeds, the caller can immediately POST the matching
// downstream endpoint (/phone-login, /phone-signup, /change-phone). Those
// endpoints check `hasVerifiedOtp(phone, purpose)` and consume the OTP
// row on success so it can't be replayed.

const sendPhoneOtp = asyncHandler(async (req, res) => {
  const phone = String((req.body && req.body.phone) || '').trim();
  const purpose = String((req.body && req.body.purpose) || 'login').trim();
  if (!phone) {
    return res.status(422).json({
      success: false,
      message: 'phone is required',
      errors: { phone: 'phone is required' },
    });
  }
  try {
    const result = await phoneOtpService.sendOtp({ phone, purpose });
    return successResponse(res, 200, 'OTP sent', {
      phone: result.phone,
      expiresAt: result.expiresAt,
      resent: result.resent,
      // Surface the OTP only in non-production so local + staging QA can
      // bypass real SMS delivery.
      debugCode: env.nodeEnv === 'production' ? undefined : result.debugCode,
    });
  } catch (err) {
    if (err && err.code) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message,
        errors: null,
        code: err.code,
      });
    }
    throw err;
  }
});

const verifyPhoneOtp = asyncHandler(async (req, res) => {
  const phone = String((req.body && req.body.phone) || '').trim();
  const purpose = String((req.body && req.body.purpose) || 'login').trim();
  const code = String((req.body && req.body.code) || '').trim();
  if (!phone || !code) {
    return res.status(422).json({
      success: false,
      message: 'phone and code are required',
      errors: {
        phone: phone ? undefined : 'phone is required',
        code: code ? undefined : 'code is required',
      },
    });
  }
  try {
    await phoneOtpService.verifyOtp({ phone, purpose, code });
    return successResponse(res, 200, 'OTP verified', { phone, purpose });
  } catch (err) {
    if (err && err.code) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message,
        errors: null,
        code: err.code,
        data: err.data || null,
      });
    }
    throw err;
  }
});

// POST /api/auth/check-phone
// Body: { phone }. Returns { exists: boolean } so the sign-in UI can route
// unknown numbers to signup BEFORE burning an OTP. Aggressively rate-limited
// at the route layer to limit enumeration. Phone is normalised against the
// same candidate set as login.
const checkPhone = asyncHandler(async (req, res) => {
  const phone = String((req.body && req.body.phone) || '').trim();
  if (!phone) {
    return res.status(422).json({
      success: false,
      message: 'phone is required',
      errors: { phone: 'phone is required' },
    });
  }
  const exists = await authService.phoneIsRegistered(phone);
  return successResponse(res, 200, 'Phone check', { exists });
});

// POST /api/auth/phone-signup
// Body: { phone, firstName, lastName, email, role }
// Phone-first wizard completes here. The caller must have already hit
// /api/auth/phone/verify-otp with purpose='signup' for the same phone in
// the last 10 minutes; the service double-checks that flag, creates the
// user, returns session.
const phoneSignup = asyncHandler(async (req, res) => {
  const { phone, firstName, lastName, email, role } = req.body || {};
  try {
    const result = await authService.signupWithPhone(
      { phone, firstName, lastName, email, role },
      reqMeta(req)
    );
    await logAudit({
      req,
      userId: result.user && result.user.id,
      action: 'auth.phone_signup',
      entity: 'user',
      entityId: result.user && result.user.id,
      status: 'success',
      metadata: {
        phone: result.user && result.user.mobileNumber,
        role: result.user && result.user.role,
      },
    });
    return sendAuth(res, 201, 'Account created', result);
  } catch (err) {
    await logAudit({
      req,
      action: 'auth.phone_signup_failed',
      entity: 'user',
      status: 'failure',
      metadata: { code: err && err.code ? err.code : undefined },
    });
    if (
      err &&
      (err.code === 'PHONE_ALREADY_REGISTERED' ||
        err.code === 'EMAIL_ALREADY_REGISTERED' ||
        err.code === 'INVALID_ROLE' ||
        err.code === 'EMAIL_REQUIRED' ||
        err.code === 'INVALID_PHONE' ||
        err.code === 'OTP_NOT_VERIFIED')
    ) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message,
        errors: null,
        code: err.code,
      });
    }
    throw err;
  }
});

// POST /api/auth/phone-login
// Body: { phone }. Caller must have already hit /api/auth/phone/verify-otp
// with purpose='login' for the same phone in the last 10 minutes. We
// verify the OTP-verified flag, map the phone to a User (which must exist
// — first-time onboarding goes through /api/auth/phone-signup), and
// issue our normal JWT + refresh cookie session.
const phoneLogin = asyncHandler(async (req, res) => {
  const { phone } = req.body || {};
  try {
    const result = await authService.loginWithPhone(phone, reqMeta(req));
    await logAudit({
      req,
      userId: result.user && result.user.id,
      action: 'auth.phone_login',
      entity: 'user',
      entityId: result.user && result.user.id,
      status: 'success',
      metadata: { phone: result.user && result.user.mobileNumber },
    });
    return sendAuth(res, 200, 'Login successful', result);
  } catch (err) {
    await logAudit({
      req,
      action: 'auth.phone_login_failed',
      entity: 'user',
      status: 'failure',
      metadata: { code: err && err.code ? err.code : undefined },
    });
    if (
      err &&
      (err.code === 'ACCOUNT_SUSPENDED' ||
        err.code === 'PENDING_APPROVAL' ||
        err.code === 'PHONE_NOT_REGISTERED' ||
        err.code === 'OTP_NOT_VERIFIED' ||
        err.code === 'INVALID_PHONE')
    ) {
      return res.status(err.statusCode || 403).json({
        success: false,
        message: err.message,
        errors: null,
        code: err.code,
      });
    }
    throw err;
  }
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await authService.login(email, password, reqMeta(req));
    await logAudit({
      req,
      userId: result.user && result.user.id,
      action: 'auth.login',
      entity: 'user',
      entityId: result.user && result.user.id,
      status: 'success',
      metadata: { email: result.user && result.user.email },
    });
    return sendAuth(res, 200, 'Login successful', result);
  } catch (err) {
    // Log the failed attempt (no userId — the user may not exist).
    await logAudit({
      req,
      action: 'auth.login_failed',
      entity: 'user',
      status: 'failure',
      metadata: {
        email: (email || '').toLowerCase().trim() || null,
        code: err && err.code ? err.code : undefined,
      },
    });
    // Unverified-email, pending-approval or suspended-account rejection:
    // respond directly so the JSON body can carry the machine-readable `code`
    // the frontend keys off.
    if (
      err &&
      (err.code === 'EMAIL_NOT_VERIFIED' ||
        err.code === 'PENDING_APPROVAL' ||
        err.code === 'ACCOUNT_SUSPENDED')
    ) {
      return res.status(err.statusCode || 403).json({
        success: false,
        message: err.message,
        errors: null,
        code: err.code,
      });
    }
    // Otherwise re-throw so the central error handler responds as before.
    throw err;
  }
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies ? req.cookies[env.cookie.name] : null;
  await authService.logout(refreshToken);
  clearRefreshCookie(res);
  await logAudit({
    req,
    userId: req.user ? req.user.id : null,
    action: 'auth.logout',
    entity: 'user',
    status: 'success',
  });
  return successResponse(res, 200, 'Logged out', {});
});

// POST /api/auth/refresh
const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies ? req.cookies[env.cookie.name] : null;
  const result = await authService.refresh(refreshToken, reqMeta(req));
  return sendAuth(res, 200, 'Token refreshed', result);
});

// Shared audit-log call for the legacy register-* endpoints.
const auditSignup = (req, result) =>
  logAudit({
    req,
    userId: result.user && result.user.id,
    action: 'auth.signup',
    entity: 'user',
    entityId: result.user && result.user.id,
    status: 'success',
    metadata: {
      email: result.user && result.user.email,
      role: result.user && result.user.role,
      emailVerificationRequired: true,
    },
  });

// POST /api/auth/check-availability
// Public — lets the signup wizard check whether an email / phone is
// already linked to an existing user so the visitor sees "account exists,
// login or recover" before filling in the rest of the form.
const checkAvailability = asyncHandler(async (req, res) => {
  const { email, mobileNumber } = req.body || {};
  const result = await authService.checkAvailability({ email, mobileNumber });
  return successResponse(res, 200, 'Availability check', result);
});

// POST /api/auth/register-client
const registerClient = asyncHandler(async (req, res) => {
  const result = await authService.registerClient(req.body);
  await auditSignup(req, result);
  return sendSignup(res, result);
});

// POST /api/auth/register-professional
// Phase 7: dynamic professional registration (Legal / Tax Consultant).
// The service auto-issues a session so the 3-step signup wizard can keep
// saving Step 2 and Step 3 without forcing the visitor to verify their
// email first. The verification email is still queued.
const registerProfessional = asyncHandler(async (req, res) => {
  const result = await professionalRegistrationService.registerProfessional(
    req.body
  );
  await logAudit({
    req,
    userId: result.user && result.user.id,
    action: 'auth.register_professional',
    entity: 'user',
    entityId: result.user && result.user.id,
    status: 'success',
    metadata: {
      email: result.user && result.user.email,
      professionalType: req.body && req.body.professionalType,
      approvalStatus: result.approvalStatus,
    },
  });
  if (result.refreshToken) {
    setRefreshCookie(res, result.refreshToken);
  }
  return successResponse(
    res,
    201,
    'Registration submitted. Continue with the next step to complete your profile.',
    {
      user: result.user,
      emailVerificationRequired: true,
      approvalStatus: result.approvalStatus,
      accessToken: result.accessToken,
      token: result.accessToken,
    }
  );
});

// POST /api/auth/register-firm
const registerFirm = asyncHandler(async (req, res) => {
  const result = await authService.registerFirm(req.body);
  await auditSignup(req, result);
  return sendSignup(res, result);
});

// POST /api/auth/verify-email
// Confirms an email-verification token. For clients and approved
// professionals the account is activated and the user is logged in (access
// token + refresh cookie). For a professional still awaiting admin approval
// the email is verified but NO session/token is issued.
const verifyEmail = asyncHandler(async (req, res) => {
  const token = req.body && req.body.token;
  try {
    const result = await authService.verifyEmail(token, reqMeta(req));
    await logAudit({
      req,
      userId: result.user && result.user.id,
      action: 'auth.email_verified',
      entity: 'user',
      entityId: result.user && result.user.id,
      status: 'success',
      metadata: { email: result.user && result.user.email },
    });
    // Pending professional: verified but not logged in — no token / cookie.
    if (result.noSession) {
      return successResponse(
        res,
        200,
        'Email verified. Your professional profile is pending admin approval.',
        {
          user: result.user,
          emailVerified: true,
          approvalStatus: result.approvalStatus || null,
        }
      );
    }
    return sendAuth(res, 200, 'Email verified successfully', result);
  } catch (err) {
    await logAudit({
      req,
      action: 'auth.email_verify_failed',
      entity: 'user',
      status: 'failure',
    });
    throw err;
  }
});

// POST /api/auth/resend-verification
// Always responds generically so it never leaks whether an account exists.
const resendVerification = asyncHandler(async (req, res) => {
  const email = req.body && req.body.email;
  await authService.resendVerification(email);
  await logAudit({
    req,
    action: 'auth.verification_resent',
    entity: 'user',
    status: 'success',
    metadata: { email: (email || '').toLowerCase().trim() || null },
  });
  return successResponse(
    res,
    200,
    'If that account exists and is unverified, a new verification email has been sent.',
    {}
  );
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user.sub;
  const user = await authService.getCurrentUser(userId);
  return successResponse(res, 200, 'Current user fetched', { user });
});

// POST /api/auth/change-phone   (requires Bearer access token)
// Body: { phone }. The frontend completes a phone-OTP flow against the
// NEW number via /api/auth/phone/send-otp + /api/auth/phone/verify-otp
// with purpose='change-phone' BEFORE hitting this endpoint. The service
// re-checks the verified flag, ensures no other user holds that number,
// then updates users.mobileNumber for the logged-in user.
const changePhone = asyncHandler(async (req, res) => {
  const userId = req.user && (req.user.id || req.user.sub);
  const { phone } = req.body || {};
  try {
    const result = await authService.changePhone(userId, phone);
    await logAudit({
      req,
      userId,
      action: 'auth.phone_changed',
      entity: 'user',
      entityId: userId,
      status: 'success',
      metadata: { newPhone: result.mobileNumber },
    });
    return successResponse(res, 200, 'Phone number updated', result);
  } catch (err) {
    await logAudit({
      req,
      userId,
      action: 'auth.phone_change_failed',
      entity: 'user',
      entityId: userId,
      status: 'failure',
      metadata: { code: err && err.code ? err.code : undefined },
    });
    if (
      err &&
      (err.code === 'PHONE_ALREADY_REGISTERED' ||
        err.code === 'INVALID_PHONE' ||
        err.code === 'OTP_NOT_VERIFIED')
    ) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message,
        errors: null,
        code: err.code,
      });
    }
    throw err;
  }
});

// --- Client invitation / claim --------------------------------------------

// GET /api/auth/claim-info?token=...
// Returns the email + display name attached to an invite token so the claim
// page can pre-fill the form. Returns 400 on expired / invalid tokens.
const getClaimInfo = asyncHandler(async (req, res) => {
  const info = await authService.getClaimInfo(req.query.token);
  return successResponse(res, 200, 'Claim info fetched', info);
});

// POST /api/auth/claim-account
// Accept a valid invite token + new password (+ optional fullName), set the
// password, mark the account active, issue an access token + refresh cookie.
const claimAccount = asyncHandler(async (req, res) => {
  const result = await authService.claimClientAccount(req.body, reqMeta(req));
  await logAudit({
    req,
    userId: result.user && result.user.id,
    action: 'auth.client_claimed',
    entity: 'user',
    entityId: result.user && result.user.id,
    status: 'success',
    metadata: { email: result.user && result.user.email },
  });
  return sendAuth(res, 200, 'Account claimed successfully', result);
});

// --- Password reset (forgot-password + email OTP) --------------------------

// Basic email-format check, matching the project's validation rules.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/forgot-password
// Always responds with the same generic 200 message so it never reveals
// whether an account exists for the supplied email.
const forgotPassword = asyncHandler(async (req, res) => {
  const email = req.body && req.body.email;
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(422).json({
      success: false,
      message: 'A valid email address is required.',
      errors: { email: 'A valid email address is required.' },
    });
  }
  await authService.forgotPassword(email, { req });
  return successResponse(
    res,
    200,
    authService.GENERIC_RESET_MESSAGE,
    {}
  );
});

// POST /api/auth/resend-otp
// Re-sends the OTP for an in-progress reset. Cooldown / resend-limit
// violations surface as 429 with a specific message; everything else returns
// the same generic success message.
const resendOtp = asyncHandler(async (req, res) => {
  const email = req.body && req.body.email;
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(422).json({
      success: false,
      message: 'A valid email address is required.',
      errors: { email: 'A valid email address is required.' },
    });
  }
  try {
    const result = await authService.resendOtp(email, { req });
    return successResponse(res, 200, result.message, {});
  } catch (err) {
    if (err && err.statusCode === 429) {
      return res.status(429).json({
        success: false,
        message: err.message,
        errors: null,
      });
    }
    throw err;
  }
});

// POST /api/auth/verify-password-otp
// Verifies the 6-digit OTP and, on success, issues a short-lived resetToken.
const verifyPasswordOtp = asyncHandler(async (req, res) => {
  const email = req.body && req.body.email;
  const otp = req.body && req.body.otp;
  if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
    return res.status(422).json({
      success: false,
      message: 'A valid 6-digit verification code is required.',
      errors: { otp: 'A valid 6-digit verification code is required.' },
    });
  }
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(422).json({
      success: false,
      message: 'A valid email address is required.',
      errors: { email: 'A valid email address is required.' },
    });
  }
  try {
    const result = await authService.verifyPasswordOtp(email, otp, { req });
    return successResponse(res, 200, 'Verification code accepted.', {
      resetToken: result.resetToken,
    });
  } catch (err) {
    // OTP-specific errors carry a machine-readable `code` (and sometimes
    // `data`) the frontend keys off — respond directly to preserve them.
    if (err && err.code) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message,
        errors: null,
        code: err.code,
        data: err.data || null,
      });
    }
    throw err;
  }
});

// POST /api/auth/reset-password
// Completes the reset: verifies the resetToken, applies the new password,
// invalidates the OTP and purges every session for the user.
const resetPassword = asyncHandler(async (req, res) => {
  try {
    await authService.resetPassword(req.body || {}, { req });
    return successResponse(
      res,
      200,
      'Password changed successfully. Please log in with your new password.',
      {}
    );
  } catch (err) {
    // Validation errors carry a per-field `errors` object — respond directly
    // so the frontend can render field-level messages.
    if (err && err.statusCode === 422 && err.errors) {
      return res.status(422).json({
        success: false,
        message: err.message,
        errors: err.errors,
      });
    }
    throw err;
  }
});

module.exports = {
  signup,
  login,
  phoneLogin,
  phoneSignup,
  sendPhoneOtp,
  verifyPhoneOtp,
  razorpayConfig,
  checkPhone,
  changePhone,
  logout,
  refresh,
  checkAvailability,
  registerClient,
  registerProfessional,
  registerFirm,
  verifyEmail,
  resendVerification,
  getMe,
  getClaimInfo,
  claimAccount,
  forgotPassword,
  resendOtp,
  verifyPasswordOtp,
  resetPassword,
};

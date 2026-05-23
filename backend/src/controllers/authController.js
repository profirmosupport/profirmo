const authService = require('../services/authService');
const professionalRegistrationService = require('../services/professionalRegistrationService');
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

// POST /api/auth/register-client
const registerClient = asyncHandler(async (req, res) => {
  const result = await authService.registerClient(req.body);
  await auditSignup(req, result);
  return sendSignup(res, result);
});

// POST /api/auth/register-professional
// Phase 7: dynamic professional registration (Legal / Tax Consultant). Creates
// an unverified, pending-approval professional. No token / cookie is issued.
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
  return successResponse(
    res,
    201,
    'Registration submitted. Please verify your email; your profile is pending admin approval.',
    {
      user: result.user,
      emailVerificationRequired: true,
      approvalStatus: result.approvalStatus,
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
  logout,
  refresh,
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

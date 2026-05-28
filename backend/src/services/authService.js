// Authentication service for the Profirmo backend.
//
// Implements secure JWT access tokens + opaque, persistent refresh-token
// sessions. The raw refresh token lives only in an httpOnly cookie and the
// client; the database stores nothing but its SHA-256 hash.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const {
  sequelize,
  User,
  Session,
  Professional,
  Firm,
  ProfessionalApproval,
  ProfessionalDetail,
  PasswordResetOtp,
  Address,
} = require('../models');
const {
  signAccessToken,
  generateRefreshToken,
  hashToken,
} = require('../utils/tokenHelper');
const { hashPassword, verifyPassword } = require('../utils/password');
const { generateOtp, hashOtp, verifyOtp } = require('../utils/otp');
const env = require('../config/env');
const { enqueue } = require('./queueService');
const notificationService = require('./notificationService');
const { logAudit } = require('../utils/auditLogger');

// --- Helpers ---------------------------------------------------------------

// RFC4122 v4 UUID (no external dependency).
const genUuid = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
    16,
    20
  )}-${h.slice(20)}`;
};

// Public, password-free view of a user record. An optional `approvalStatus`
// (Phase 7) is included verbatim — `null` for non-professional users.
const sanitizeUser = (user, approvalStatus = null, extras = {}) => {
  if (!user) return null;
  const u = typeof user.get === 'function' ? user.get({ plain: true }) : user;
  return {
    id: u.id,
    uuid: u.uuid || null,
    firstName: u.firstName || null,
    lastName: u.lastName || null,
    fullName: u.fullName || u.name || null,
    name: u.name || null,
    email: u.email || null,
    mobileNumber: u.mobileNumber || null,
    role: u.role || null,
    profilePhoto: u.profilePhoto || null,
    coverPhoto: u.coverPhoto || null,
    status: u.status || 'active',
    isOnline: Boolean(u.isOnline),
    memberSince: u.memberSince || null,
    lastLogin: u.lastLogin || null,
    accountVerified: Boolean(u.accountVerified),
    emailVerified: Boolean(u.emailVerified),
    mobileVerified: Boolean(u.mobileVerified),
    linkedId: u.linkedId || null,
    firmId: u.firmId || null,
    approvalStatus: approvalStatus || null,
    // Frontend uses this to bounce incomplete signups back to /signup so
    // the 3-step wizard is always finished before the user can use the
    // platform. Non-professionals always get `true` (n/a).
    signupComplete:
      extras && Object.prototype.hasOwnProperty.call(extras, 'signupComplete')
        ? Boolean(extras.signupComplete)
        : u.role === 'professional'
          ? false
          : true,
  };
};

/**
 * Resolve a professional user's approval status from professional_approvals.
 * Returns null for non-professional users (or when no approval row exists).
 * @param {object} user - user record
 * @returns {Promise<string|null>}
 */
const resolveApprovalStatus = async (user) => {
  if (!user || user.role !== 'professional') return null;
  const approval = await ProfessionalApproval.findOne({
    where: { userId: user.id },
  });
  return approval ? approval.status : null;
};

/**
 * Resolve a professional user's signupComplete flag from
 * professional_details. Non-professionals are considered complete.
 * @param {object} user
 * @returns {Promise<boolean>}
 */
const resolveSignupComplete = async (user) => {
  if (!user) return true;
  if (user.role !== 'professional') return true;
  try {
    const detail = await ProfessionalDetail.findOne({
      where: { userId: user.id },
      attributes: ['signupComplete'],
      raw: true,
    });
    return detail ? Boolean(detail.signupComplete) : false;
  } catch {
    return false;
  }
};

/**
 * Sanitize a user and attach their professional approval status (if any).
 * @param {object} user - user record
 * @returns {Promise<object|null>}
 */
const sanitizeUserWithApproval = async (user) => {
  if (!user) return null;
  const approvalStatus = await resolveApprovalStatus(user);
  // Resolve the live `signupComplete` flag for professionals from the
  // detail row so a partially-onboarded user gets bounced back to the
  // wizard. Non-professionals don't have a detail row — treat as complete.
  let signupComplete = true;
  if (user.role === 'professional') {
    try {
      const detail = await ProfessionalDetail.findOne({
        where: { userId: user.id },
        attributes: ['signupComplete'],
        raw: true,
      });
      signupComplete = detail ? Boolean(detail.signupComplete) : false;
    } catch {
      signupComplete = false;
    }
  }
  return sanitizeUser(user, approvalStatus, { signupComplete });
};

/**
 * Create a persistent Session row for a user and return the raw refresh
 * token (to be set as a cookie). Only the token hash is stored.
 * @param {object} user - user record
 * @param {object} [meta] - { userAgent, ipAddress }
 * @returns {Promise<{ refreshToken: string, session: object }>}
 */
const createSession = async (user, meta = {}) => {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(
    Date.now() + env.refreshTokenDays * 86400000
  );
  const session = await Session.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    userAgent: meta.userAgent || null,
    ipAddress: meta.ipAddress || null,
    expiresAt,
  });
  return { refreshToken, session };
};

/**
 * Build the full auth payload for a user: an access token, a fresh refresh
 * session and the sanitized user. The controller is responsible for setting
 * the refresh cookie from `refreshToken`.
 * @param {object} user - user record
 * @param {object} [meta] - { userAgent, ipAddress }
 * @returns {Promise<{ accessToken, refreshToken, user }>}
 */
const buildAuthResult = async (user, meta = {}) => {
  const { refreshToken } = await createSession(user, meta);
  return {
    accessToken: signAccessToken(user),
    refreshToken,
    user: sanitizeUser(user),
  };
};

// Map a public signup role to the internal role stored on the user record.
// `law_firm` is intentionally absent — firms cannot sign up directly. A
// professional creates a firm after registering.
const PUBLIC_ROLE_MAP = {
  client: 'client',
  professional: 'professional',
};

// --- Email verification ----------------------------------------------------

/**
 * Generate a fresh email-verification token. The raw token is returned to be
 * emailed; only its SHA-256 hash + expiry are stored on the user record.
 * @returns {{ rawToken, tokenHash, expiresAt }}
 */
const buildVerificationToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return {
    rawToken,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(
      Date.now() + env.emailVerificationExpiryHours * 3600000
    ),
  };
};

/**
 * Queue an email-verification email for a user via the background-job queue.
 * @param {object} user - user record (needs email, fullName/name)
 * @param {string} rawToken - the raw verification token
 * @returns {Promise<void>}
 */
const enqueueVerificationEmail = async (user, rawToken) => {
  await enqueue('email', {
    to: user.email,
    template: 'emailVerification',
    vars: {
      name: user.fullName || user.firstName || user.name || 'there',
      verifyUrl: `${env.appUrl}/verify-email?token=${rawToken}`,
      expiryHours: env.emailVerificationExpiryHours,
    },
  });
};

/**
 * Queue a client-invitation email when a professional adds a new client.
 * The link routes to the claim page where the client sets a password and
 * gets logged in. Same emailVerificationTokenHash machinery powers both —
 * one column, two flows, distinguished by user.status === 'invited'.
 *
 * @param {object} user - user record (needs email, fullName/name)
 * @param {string} rawToken - raw invite token
 * @param {string} [professionalName] - name of the inviting professional
 */
const enqueueClientInvitationEmail = async (user, rawToken, professionalName) => {
  await enqueue('email', {
    to: user.email,
    template: 'clientInvitation',
    vars: {
      name: user.fullName || user.firstName || user.name || 'there',
      professionalName: professionalName || 'A professional',
      claimUrl: `${env.appUrl}/auth/claim?token=${rawToken}`,
      expiryHours: env.emailVerificationExpiryHours,
    },
  });
};

/**
 * Public-facing details for a claim token. The frontend uses this to
 * pre-fill the claim form. Returns 400 when the token is invalid/expired so
 * callers can show a friendly message.
 */
const getClaimInfo = async (rawToken) => {
  if (!rawToken) {
    throw { statusCode: 400, message: 'Invitation token is required' };
  }
  const user = await User.findOne({
    where: { emailVerificationTokenHash: hashToken(rawToken) },
  });
  if (
    !user ||
    !user.emailVerificationExpiresAt ||
    new Date(user.emailVerificationExpiresAt).getTime() <= Date.now()
  ) {
    throw { statusCode: 400, message: 'Invalid or expired invitation link' };
  }
  return {
    email: user.email,
    name:
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.name ||
      '',
    role: user.role,
  };
};

/**
 * Claim a client account: verify the invite token, set a password, mark the
 * user verified, clear the token, and auto-log them in. Returns the same
 * shape as `login` so the AuthProvider can adopt the session.
 */
const claimClientAccount = async ({ token, password, fullName }, meta = {}) => {
  if (!token) {
    throw { statusCode: 400, message: 'Invitation token is required' };
  }
  if (!password || String(password).length < 8) {
    throw { statusCode: 422, message: 'Password must be at least 8 characters' };
  }

  const user = await User.findOne({
    where: { emailVerificationTokenHash: hashToken(token) },
  });
  if (
    !user ||
    !user.emailVerificationExpiresAt ||
    new Date(user.emailVerificationExpiresAt).getTime() <= Date.now()
  ) {
    throw { statusCode: 400, message: 'Invalid or expired invitation link' };
  }

  const passwordHash = await hashPassword(password);
  const trimmedName = (fullName || '').trim();

  const result = await sequelize.transaction(async (transaction) => {
    user.password = passwordHash;
    user.emailVerified = true;
    user.accountVerified = true;
    user.status = 'active';
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    user.emailVerificationSentAt = null;
    if (trimmedName) {
      user.fullName = trimmedName;
      user.name = trimmedName;
      const [firstName, ...rest] = trimmedName.split(/\s+/);
      user.firstName = firstName || user.firstName;
      user.lastName = rest.join(' ') || user.lastName;
    }
    if (!user.uuid) user.uuid = genUuid();
    if (!user.memberSince) user.memberSince = user.createdAt || new Date();
    user.isOnline = true;
    user.lastLogin = new Date();
    await user.save({ transaction });

    const refreshToken = generateRefreshToken();
    await Session.create(
      {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        userAgent: meta.userAgent || null,
        ipAddress: meta.ipAddress || null,
        expiresAt: new Date(Date.now() + env.refreshTokenDays * 86400000),
      },
      { transaction }
    );

    return {
      accessToken: signAccessToken(user),
      refreshToken,
      user: sanitizeUser(user),
    };
  });

  try {
    await notificationService.createNotification({
      userId: user.id,
      type: 'welcome',
      title: 'Welcome to Profirmo',
      message:
        'Your account is active. You can view your bookings and cases here.',
      link: '/dashboard',
    });
  } catch (err) {
    console.warn(`[Auth] welcome notification failed: ${err.message || err}`);
  }

  return result;
};

// --- Core registration -----------------------------------------------------

/**
 * Internal signup: creates the role-specific linked record (Client /
 * Professional / Firm) plus the User, hashing the password. Shared by the
 * public /signup endpoint and the legacy /register-* endpoints.
 *
 * @param {object} opts
 * @param {string} opts.role - internal role: 'client'|'professional'|'firm_admin'
 * @param {object} opts.data - raw request body
 * @returns {Promise<object>} created User record
 */
const createUserWithRole = async ({ role, data = {} }) => {
  const email = (data.email || '').toLowerCase().trim();
  if (!email) {
    throw { statusCode: 422, message: 'Email is required' };
  }
  if (!data.password) {
    throw { statusCode: 422, message: 'Password is required' };
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw { statusCode: 409, message: 'Email already registered' };
  }

  // Derive name fields. Accept either firstName/lastName or a single name.
  const firstName = (data.firstName || '').trim();
  const lastName = (data.lastName || '').trim();
  const derivedName =
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    (data.name || '').trim();
  if (!derivedName) {
    throw { statusCode: 422, message: 'Name is required' };
  }

  const passwordHash = await hashPassword(data.password);
  const now = new Date();

  let linkedId = null;
  let firmId = null;

  const phone = data.phone || data.mobileNumber || '';

  if (role === 'client') {
    // Clients are first-class users — no separate clients table. linkedId
    // stays null; downstream code reads name/phone/city directly off the
    // user row.
    linkedId = null;
  } else if (role === 'professional') {
    const professional = await Professional.create({
      name: derivedName,
      email,
      phone,
      professionType: data.professionType || '',
      specialization: data.specialization || '',
      city: data.city || '',
      experience: Number(data.experience) || 0,
      languages: Array.isArray(data.languages) ? data.languages : [],
      perMinuteRate: Number(data.perMinuteRate) || 0,
      bio: data.bio || null,
      registrationNumber: data.registrationNumber || '',
      servicesOffered: Array.isArray(data.servicesOffered)
        ? data.servicesOffered
        : [],
      verified: false,
      status: 'pending',
    });
    linkedId = professional.id;
  } else if (role === 'firm') {
    const firm = await Firm.create({
      name: data.firmName || data.name || derivedName,
      firmType: data.firmType || 'Legal Firm',
      city: data.city || '',
      address: data.address || '',
      email,
      phone,
      services: Array.isArray(data.services) ? data.services : [],
      description: data.description || null,
      adminName: data.adminName || derivedName,
    });
    linkedId = firm.id;
    firmId = firm.id;
  } else {
    throw { statusCode: 400, message: `Unsupported role: ${role}` };
  }

  // Phase-6: new accounts start unverified and must confirm their email
  // before they can log in. A verification token is generated here and
  // emailed by the caller (signup) via the background-job queue.
  const verification = buildVerificationToken();

  const user = await User.create({
    name: derivedName,
    email,
    password: passwordHash,
    role,
    linkedId,
    firmId,
    uuid: genUuid(),
    firstName: firstName || derivedName.split(' ')[0] || derivedName,
    lastName:
      lastName ||
      derivedName.split(' ').slice(1).join(' ') ||
      null,
    fullName: derivedName,
    mobileNumber: data.mobileNumber || data.phone || null,
    profilePhoto: data.profilePhoto || null,
    status: 'pending_verification',
    isOnline: false,
    accountVerified: false,
    emailVerified: false,
    memberSince: now,
    lastLogin: null,
    emailVerificationTokenHash: verification.tokenHash,
    emailVerificationExpiresAt: verification.expiresAt,
    emailVerificationSentAt: now,
  });

  // Persist the postal address captured during signup so the user's profile
  // page pre-fills country / state / city / addressLine on first load. Only
  // create the row when any address field was supplied; otherwise leave the
  // user without an address record and let the profile editor create one.
  const hasAddressInput = Boolean(
    (data.country && String(data.country).trim()) ||
      (data.state && String(data.state).trim()) ||
      (data.city && String(data.city).trim()) ||
      (data.addressLine && String(data.addressLine).trim()) ||
      (data.postalCode && String(data.postalCode).trim())
  );
  if (hasAddressInput) {
    await Address.create({
      userId: user.id,
      country: (data.country || '').trim() || null,
      state: (data.state || '').trim() || null,
      city: (data.city || '').trim() || null,
      addressLine: (data.addressLine || '').trim() || null,
      postalCode: (data.postalCode || '').trim() || null,
    });
  }

  // The raw token is attached transiently so the caller can email it; it is
  // never persisted in this form.
  return { user, rawVerificationToken: verification.rawToken };
};

// --- Public service methods ------------------------------------------------

/**
 * Shared signup finisher: enqueues the verification email and returns the
 * no-auto-login signup result. Phase 6 — signup no longer logs the user in;
 * the account must be email-verified first.
 * @param {{ user, rawVerificationToken }} created
 * @returns {Promise<{ user, emailVerificationRequired: true }>}
 */
const finishSignup = async ({ user, rawVerificationToken }) => {
  await enqueueVerificationEmail(user, rawVerificationToken);
  return { user: sanitizeUser(user), emailVerificationRequired: true };
};

/**
 * Public signup. Accepts roles client | professional | law_firm.
 * Creates an UNVERIFIED account and queues a verification email — it does
 * NOT log the user in.
 * @param {object} data - request body
 * @returns {Promise<{ user, emailVerificationRequired: true }>}
 */
const signup = async (data = {}) => {
  const requested = String(data.role || 'client').toLowerCase();
  if (requested === 'admin' || requested === 'platform_admin') {
    throw { statusCode: 403, message: 'This role cannot self-register' };
  }
  const role = PUBLIC_ROLE_MAP[requested];
  if (!role) {
    throw {
      statusCode: 422,
      message: 'Role must be one of: client, professional, law_firm',
    };
  }
  return finishSignup(await createUserWithRole({ role, data }));
};

/**
 * Register a client (legacy endpoint). Creates an unverified account and
 * queues a verification email; does not auto-login.
 */
const registerClient = async (data = {}) => {
  return finishSignup(await createUserWithRole({ role: 'client', data }));
};

/**
 * Register an independent professional (legacy endpoint).
 */
const registerProfessional = async (data = {}) => {
  return finishSignup(
    await createUserWithRole({ role: 'professional', data })
  );
};

/**
 * Firms can no longer sign up directly — a professional registers, then
 * creates a firm from their dashboard. This endpoint is kept for routing
 * compatibility but always responds with 410 Gone.
 */
const registerFirm = async () => {
  throw {
    statusCode: 410,
    message:
      'Firms can no longer sign up directly. Register as a professional, then create your firm from the dashboard.',
  };
};

/**
 * Authenticate with email + password. Supports both bcrypt hashes and legacy
 * plain-text demo passwords.
 * @param {string} email
 * @param {string} password
 * @param {object} [meta] - { userAgent, ipAddress }
 * @returns {Promise<{ accessToken, refreshToken, user }>}
 */
const login = async (email, password, meta = {}) => {
  const normalized = (email || '').toLowerCase().trim();
  const user = await User.findOne({ where: { email: normalized } });
  if (!user) {
    throw { statusCode: 401, message: 'Invalid email or password' };
  }
  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    throw { statusCode: 401, message: 'Invalid email or password' };
  }

  // Phase-9: a suspended account can never log in, regardless of role. This
  // check runs before the email-verified / approval gates.
  if (user.status === 'suspended') {
    throw {
      statusCode: 403,
      message: 'Your account has been suspended. Please contact support.',
      code: 'ACCOUNT_SUSPENDED',
    };
  }

  // Phase-6: block login until the email is verified. Existing demo / seed
  // accounts are backfilled `emailVerified = 1`, so they are unaffected.
  if (!user.emailVerified) {
    throw {
      statusCode: 403,
      message: 'Please verify your email before logging in.',
      code: 'EMAIL_NOT_VERIFIED',
    };
  }

  // Phase-7: gate professional logins by approval status. Clients and other
  // roles always pass (resolveApprovalStatus returns null for them).
  const approvalStatus = await resolveApprovalStatus(user);
  if (user.role === 'professional' && approvalStatus === 'PENDING_APPROVAL') {
    throw {
      statusCode: 403,
      message: 'Your professional application is under review.',
      code: 'PENDING_APPROVAL',
    };
  }
  // REJECTED / INFO_REQUESTED professionals ARE allowed to log in so they
  // can view feedback and resubmit; their approvalStatus rides along.

  user.lastLogin = new Date();
  user.isOnline = true;
  if (!user.memberSince) user.memberSince = user.createdAt || new Date();
  if (!user.uuid) user.uuid = genUuid();
  await user.save();

  const { refreshToken } = await createSession(user, meta);
  return {
    accessToken: signAccessToken(user),
    refreshToken,
    user: sanitizeUser(user, approvalStatus, {
      signupComplete: await resolveSignupComplete(user),
    }),
  };
};

/**
 * Log out: revoke the session matching the supplied refresh token and mark
 * the user offline.
 * @param {string} refreshToken - raw refresh token from the cookie
 * @returns {Promise<void>}
 */
const logout = async (refreshToken) => {
  if (!refreshToken) return;
  const session = await Session.findOne({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
  });
  if (!session) return;
  session.revokedAt = new Date();
  await session.save();

  const user = await User.findByPk(session.userId);
  if (user) {
    user.isOnline = false;
    await user.save();
  }
};

/**
 * Refresh tokens. Validates the opaque refresh token against a live session,
 * rotates it (new refresh token + access token) and returns both.
 * @param {string} refreshToken - raw refresh token from the cookie
 * @param {object} [meta] - { userAgent, ipAddress }
 * @returns {Promise<{ accessToken, refreshToken, user }>}
 */
const refresh = async (refreshToken, meta = {}) => {
  if (!refreshToken) {
    throw { statusCode: 401, message: 'Missing refresh token' };
  }
  const session = await Session.findOne({
    where: {
      tokenHash: hashToken(refreshToken),
      revokedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
  });
  if (!session) {
    throw { statusCode: 401, message: 'Invalid or expired session' };
  }

  const user = await User.findByPk(session.userId);
  if (!user) {
    throw { statusCode: 401, message: 'Invalid or expired session' };
  }

  // Rotate: replace this session's refresh token + expiry.
  const newRefreshToken = generateRefreshToken();
  session.tokenHash = hashToken(newRefreshToken);
  session.expiresAt = new Date(Date.now() + env.refreshTokenDays * 86400000);
  if (meta.userAgent) session.userAgent = meta.userAgent;
  if (meta.ipAddress) session.ipAddress = meta.ipAddress;
  await session.save();

  return {
    accessToken: signAccessToken(user),
    refreshToken: newRefreshToken,
    user: sanitizeUser(user, await resolveApprovalStatus(user), {
      signupComplete: await resolveSignupComplete(user),
    }),
  };
};

/**
 * Verify an email-verification token. On success the account becomes active
 * and the user is logged in (access token + refresh session), exactly as a
 * normal login would. The user + session writes run in one transaction.
 *
 * @param {string} rawToken - the raw token from the verification link
 * @param {object} [meta] - { userAgent, ipAddress }
 * @returns {Promise<{ accessToken, refreshToken, user }>}
 */
const verifyEmail = async (rawToken, meta = {}) => {
  if (!rawToken) {
    throw { statusCode: 400, message: 'Verification token is required' };
  }

  const user = await User.findOne({
    where: { emailVerificationTokenHash: hashToken(rawToken) },
  });
  if (!user) {
    throw {
      statusCode: 400,
      message: 'Invalid or expired verification link',
    };
  }
  if (
    !user.emailVerificationExpiresAt ||
    new Date(user.emailVerificationExpiresAt).getTime() <= Date.now()
  ) {
    throw {
      statusCode: 400,
      message: 'Invalid or expired verification link',
    };
  }

  // Phase-7: a professional whose application is NOT yet APPROVED gets their
  // email verified but is NOT logged in — they must wait for admin approval.
  const approvalStatus = await resolveApprovalStatus(user);
  const isPendingProfessional =
    user.role === 'professional' && approvalStatus !== 'APPROVED';

  const result = await sequelize.transaction(async (transaction) => {
    user.emailVerified = true;
    user.accountVerified = true;
    // A pending professional stays 'pending_verification' until approved.
    user.status = isPendingProfessional ? user.status : 'active';
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    user.emailVerificationSentAt = null;
    if (!user.uuid) user.uuid = genUuid();
    if (!user.memberSince) user.memberSince = user.createdAt || new Date();

    if (isPendingProfessional) {
      // No auto-login: do not flip isOnline / lastLogin, no session.
      await user.save({ transaction });
      return {
        noSession: true,
        user: sanitizeUser(user, approvalStatus, {
        signupComplete: await resolveSignupComplete(user),
      }),
        emailVerified: true,
        approvalStatus,
      };
    }

    user.isOnline = true;
    user.lastLogin = new Date();
    await user.save({ transaction });

    // Auto-login: create a refresh session inside the same transaction.
    const refreshToken = generateRefreshToken();
    await Session.create(
      {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        userAgent: meta.userAgent || null,
        ipAddress: meta.ipAddress || null,
        expiresAt: new Date(Date.now() + env.refreshTokenDays * 86400000),
      },
      { transaction }
    );

    return {
      accessToken: signAccessToken(user),
      refreshToken,
      user: sanitizeUser(user, approvalStatus, {
        signupComplete: await resolveSignupComplete(user),
      }),
    };
  });

  // Welcome notification — created outside the transaction; a failure here
  // must not undo a successful verification. Skipped for pending pros (they
  // already received the "pending approval" registration notification).
  if (!isPendingProfessional) {
    try {
      await notificationService.createNotification({
        userId: user.id,
        type: 'welcome',
        title: 'Welcome to Profirmo',
        message:
          'Your email has been verified and your account is now active.',
        link: '/dashboard',
      });
    } catch (err) {
      console.error(
        '[Auth] Failed to create welcome notification:',
        err.message || err
      );
    }
  }

  return result;
};

/**
 * Resend the email-verification email. Always resolves the same way whether
 * or not the account exists / is already verified, so it never leaks account
 * existence. When applicable it regenerates the token + expiry and queues a
 * fresh email.
 * @param {string} email
 * @returns {Promise<void>}
 */
const resendVerification = async (email) => {
  const normalized = (email || '').toLowerCase().trim();
  if (!normalized) return;

  const user = await User.findOne({ where: { email: normalized } });
  if (!user || user.emailVerified) return;

  const verification = buildVerificationToken();
  user.emailVerificationTokenHash = verification.tokenHash;
  user.emailVerificationExpiresAt = verification.expiresAt;
  user.emailVerificationSentAt = new Date();
  await user.save();

  await enqueueVerificationEmail(user, verification.rawToken);
};

/**
 * Fetch the current user (sanitized) by id.
 * @param {string} userId
 * @returns {Promise<object>}
 */
const getCurrentUser = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, message: 'User not found' };
  }
  return sanitizeUserWithApproval(user);
};

// --- Password reset (forgot-password + email OTP) --------------------------
//
// Flow: forgotPassword -> (email OTP) -> verifyPasswordOtp -> (resetToken)
//       -> resetPassword. OTPs are bcrypt-hashed at rest, single-use,
//       10-minute expiry, max 5 verify attempts, 60s resend cooldown and a
//       hard cap of 5 resends. Account existence is never revealed.

const ORGANIZATION_NAME = 'Profirmo';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESET_TOKEN_TTL = '15m'; // short-lived reset JWT
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_RESENDS = 5;
const MAX_VERIFY_ATTEMPTS = 5;

// Generic message returned by forgot-password / resend-otp regardless of
// whether an account actually exists — never leaks account existence.
const GENERIC_RESET_MESSAGE =
  'If an account exists for this email, a verification code has been sent.';

// RFC5322-ish email check, matching the project's validateRequest rules.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Queue a password-reset OTP email for an address.
 * @param {object} user - user record (for the display name)
 * @param {string} email - normalized recipient address
 * @param {string} otp - the plain 6-digit OTP
 * @returns {Promise<void>}
 */
const enqueuePasswordResetOtpEmail = async (user, email, otp) => {
  await enqueue('email', {
    to: email,
    template: 'passwordResetOtp',
    vars: {
      userName:
        (user && (user.fullName || user.firstName || user.name)) || 'there',
      otp,
      organizationName: ORGANIZATION_NAME,
    },
  });
};

/**
 * Begin a password reset. Always resolves the same way whether or not the
 * account exists, so it never leaks account existence. When a user exists,
 * any prior un-used OTP rows for the email are invalidated and a single fresh
 * OTP row + email are created.
 * @param {string} rawEmail
 * @param {object} [opts] - { req } for audit logging
 * @returns {Promise<void>}
 */
const forgotPassword = async (rawEmail, opts = {}) => {
  const email = (rawEmail || '').toLowerCase().trim();
  // Caller (controller) already validated format; bail quietly if missing.
  if (!email || !EMAIL_RE.test(email)) return;

  const user = await User.findOne({ where: { email } });
  // No user: do NOT reveal it — skip silently.
  if (!user) return;

  // Invalidate any existing un-used OTP rows for this email.
  await PasswordResetOtp.update(
    { used: true },
    { where: { email, used: false } }
  );

  const now = new Date();
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);

  const row = await PasswordResetOtp.create({
    userId: user.id,
    email,
    otpHash,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    used: false,
    verified: false,
    attemptCount: 0,
    resendCount: 0,
    lastSentAt: now,
  });

  await enqueuePasswordResetOtpEmail(user, email, otp);

  try {
    await notificationService.createNotification({
      userId: user.id,
      type: 'password_reset',
      title: 'Password reset requested',
      message:
        'We received a request to reset your password. A verification ' +
        'code has been sent to your email.',
      link: '/reset-password',
    });
  } catch (err) {
    console.error(
      '[Auth] Failed to create password-reset notification:',
      err.message || err
    );
  }

  await logAudit({
    req: opts.req,
    userId: user.id,
    action: 'auth.password_reset_requested',
    entity: 'user',
    entityId: user.id,
    status: 'success',
    metadata: { email, otpId: row.id },
  });
};

/**
 * Resend a password-reset OTP. Enforces a 60-second cooldown and a hard cap
 * of 5 resends per reset row.
 * @param {string} rawEmail
 * @param {object} [opts] - { req } for audit logging
 * @returns {Promise<{ message: string }>}
 * @throws {{ statusCode, message }} on cooldown / limit violations
 */
const resendOtp = async (rawEmail, opts = {}) => {
  const email = (rawEmail || '').toLowerCase().trim();

  const row = email
    ? await PasswordResetOtp.findOne({
        where: { email, used: false },
        order: [['createdAt', 'DESC']],
      })
    : null;

  // No active row — respond with the same generic message, no email.
  if (!row) return { message: GENERIC_RESET_MESSAGE };

  const now = new Date();

  // 60-second cooldown.
  if (
    row.lastSentAt &&
    now.getTime() - new Date(row.lastSentAt).getTime() < RESEND_COOLDOWN_MS
  ) {
    throw {
      statusCode: 429,
      message: 'Please wait before requesting another code.',
    };
  }

  // Hard cap on resends — invalidate the row and force a restart.
  if (row.resendCount >= MAX_RESENDS) {
    row.used = true;
    await row.save();
    throw {
      statusCode: 429,
      message:
        'Resend limit reached. Please restart the password reset process.',
    };
  }

  const otp = generateOtp();
  row.otpHash = await hashOtp(otp);
  row.expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  row.attemptCount = 0;
  row.resendCount += 1;
  row.lastSentAt = now;
  row.verified = false;
  await row.save();

  const user = await User.findByPk(row.userId);
  await enqueuePasswordResetOtpEmail(user, email, otp);

  await logAudit({
    req: opts.req,
    userId: row.userId,
    action: 'auth.password_reset_otp_resent',
    entity: 'user',
    entityId: row.userId,
    status: 'success',
    metadata: { email, otpId: row.id, resendCount: row.resendCount },
  });

  return { message: GENERIC_RESET_MESSAGE };
};

/**
 * Verify a password-reset OTP. On success the row is marked verified and a
 * short-lived reset JWT is issued for the final reset-password step.
 * @param {string} rawEmail
 * @param {string} otp - the candidate 6-digit OTP
 * @param {object} [opts] - { req } for audit logging
 * @returns {Promise<{ resetToken: string }>}
 * @throws {{ statusCode, code, message, data }} on invalid / incorrect OTP
 */
const verifyPasswordOtp = async (rawEmail, otp, opts = {}) => {
  const email = (rawEmail || '').toLowerCase().trim();
  const code = String(otp == null ? '' : otp).trim();

  const row = email
    ? await PasswordResetOtp.findOne({
        where: { email, used: false, verified: false },
        order: [['createdAt', 'DESC']],
      })
    : null;

  // No active row, or expired — generic invalid response.
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) {
    throw {
      statusCode: 400,
      code: 'OTP_INVALID',
      message: 'Invalid or expired verification code.',
    };
  }

  row.attemptCount += 1;
  const matches = await verifyOtp(code, row.otpHash);

  if (matches) {
    row.verified = true;
    await row.save();

    const resetToken = jwt.sign(
      { otpId: row.id, userId: row.userId, purpose: 'password_reset' },
      env.jwtSecret,
      { expiresIn: RESET_TOKEN_TTL }
    );

    await logAudit({
      req: opts.req,
      userId: row.userId,
      action: 'auth.password_reset_otp_verified',
      entity: 'user',
      entityId: row.userId,
      status: 'success',
      metadata: { email, otpId: row.id },
    });

    return { resetToken };
  }

  // Incorrect OTP. Invalidate the row once attempts are exhausted.
  if (row.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    row.used = true;
    await row.save();

    await logAudit({
      req: opts.req,
      userId: row.userId,
      action: 'auth.password_reset_otp_verify_failed',
      entity: 'user',
      entityId: row.userId,
      status: 'failure',
      metadata: {
        email,
        otpId: row.id,
        reason: 'attempts_exceeded',
        attemptCount: row.attemptCount,
      },
    });

    throw {
      statusCode: 429,
      code: 'OTP_ATTEMPTS_EXCEEDED',
      message:
        'Too many incorrect attempts. Please restart the password reset ' +
        'process.',
    };
  }

  await row.save();

  await logAudit({
    req: opts.req,
    userId: row.userId,
    action: 'auth.password_reset_otp_verify_failed',
    entity: 'user',
    entityId: row.userId,
    status: 'failure',
    metadata: {
      email,
      otpId: row.id,
      reason: 'incorrect',
      attemptCount: row.attemptCount,
    },
  });

  throw {
    statusCode: 400,
    code: 'OTP_INCORRECT',
    message: 'Incorrect code.',
    data: { attemptsRemaining: MAX_VERIFY_ATTEMPTS - row.attemptCount },
  };
};

// Password strength: min 8 chars, >=1 uppercase, >=1 lowercase, >=1 digit,
// >=1 special character. Returns an error string, or null when strong.
const checkPasswordStrength = (password) => {
  const value = String(password == null ? '' : password);
  if (value.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(value)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(value)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(value)) {
    return 'Password must contain at least one digit.';
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return 'Password must contain at least one special character.';
  }
  return null;
};

/**
 * Complete a password reset using a verified reset token. Runs the password
 * write, OTP invalidation and session purge inside one transaction, then
 * emails a confirmation and creates an in-app notification.
 * @param {object} body - { resetToken, newPassword, confirmPassword }
 * @param {object} [opts] - { req } for audit logging
 * @returns {Promise<void>}
 * @throws {{ statusCode, message, errors }} on validation / state failures
 */
const resetPassword = async (body = {}, opts = {}) => {
  const { resetToken, newPassword, confirmPassword } = body;

  if (!resetToken) {
    throw { statusCode: 401, message: 'Invalid or missing reset token.' };
  }

  // Verify the reset JWT.
  let decoded;
  try {
    decoded = jwt.verify(resetToken, env.jwtSecret);
  } catch (err) {
    throw { statusCode: 401, message: 'Invalid or expired reset token.' };
  }
  if (!decoded || decoded.purpose !== 'password_reset' || !decoded.otpId) {
    throw { statusCode: 401, message: 'Invalid or expired reset token.' };
  }

  // The OTP row must exist, be verified, un-used and not expired.
  const row = await PasswordResetOtp.findByPk(decoded.otpId);
  if (
    !row ||
    row.verified !== true ||
    row.used !== false ||
    new Date(row.expiresAt).getTime() <= Date.now()
  ) {
    throw {
      statusCode: 400,
      message:
        'Your reset session is invalid or has expired. Please restart.',
    };
  }

  // Passwords must match.
  if (!newPassword || newPassword !== confirmPassword) {
    throw {
      statusCode: 422,
      message: 'Passwords do not match.',
      errors: { confirmPassword: 'Passwords do not match.' },
    };
  }

  // Strength check.
  const strengthError = checkPasswordStrength(newPassword);
  if (strengthError) {
    throw {
      statusCode: 422,
      message: strengthError,
      errors: { newPassword: strengthError },
    };
  }

  const user = await User.findByPk(row.userId);
  if (!user) {
    throw {
      statusCode: 400,
      message:
        'Your reset session is invalid or has expired. Please restart.',
    };
  }

  // Prevent reuse of the current password.
  const sameAsCurrent = await verifyPassword(newPassword, user.password);
  if (sameAsCurrent) {
    throw {
      statusCode: 422,
      message: 'New password must be different from your current password.',
      errors: {
        newPassword:
          'New password must be different from your current password.',
      },
    };
  }

  const newHash = await hashPassword(newPassword);

  // Atomically: update the password, consume the OTP, purge all sessions.
  await sequelize.transaction(async (transaction) => {
    user.password = newHash;
    await user.save({ transaction });

    row.used = true;
    await row.save({ transaction });

    // Force re-login everywhere by deleting every session for this user.
    await Session.destroy({
      where: { userId: user.id },
      transaction,
    });
  });

  // Confirmation email — queued outside the transaction.
  await enqueue('email', {
    to: user.email,
    template: 'passwordChanged',
    vars: {
      userName: user.fullName || user.firstName || user.name || 'there',
      dateTime: new Date().toLocaleString(),
      organizationName: ORGANIZATION_NAME,
    },
  });

  try {
    await notificationService.createNotification({
      userId: user.id,
      type: 'password_reset',
      title: 'Password changed',
      message:
        'Your account password was changed successfully. If this was not ' +
        'you, please contact support immediately.',
      link: '/login',
    });
  } catch (err) {
    console.error(
      '[Auth] Failed to create password-changed notification:',
      err.message || err
    );
  }

  await logAudit({
    req: opts.req,
    userId: user.id,
    action: 'auth.password_reset_completed',
    entity: 'user',
    entityId: user.id,
    status: 'success',
    metadata: { email: user.email, otpId: row.id },
  });
};

/**
 * Tell whether the supplied email and/or mobile number already belong to a
 * user account. Used by the signup wizard before it tries to create the
 * account so we can show "this account already exists" instead of a 409
 * after the user has filled in all of Step 1.
 *
 * @param {{email?: string, mobileNumber?: string}} input
 * @returns {Promise<{
 *   emailTaken: boolean,
 *   mobileTaken: boolean,
 *   takenBy: 'email' | 'mobile' | 'both' | null,
 * }>}
 */
async function checkAvailability({ email, mobileNumber } = {}) {
  let emailTaken = false;
  let mobileTaken = false;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanMobile = (mobileNumber || '').trim();
  if (cleanEmail) {
    const u = await User.findOne({ where: { email: cleanEmail } });
    emailTaken = Boolean(u);
  }
  if (cleanMobile) {
    const u = await User.findOne({ where: { mobileNumber: cleanMobile } });
    mobileTaken = Boolean(u);
  }
  let takenBy = null;
  if (emailTaken && mobileTaken) takenBy = 'both';
  else if (emailTaken) takenBy = 'email';
  else if (mobileTaken) takenBy = 'mobile';
  return { emailTaken, mobileTaken, takenBy };
}

module.exports = {
  sanitizeUser,
  sanitizeUserWithApproval,
  resolveApprovalStatus,
  signup,
  login,
  logout,
  refresh,
  registerClient,
  registerProfessional,
  registerFirm,
  verifyEmail,
  resendVerification,
  getCurrentUser,
  forgotPassword,
  resendOtp,
  verifyPasswordOtp,
  resetPassword,
  GENERIC_RESET_MESSAGE,
  // Client-invitation flow ----------------------------------------------------
  buildVerificationToken,
  enqueueClientInvitationEmail,
  getClaimInfo,
  claimClientAccount,
  checkAvailability,
};

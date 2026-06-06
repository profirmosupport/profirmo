const { Op } = require('sequelize');
const {
  User,
  Professional,
  Firm,
  Case,
  Booking,
  Consultation,
  Review,
  AuditLog,
  ProfessionalApproval,
  LawFirm,
  FirmApproval,
  FirmInvitation,
  Payment,
  SubscriptionPayment,
  SubscriptionPlan,
  ProfessionalSubscription,
  PayoutRequest,
  ProfessionalDetail,
} = require('../models');
const { hashPassword } = require('../utils/password');

// Only these roles are accepted at the system level. Firms are not a user
// role — they are entities owned by professionals (see LawFirm.ownerUserId).
// `platform_admin` can be created by another admin, but the public signup
// paths cannot produce one.
const VALID_ROLES = ['client', 'professional', 'platform_admin'];

// Strip the password before exposing a user record.
const sanitizeUser = (user) => {
  const plain = typeof user.get === 'function' ? user.get({ plain: true }) : user;
  const { password, ...rest } = plain;
  return rest;
};

/**
 * Aggregate platform-wide statistics for the admin dashboard.
 * `revenue` is a placeholder sum of completed-booking estimated costs
 * and ended-consultation costs.
 */
const getStats = async () => {
  const [
    users,
    professionals,
    firms,
    clients,
    cases,
    bookings,
    consultations,
    reviews,
    pendingProfessionals,
  ] = await Promise.all([
    User.count(),
    Professional.count(),
    Firm.count(),
    User.count({ where: { role: 'client' } }),
    Case.count(),
    Booking.count(),
    Consultation.count(),
    Review.count(),
    Professional.count({ where: { status: 'pending' } }),
  ]);

  const completedBookings = await Booking.findAll({
    where: { status: 'completed' },
    attributes: ['estimatedCost'],
    raw: true,
  });
  const endedConsultations = await Consultation.findAll({
    where: { callStatus: 'ended' },
    attributes: ['cost'],
    raw: true,
  });

  const bookingRevenue = completedBookings.reduce(
    (sum, b) => sum + (b.estimatedCost || 0),
    0
  );
  const consultationRevenue = endedConsultations.reduce(
    (sum, c) => sum + (c.cost || 0),
    0
  );

  return {
    totals: {
      users,
      professionals,
      firms,
      clients,
      cases,
      bookings,
      consultations,
      reviews,
    },
    pendingProfessionals,
    revenue: {
      currency: 'INR',
      fromBookings: bookingRevenue,
      fromConsultations: consultationRevenue,
      total: bookingRevenue + consultationRevenue,
      note: 'Placeholder revenue figure derived from stored data.',
    },
  };
};

/**
 * List users (sanitized, password excluded) with pagination, optional role /
 * status filters and a free-text search across name + email fields. Newest
 * first.
 * @param {object} [opts]
 * @param {number} [opts.page]   - 1-based page number
 * @param {number} [opts.limit]  - rows per page
 * @param {string} [opts.role]   - exact role filter
 * @param {string} [opts.status] - exact status filter
 * @param {string} [opts.search] - matches firstName/lastName/fullName/email
 * @returns {Promise<{ rows: Array, page: number, limit: number, total: number }>}
 */
const listUsers = async ({
  page = 1,
  limit = 20,
  role,
  status,
  search,
} = {}) => {
  const safePage = Number(page) > 0 ? Math.floor(Number(page)) : 1;
  const safeLimit =
    Number(limit) > 0 ? Math.min(Math.floor(Number(limit)), 100) : 20;

  const where = {};
  if (role) where.role = role;
  if (status) where.status = status;
  if (search) {
    const term = `%${String(search).trim()}%`;
    where[Op.or] = [
      { firstName: { [Op.like]: term } },
      { lastName: { [Op.like]: term } },
      { fullName: { [Op.like]: term } },
      { email: { [Op.like]: term } },
    ];
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  });

  // Attach the latest approval status to professional users.
  const profUserIds = rows
    .filter((u) => u.role === 'professional')
    .map((u) => u.id);
  let approvalByUser = new Map();
  if (profUserIds.length) {
    const approvals = await ProfessionalApproval.findAll({
      where: { userId: { [Op.in]: profUserIds } },
      order: [['createdAt', 'DESC']],
      raw: true,
    });
    for (const a of approvals) {
      if (!approvalByUser.has(a.userId)) {
        approvalByUser.set(a.userId, a.status);
      }
    }
  }

  return {
    rows: rows.map((u) => {
      const safe = sanitizeUser(u);
      if (safe.role === 'professional') {
        safe.approvalStatus = approvalByUser.get(safe.id) || null;
      }
      return safe;
    }),
    page: safePage,
    limit: safeLimit,
    total: count,
  };
};

/** List professionals awaiting admin approval. */
const getPendingProfessionals = async () =>
  Professional.findAll({ where: { status: 'pending' }, raw: true });

/** Approve a pending professional. Returns null when not found. */
const approveProfessional = async (id) => {
  const professional = await Professional.findByPk(id);
  if (!professional) return null;
  await professional.update({ status: 'approved', verified: true });
  return professional.get({ plain: true });
};

/** List all firms. */
const listFirms = async () => Firm.findAll({ raw: true });

/** List all bookings. */
const listBookings = async () => Booking.findAll({ raw: true });

/**
 * List recent audit logs, newest first, with simple pagination and optional
 * action / status / userId filters.
 * @param {object} [opts]
 * @param {number} [opts.page]   - 1-based page number
 * @param {number} [opts.limit]  - rows per page
 * @param {string} [opts.action] - exact-match action filter
 * @param {string} [opts.status] - exact-match status filter
 * @param {string} [opts.userId] - exact-match acting-user filter
 * @returns {Promise<{ rows: Array, page: number, limit: number, total: number }>}
 */
const listAuditLogs = async ({
  page = 1,
  limit = 20,
  action,
  status,
  userId,
} = {}) => {
  const safePage = Number(page) > 0 ? Math.floor(Number(page)) : 1;
  const safeLimit =
    Number(limit) > 0 ? Math.min(Math.floor(Number(limit)), 100) : 20;

  const where = {};
  if (action) where.action = action;
  if (status) where.status = status;
  if (userId) where.userId = userId;

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
    raw: true,
  });
  return { rows, page: safePage, limit: safeLimit, total: count };
};

/**
 * Build a comprehensive admin dashboard snapshot in a single call using
 * efficient count() queries.
 * @returns {Promise<object>}
 */
const getOverview = async () => {
  const [
    totalUsers,
    clientUsers,
    professionalUsers,
    firmAdminUsers,
    firmProfessionalUsers,
    platformAdminUsers,
    totalProfessionals,
    pendingProfessionalApprovals,
    approvedProfessionals,
    totalFirms,
    activeFirms,
    pendingFirmApprovals,
    pendingInvitations,
    recentAuditLogs,
  ] = await Promise.all([
    User.count(),
    User.count({ where: { role: 'client' } }),
    User.count({ where: { role: 'professional' } }),
    User.count({ where: { role: 'firm' } }),
    Promise.resolve(0), // firm_professional collapsed into professional
    User.count({ where: { role: 'platform_admin' } }),
    ProfessionalApproval.count(),
    ProfessionalApproval.count({
      where: {
        status: { [Op.in]: ['PENDING_APPROVAL', 'INFO_REQUESTED'] },
      },
    }),
    ProfessionalApproval.count({ where: { status: 'APPROVED' } }),
    LawFirm.count(),
    LawFirm.count({ where: { status: 'ACTIVE' } }),
    FirmApproval.count({
      where: {
        status: { [Op.in]: ['PENDING_APPROVAL', 'MODIFICATIONS_REQUESTED'] },
      },
    }),
    FirmInvitation.count({ where: { status: 'PENDING' } }),
    AuditLog.findAll({
      order: [['createdAt', 'DESC']],
      limit: 10,
      attributes: [
        'action',
        'status',
        'userId',
        'ipAddress',
        'createdAt',
      ],
      raw: true,
    }),
  ]);

  return {
    users: {
      total: totalUsers,
      byRole: {
        client: clientUsers,
        professional: professionalUsers,
        firm: firmAdminUsers,
        platform_admin: platformAdminUsers,
      },
    },
    professionals: {
      total: totalProfessionals,
      pendingApproval: pendingProfessionalApprovals,
      approved: approvedProfessionals,
    },
    firms: {
      total: totalFirms,
      active: activeFirms,
      pendingApproval: pendingFirmApprovals,
    },
    invitations: {
      pending: pendingInvitations,
    },
    recentAuditLogs,
  };
};

/**
 * Update a user's account status (active | suspended). Guards against
 * suspending the last platform_admin and against an admin suspending
 * themselves.
 * @param {object} opts
 * @param {string} opts.targetUserId - the user being updated
 * @param {string} opts.status       - 'active' | 'suspended'
 * @param {string} opts.actingUserId - the admin performing the change
 * @returns {Promise<{ user: object, previousStatus: string }>}
 */
const updateUserStatus = async ({ targetUserId, status, actingUserId }) => {
  const normalized = String(status || '').toLowerCase().trim();
  if (normalized !== 'active' && normalized !== 'suspended') {
    throw {
      statusCode: 400,
      message: "status must be one of: 'active', 'suspended'",
    };
  }

  const user = await User.findByPk(targetUserId);
  if (!user) {
    throw { statusCode: 404, message: `User not found: ${targetUserId}` };
  }

  if (normalized === 'suspended') {
    if (String(actingUserId) === String(targetUserId)) {
      throw {
        statusCode: 400,
        message: 'You cannot suspend your own account.',
      };
    }
    if (user.role === 'platform_admin') {
      const otherActiveAdmins = await User.count({
        where: {
          role: 'platform_admin',
          status: { [Op.ne]: 'suspended' },
          id: { [Op.ne]: targetUserId },
        },
      });
      if (otherActiveAdmins === 0) {
        throw {
          statusCode: 400,
          message: 'Cannot suspend the only active platform admin.',
        };
      }
    }
  }

  const previousStatus = user.status || 'active';
  user.status = normalized;
  await user.save();

  return { user: sanitizeUser(user), previousStatus };
};

// ---------------------------------------------------------------------------
// Admin user CRUD
// ---------------------------------------------------------------------------

const buildFullName = (firstName, lastName, fallback) =>
  [firstName, lastName].filter(Boolean).join(' ').trim() || fallback || '';

/** Fetch one user by id (sanitized — never includes the password). */
const getUserById = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw { statusCode: 404, message: `User not found: ${id}` };
  return sanitizeUser(user);
};

/** Create a new user. Email must be unique. */
const createUser = async ({ data = {}, actingUserId } = {}) => {
  const email = String(data.email || '').toLowerCase().trim();
  const role = String(data.role || '').toLowerCase().trim();
  const password = String(data.password || '');
  const firstName = String(data.firstName || '').trim();
  const lastName = String(data.lastName || '').trim();
  const mobileNumber = String(data.mobileNumber || '').trim();
  const fullName =
    String(data.fullName || '').trim() ||
    buildFullName(firstName, lastName, '') ||
    String(data.name || '').trim();

  if (!email) throw { statusCode: 422, message: 'email is required' };
  if (!fullName) {
    throw { statusCode: 422, message: 'A name is required' };
  }
  if (!VALID_ROLES.includes(role)) {
    throw {
      statusCode: 422,
      message: `role must be one of: ${VALID_ROLES.join(', ')}`,
    };
  }
  if (!password || password.length < 6) {
    throw {
      statusCode: 422,
      message: 'password must be at least 6 characters',
    };
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw { statusCode: 409, message: 'A user with that email already exists' };
  }

  const hashed = await hashPassword(password);
  const user = await User.create({
    email,
    password: hashed,
    role,
    name: fullName,
    fullName,
    firstName: firstName || null,
    lastName: lastName || null,
    mobileNumber: mobileNumber || null,
    status: 'active',
    accountVerified: true,
    emailVerified: true,
    memberSince: new Date(),
  });

  return { user: sanitizeUser(user), createdBy: actingUserId || null };
};

/** Update mutable fields on a user. Email and role changes are validated. */
const updateUser = async ({ targetUserId, changes = {}, actingUserId } = {}) => {
  const user = await User.findByPk(targetUserId);
  if (!user) {
    throw { statusCode: 404, message: `User not found: ${targetUserId}` };
  }

  const patch = {};
  if (changes.firstName !== undefined) {
    patch.firstName = String(changes.firstName || '').trim() || null;
  }
  if (changes.lastName !== undefined) {
    patch.lastName = String(changes.lastName || '').trim() || null;
  }
  if (changes.fullName !== undefined || changes.name !== undefined) {
    const nm = String(changes.fullName || changes.name || '').trim();
    if (!nm) throw { statusCode: 422, message: 'Name cannot be empty' };
    patch.fullName = nm;
    patch.name = nm;
  } else if (patch.firstName !== undefined || patch.lastName !== undefined) {
    // Recompute the display name when only first/last changed.
    const fn = patch.firstName ?? user.firstName;
    const ln = patch.lastName ?? user.lastName;
    const combined = buildFullName(fn, ln, user.fullName || user.name);
    if (combined) {
      patch.fullName = combined;
      patch.name = combined;
    }
  }
  if (changes.mobileNumber !== undefined) {
    patch.mobileNumber = String(changes.mobileNumber || '').trim() || null;
  }
  if (changes.email !== undefined) {
    const email = String(changes.email || '').toLowerCase().trim();
    if (!email) throw { statusCode: 422, message: 'email cannot be empty' };
    if (email !== user.email) {
      const dup = await User.findOne({
        where: { email, id: { [Op.ne]: user.id } },
      });
      if (dup) {
        throw {
          statusCode: 409,
          message: 'Another user already has that email',
        };
      }
      patch.email = email;
    }
  }
  if (changes.role !== undefined) {
    const role = String(changes.role || '').toLowerCase().trim();
    if (!VALID_ROLES.includes(role)) {
      throw {
        statusCode: 422,
        message: `role must be one of: ${VALID_ROLES.join(', ')}`,
      };
    }
    // Demoting the only active platform_admin is unsafe.
    if (
      user.role === 'platform_admin' &&
      role !== 'platform_admin'
    ) {
      const others = await User.count({
        where: {
          role: 'platform_admin',
          status: { [Op.ne]: 'suspended' },
          id: { [Op.ne]: user.id },
        },
      });
      if (others === 0) {
        throw {
          statusCode: 400,
          message: 'Cannot demote the only active platform admin',
        };
      }
    }
    patch.role = role;
  }
  if (changes.password) {
    const pwd = String(changes.password);
    if (pwd.length < 6) {
      throw {
        statusCode: 422,
        message: 'password must be at least 6 characters',
      };
    }
    patch.password = await hashPassword(pwd);
  }
  // Admin override for the email-verification state. Mirrors the side effects
  // of verifyEmail() when set to true: also flip accountVerified, promote
  // pending_verification users to active, and clear leftover token state.
  if (changes.emailVerified !== undefined) {
    const verified =
      changes.emailVerified === true || changes.emailVerified === 'true';
    patch.emailVerified = verified;
    if (verified) {
      patch.accountVerified = true;
      patch.emailVerificationTokenHash = null;
      patch.emailVerificationExpiresAt = null;
      patch.emailVerificationSentAt = null;
      if (user.status === 'pending_verification') patch.status = 'active';
    }
  }

  await user.update(patch);
  return { user: sanitizeUser(user), updatedBy: actingUserId || null };
};

// ---------------------------------------------------------------------------
// Admin firm CRUD (operates on the `law_firms` table)
// ---------------------------------------------------------------------------

const VALID_FIRM_STATUS = [
  'ACTIVE',
  'PENDING_APPROVAL',
  'MODIFICATIONS_REQUESTED',
  'REJECTED',
];

// Build a public-shaped firm row, optionally with owner + member counts.
const decorateFirm = async (firm) => {
  if (!firm) return null;
  const plain = typeof firm.get === 'function' ? firm.get({ plain: true }) : firm;
  let owner = null;
  if (plain.ownerUserId) {
    const u = await User.findByPk(plain.ownerUserId, { raw: true });
    if (u) {
      owner = {
        id: u.id,
        email: u.email,
        name:
          u.fullName ||
          [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
          u.name ||
          '',
      };
    }
  }
  const { FirmMember } = require('../models');
  const memberCount = await FirmMember.count({
    where: { firmId: plain.id },
  });
  return { ...plain, owner, memberCount };
};

/** List every law firm with optional filters + pagination. */
const listLawFirms = async ({ page, limit, search, status } = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.max(Number(limit) || 20, 1);
  const offset = (safePage - 1) * safeLimit;

  const where = {};
  if (status) where.status = String(status).toUpperCase();
  if (search) {
    const term = String(search).trim();
    if (term) {
      where[Op.or] = [
        { firmName: { [Op.like]: `%${term}%` } },
        { headquarters: { [Op.like]: `%${term}%` } },
        { contactEmail: { [Op.like]: `%${term}%` } },
      ];
    }
  }

  const { rows, count } = await LawFirm.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: safeLimit,
    offset,
  });
  const items = await Promise.all(rows.map((r) => decorateFirm(r)));
  return {
    items,
    page: safePage,
    limit: safeLimit,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / safeLimit)),
  };
};

/** Fetch one law firm by id with owner + members + member count. */
const getLawFirmById = async (id) => {
  const firm = await LawFirm.findByPk(id);
  if (!firm) throw { statusCode: 404, message: 'Firm not found' };
  const decorated = await decorateFirm(firm);
  // Member detail (name + role + joined date).
  const { FirmMember, ProfessionalDetail } = require('../models');
  const memberRows = await FirmMember.findAll({
    where: { firmId: id },
    raw: true,
  });
  const detailIds = [
    ...new Set(memberRows.map((m) => m.professionalId).filter(Boolean)),
  ];
  const details = detailIds.length
    ? await ProfessionalDetail.findAll({
        where: { id: { [Op.in]: detailIds } },
        raw: true,
      })
    : [];
  const detailById = new Map(details.map((d) => [d.id, d]));
  const userIds = details.map((d) => d.userId).filter(Boolean);
  const users = userIds.length
    ? await User.findAll({ where: { id: { [Op.in]: userIds } }, raw: true })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));
  const members = memberRows.map((m) => {
    const d = detailById.get(m.professionalId);
    const u = d ? userById.get(d.userId) : null;
    return {
      id: m.id,
      professionalId: m.professionalId,
      userId: d && d.userId,
      role: m.role,
      status: m.status,
      joiningDate: m.joiningDate,
      name: u
        ? u.fullName ||
          [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
          u.name ||
          ''
        : '',
      email: (u && u.email) || '',
      professionalType: (d && d.professionalType) || '',
    };
  });
  return { ...decorated, members };
};

/** Create a new law firm. ownerUserId is optional. */
const createLawFirm = async (data = {}, actingUserId) => {
  const firmName = String(data.firmName || '').trim();
  if (!firmName) {
    throw { statusCode: 422, message: 'firmName is required' };
  }
  const ownerUserId = data.ownerUserId ? String(data.ownerUserId) : null;
  if (ownerUserId) {
    const owner = await User.findByPk(ownerUserId);
    if (!owner) {
      throw { statusCode: 422, message: 'ownerUserId does not match a user' };
    }
    const existing = await LawFirm.findOne({ where: { ownerUserId } });
    if (existing) {
      throw {
        statusCode: 409,
        message: 'That user already owns a firm',
      };
    }
  }
  const status = VALID_FIRM_STATUS.includes(String(data.status || '').toUpperCase())
    ? String(data.status).toUpperCase()
    : 'ACTIVE';

  const firm = await LawFirm.create({
    firmName,
    ownerUserId,
    registrationNumber: data.registrationNumber || null,
    headquarters: data.headquarters || null,
    contactEmail: data.contactEmail || null,
    contactNumber: data.contactNumber || null,
    website: data.website || null,
    establishedYear: data.establishedYear || null,
    totalEmployees: data.totalEmployees || null,
    about: data.about || null,
    practiceAreas: Array.isArray(data.practiceAreas) ? data.practiceAreas : [],
    socialLinks: data.socialLinks || {},
    status,
  });

  return { firm: await decorateFirm(firm), createdBy: actingUserId || null };
};

/** Edit a law firm. Validates status if provided. */
/**
 * Flip a professional's home-page `featured` flag. `id` accepts either
 * the legacy linkedId (`prof-N`) or the new ProfessionalDetail.id, so
 * the admin UI can pass whichever it has on hand. Returns the updated
 * row + the resolved canonical id.
 */
const setProfessionalFeatured = async (id, featured) => {
  let detail = null;
  // First try linkedId via the users table.
  const user = await User.findOne({ where: { linkedId: id }, raw: true });
  if (user) {
    detail = await ProfessionalDetail.findOne({ where: { userId: user.id } });
  }
  if (!detail) {
    detail = await ProfessionalDetail.findByPk(id);
  }
  if (!detail) {
    throw { statusCode: 404, message: 'Professional not found.' };
  }
  const next = !!(
    featured === true ||
    featured === 'true' ||
    featured === 1 ||
    featured === '1'
  );
  await detail.update({ featured: next });
  return { id: detail.id, userId: detail.userId, featured: next };
};

const updateLawFirm = async (id, changes = {}) => {
  const firm = await LawFirm.findByPk(id);
  if (!firm) throw { statusCode: 404, message: 'Firm not found' };

  const patch = {};
  const editable = [
    'firmName',
    'registrationNumber',
    'headquarters',
    'contactEmail',
    'contactNumber',
    'website',
    'establishedYear',
    'totalEmployees',
    'about',
    'practiceAreas',
    'socialLinks',
  ];
  for (const key of editable) {
    if (changes[key] !== undefined) patch[key] = changes[key];
  }
  // Admin-curated home-page spotlight. Coerce to a strict boolean so the
  // column stays clean (truthy strings + 0/1 both flow through admin UIs).
  if (changes.featured !== undefined) {
    patch.featured = !!(
      changes.featured === true ||
      changes.featured === 'true' ||
      changes.featured === 1 ||
      changes.featured === '1'
    );
  }
  if (changes.status !== undefined) {
    const next = String(changes.status).toUpperCase();
    if (!VALID_FIRM_STATUS.includes(next)) {
      throw {
        statusCode: 422,
        message: `status must be one of: ${VALID_FIRM_STATUS.join(', ')}`,
      };
    }
    patch.status = next;
  }
  if (changes.ownerUserId !== undefined) {
    const next = changes.ownerUserId ? String(changes.ownerUserId) : null;
    if (next && next !== firm.ownerUserId) {
      const owner = await User.findByPk(next);
      if (!owner) {
        throw { statusCode: 422, message: 'ownerUserId does not match a user' };
      }
      const dup = await LawFirm.findOne({
        where: { ownerUserId: next, id: { [Op.ne]: firm.id } },
      });
      if (dup) {
        throw {
          statusCode: 409,
          message: 'That user already owns another firm',
        };
      }
    }
    patch.ownerUserId = next;
  }
  await firm.update(patch);
  return await decorateFirm(firm);
};

/** Delete a law firm (cascades members/invitations/join-requests). */
const deleteLawFirm = async (id) => {
  const firm = await LawFirm.findByPk(id);
  if (!firm) throw { statusCode: 404, message: 'Firm not found' };
  await firm.destroy();
  return { id };
};

/** Delete a user. Cannot delete yourself or the only active platform admin. */
const deleteUser = async ({ targetUserId, actingUserId } = {}) => {
  if (String(targetUserId) === String(actingUserId)) {
    throw { statusCode: 400, message: 'You cannot delete your own account.' };
  }
  const user = await User.findByPk(targetUserId);
  if (!user) {
    throw { statusCode: 404, message: `User not found: ${targetUserId}` };
  }
  if (user.role === 'platform_admin') {
    const others = await User.count({
      where: {
        role: 'platform_admin',
        status: { [Op.ne]: 'suspended' },
        id: { [Op.ne]: user.id },
      },
    });
    if (others === 0) {
      throw {
        statusCode: 400,
        message: 'Cannot delete the only active platform admin',
      };
    }
  }
  await user.destroy();
  return { id: targetUserId };
};

/**
 * Aggregate every monetary record tied to a single user for the admin
 * user-detail page. Surfaces:
 *   - booking payments where the user is either payer or payee,
 *   - subscription payments the user has made,
 *   - payout requests the user has raised,
 * each with light counterparty / plan decoration so the table can render
 * without a second roundtrip per row.
 *
 * Returns separate arrays so the UI can show them as tabs / sections.
 */
const getUserTransactions = async (userId) => {
  if (!userId) {
    throw { statusCode: 400, message: 'userId is required' };
  }
  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, message: `User not found: ${userId}` };
  }

  // 1. Booking payments — caller may be payer OR payee.
  const bookingPayments = await Payment.findAll({
    where: {
      [Op.or]: [{ userId }, { professionalUserId: userId }],
    },
    order: [['createdAt', 'DESC']],
    limit: 200,
    raw: true,
  });
  const counterIds = [
    ...new Set(
      bookingPayments
        .flatMap((r) => [r.userId, r.professionalUserId])
        .filter((id) => id && id !== userId)
    ),
  ];
  const counterUsers = counterIds.length
    ? await User.findAll({
        where: { id: { [Op.in]: counterIds } },
        attributes: ['id', 'fullName', 'firstName', 'lastName', 'email'],
        raw: true,
      })
    : [];
  const userById = new Map(counterUsers.map((u) => [u.id, u]));
  const display = (u) =>
    u
      ? u.fullName ||
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
        u.email ||
        ''
      : '';
  const bookingIds = [
    ...new Set(bookingPayments.map((r) => r.bookingId).filter(Boolean)),
  ];
  const bookings = bookingIds.length
    ? await Booking.findAll({
        where: { id: { [Op.in]: bookingIds } },
        attributes: ['id', 'date', 'time', 'duration'],
        raw: true,
      })
    : [];
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const bookingPaymentsDecorated = bookingPayments.map((r) => ({
    ...r,
    role: r.userId === userId ? 'payer' : 'payee',
    counterpartyName:
      r.userId === userId
        ? display(userById.get(r.professionalUserId))
        : display(userById.get(r.userId)),
    booking: r.bookingId ? bookingById.get(r.bookingId) || null : null,
  }));

  // 2. Subscription payments — only the user themselves.
  const subscriptionPayments = await SubscriptionPayment.findAll({
    where: { userId },
    order: [['paymentDate', 'DESC'], ['createdAt', 'DESC']],
    limit: 200,
    raw: true,
  });
  const planIds = [
    ...new Set(
      subscriptionPayments.map((r) => r.subscriptionPlanId).filter(Boolean)
    ),
  ];
  const plans = planIds.length
    ? await SubscriptionPlan.findAll({
        where: { id: { [Op.in]: planIds } },
        attributes: ['id', 'name', 'slug'],
        raw: true,
      })
    : [];
  const planById = new Map(plans.map((p) => [p.id, p]));
  const subscriptionPaymentsDecorated = subscriptionPayments.map((r) => ({
    ...r,
    plan: r.subscriptionPlanId ? planById.get(r.subscriptionPlanId) || null : null,
  }));

  // 3. Subscription state — current (active first, else most recent
  //    pending/expired/cancelled) + the full history so admins can see
  //    plan changes over time.
  const subscriptionRows = await ProfessionalSubscription.findAll({
    where: { userId },
    order: [['startDate', 'DESC'], ['createdAt', 'DESC']],
    limit: 50,
    raw: true,
  });
  const subPlanIds = [
    ...new Set(subscriptionRows.map((s) => s.subscriptionPlanId).filter(Boolean)),
  ];
  const subPlansList = subPlanIds.length
    ? await SubscriptionPlan.findAll({
        where: { id: { [Op.in]: subPlanIds } },
        attributes: [
          'id',
          'name',
          'slug',
          'planType',
          'monthlyPrice',
          'annualPrice',
          'currency',
          'commissionPercent',
        ],
        raw: true,
      })
    : [];
  const subPlanById = new Map(subPlansList.map((p) => [p.id, p]));
  const subscriptionHistory = subscriptionRows.map((s) => ({
    ...s,
    plan: s.subscriptionPlanId ? subPlanById.get(s.subscriptionPlanId) || null : null,
  }));
  // Active first; otherwise the newest pending; otherwise the newest row.
  const currentSubscription =
    subscriptionHistory.find((s) => s.status === 'active') ||
    subscriptionHistory.find((s) => s.status === 'pending') ||
    subscriptionHistory[0] ||
    null;

  // 4. Payout requests raised by the user.
  let payoutRequests = [];
  try {
    const rows = await PayoutRequest.findAll({
      where: { professionalUserId: userId },
      order: [['createdAt', 'DESC']],
      limit: 200,
      raw: true,
    });
    payoutRequests = rows;
  } catch {
    /* table may not exist on fresh installs */
  }

  // Totals — cheap to compute alongside the lists, useful for the
  // summary cards at the top of the detail page.
  const sumPaise = (rows, predicate) =>
    rows
      .filter(predicate)
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const totals = {
    bookingPaidIn: sumPaise(
      bookingPaymentsDecorated,
      (r) => r.role === 'payee' && r.status === 'paid'
    ),
    bookingSpent: sumPaise(
      bookingPaymentsDecorated,
      (r) => r.role === 'payer' && r.status === 'paid'
    ),
    // Subscription amounts are stored as rupee DECIMAL — convert to
    // paise so all summary totals share one unit.
    subscriptionSpent: Math.round(
      subscriptionPaymentsDecorated
        .filter((r) => r.paymentStatus === 'paid')
        .reduce((acc, r) => acc + Number(r.totalAmount || r.amount || 0), 0) *
        100
    ),
    payoutPaid: payoutRequests
      .filter((r) => r.status === 'paid' || r.status === 'PAID')
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
  };

  return {
    user: sanitizeUser(user),
    currentSubscription,
    subscriptionHistory,
    bookingPayments: bookingPaymentsDecorated,
    subscriptionPayments: subscriptionPaymentsDecorated,
    payoutRequests,
    totals,
  };
};

module.exports = {
  getStats,
  listUsers,
  getPendingProfessionals,
  approveProfessional,
  listFirms,
  listBookings,
  listAuditLogs,
  getOverview,
  updateUserStatus,
  getUserById,
  getUserTransactions,
  createUser,
  updateUser,
  deleteUser,
  listLawFirms,
  getLawFirmById,
  createLawFirm,
  updateLawFirm,
  deleteLawFirm,
  setProfessionalFeatured,
};

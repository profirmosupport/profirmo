// clientService — clients are first-class users (role='client'). There is no
// separate `clients` table. A single client-user can be linked with multiple
// professionals via the `professional_clients` link table.

const { Op } = require('sequelize');
const {
  User,
  ProfessionalClient,
  ProfessionalDetail,
} = require('../models');
const { paginate } = require('./professionalService');
const { hashPassword } = require('../utils/password');
const authService = require('./authService');

// Synthesised emails (assigned when a professional adds a client without one)
// never receive a real invite — recognising them avoids spamming bogus inboxes.
const isSynthesisedEmail = (email) =>
  typeof email === 'string' && email.endsWith('@profirmo.local');

// Resolve the inviting professional's display name for the email body.
const resolveActorDisplayName = (actor) => {
  if (!actor) return '';
  return (
    actor.fullName ||
    [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim() ||
    actor.name ||
    actor.email ||
    ''
  );
};

// Resolve a `req.user` to the public professional id used as the FK on
// cases / bookings / consultations / reviews / professional_clients.
//   - Legacy professional users carry `linkedId = 'prof-N'`.
//   - New-model professionals resolve via professional_details.userId.
const resolveActorProfessionalId = async (actor) => {
  if (!actor) return null;
  if (actor.linkedId) return actor.linkedId;
  const detail = await ProfessionalDetail.findOne({
    where: { userId: actor.id },
    raw: true,
  });
  return detail ? detail.id : null;
};

// Format a user row in the shape the client-facing surfaces expect. This
// preserves the legacy `{ id, name, email, phone, city, userType }` envelope
// so all downstream consumers (controllers, frontend) continue to work.
const toClientView = (u) => {
  if (!u) return null;
  return {
    id: u.id,
    userId: u.id,
    name:
      u.fullName ||
      [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
      u.name ||
      '',
    email: u.email || '',
    phone: u.mobileNumber || '',
    city: u.city || '',
    userType: u.userType || 'individual',
    profilePhoto: u.profilePhoto || null,
    role: u.role,
    createdAt: u.createdAt,
  };
};

/**
 * List clients with optional filters and pagination. Operates over users
 * where role='client'. When the caller is a professional, the list is
 * scoped to their linked clients via professional_clients.
 */
const list = async ({ filters = {}, page, limit, actor } = {}) => {
  const { page: p, limit: l, offset } = paginate(page, limit);

  // Professionals only see THEIR clients. Platform admins see all.
  let scopedUserIds = null;
  if (actor && actor.role === 'professional') {
    const professionalId = await resolveActorProfessionalId(actor);
    if (!professionalId) {
      return { items: [], page: p, limit: l, total: 0 };
    }
    const links = await ProfessionalClient.findAll({
      where: { professionalId },
      attributes: ['clientUserId'],
      raw: true,
    });
    scopedUserIds = links.map((r) => r.clientUserId);
    if (scopedUserIds.length === 0) {
      return { items: [], page: p, limit: l, total: 0 };
    }
  }

  const where = { role: 'client' };
  if (scopedUserIds) where.id = { [Op.in]: scopedUserIds };
  if (filters.name) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      {
        [Op.or]: [
          { fullName: { [Op.like]: `%${filters.name}%` } },
          { name: { [Op.like]: `%${filters.name}%` } },
        ],
      },
    ];
  }
  if (filters.city) where.city = filters.city;
  if (filters.userType) where.userType = String(filters.userType);

  const { rows, count } = await User.findAndCountAll({
    where,
    limit: l,
    offset,
    order: [['createdAt', 'DESC']],
    raw: true,
  });

  // Decorate each client with their compliance entityType (relative
  // to the calling professional). One bulk lookup so the listing
  // doesn't N+1.
  let entityByClient = new Map();
  if (rows.length > 0 && actor && actor.role === 'professional') {
    // eslint-disable-next-line global-require
    const { ClientComplianceProfile } = require('../models');
    const proId = await resolveActorProfessionalId(actor);
    if (proId) {
      const profiles = await ClientComplianceProfile.findAll({
        where: {
          professionalId: proId,
          clientUserId: { [Op.in]: rows.map((r) => r.id) },
        },
        attributes: ['clientUserId', 'entityType'],
        raw: true,
      });
      entityByClient = new Map(
        profiles.map((p) => [p.clientUserId, p.entityType || null])
      );
    }
  }

  const items = rows.map((u) => ({
    ...toClientView(u),
    entityType: entityByClient.get(u.id) || null,
  }));
  return { items, page: p, limit: l, total: count };
};

/** Find a client by id, or null when not found. */
const getById = async (id) => {
  const user = await User.findByPk(id, { raw: true });
  if (!user || user.role !== 'client') return null;
  return toClientView(user);
};

/**
 * Create a new client. The client lives in the users table (role='client').
 * If `actor` is a professional, a professional_clients link is created so
 * the client appears on their dashboard. Re-creating a client with an
 * existing phone or email reuses that user (no duplicates).
 */
const create = async (data = {}, actor = null) => {
  const phone = String(data.phone || '').trim();
  const emailRaw = String(data.email || '').trim().toLowerCase();
  const name = String(data.name || '').trim();
  const city = String(data.city || '').trim();
  const userType = String(data.userType || 'individual');

  if (!name && !phone && !emailRaw) {
    throw { statusCode: 422, message: 'Provide at least name, phone, or email.' };
  }

  // Block creation when the phone is already taken by a non-client
  // account. Without this guard a typo'd phone in the modal could end
  // up creating a duplicate user with role=client alongside the
  // existing professional/admin row. Match by last-10-digits suffix
  // so stored numbers in any format (+91…, 91…, raw) are caught.
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    const last10 = digits.slice(-10);
    if (last10.length === 10) {
      const taken = await User.findOne({
        where: {
          mobileNumber: { [Op.like]: `%${last10}` },
          role: { [Op.ne]: 'client' },
        },
        raw: true,
      });
      if (taken) {
        throw {
          statusCode: 409,
          message: `This phone is already in the system under a ${taken.role || 'non-client'} account. It can't be added as a client.`,
        };
      }
    }
  }

  // Find-or-create the client-user by phone or email. Only existing users
  // with role='client' qualify for reuse — a professional/admin user that
  // happens to share a phone number does not become someone else's client.
  let user = null;
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    const last10 = digits.slice(-10);
    if (last10.length === 10) {
      user = await User.findOne({
        where: {
          mobileNumber: { [Op.like]: `%${last10}` },
          role: 'client',
        },
      });
    }
  }
  if (!user && emailRaw) {
    user = await User.findOne({ where: { email: emailRaw, role: 'client' } });
  }

  let createdNew = false;
  if (user) {
    // Patch missing profile fields from the caller's payload — never overwrite
    // an existing value (the user may have customised their own profile).
    const patch = {};
    if (!user.fullName && name) patch.fullName = name;
    if (!user.name && name) patch.name = name;
    if (!user.mobileNumber && phone) patch.mobileNumber = phone;
    if (!user.city && city) patch.city = city;
    if (Object.keys(patch).length > 0) await user.update(patch);
  } else {
    // No existing user — create a fresh client-user. The account has no
    // usable password yet; if a real email is provided we email an invite
    // and the client claims the account by setting their own password.
    const email = emailRaw || `pf-client-${Date.now()}@profirmo.local`;
    const realEmail = !isSynthesisedEmail(email);
    const invite = realEmail ? authService.buildVerificationToken() : null;
    user = await User.create({
      email,
      password: '',
      role: 'client',
      name,
      fullName: name,
      mobileNumber: phone || null,
      city,
      userType,
      linkedId: null,
      // Real-email accounts wait on the invite; phone-only accounts are
      // managed-only ("active" so they can be referenced by bookings/cases).
      status: realEmail ? 'invited' : 'active',
      accountVerified: !realEmail,
      emailVerified: !realEmail,
      memberSince: new Date(),
      emailVerificationTokenHash: invite ? invite.tokenHash : null,
      emailVerificationExpiresAt: invite ? invite.expiresAt : null,
      emailVerificationSentAt: invite ? new Date() : null,
    });
    createdNew = true;
    if (invite) {
      try {
        await authService.enqueueClientInvitationEmail(
          user,
          invite.rawToken,
          resolveActorDisplayName(actor)
        );
      } catch (err) {
        console.warn(`[clientInvite] failed to queue email: ${err.message}`);
      }
    }
  }

  // Link the client-user to the calling professional (if any).
  if (actor && actor.role === 'professional') {
    const professionalId = await resolveActorProfessionalId(actor);
    if (professionalId) {
      const existing = await ProfessionalClient.findOne({
        where: { professionalId, clientUserId: user.id },
      });
      if (!existing) {
        await ProfessionalClient.create({
          professionalId,
          clientUserId: user.id,
          addedByUserId: actor.id,
        });
      }
    }
  }

  const view = toClientView(user.get({ plain: true }));
  return {
    ...view,
    inviteSent: createdNew && user.status === 'invited',
  };
};

/** Update an existing client (the user row). Returns null when not found. */
const update = async (id, data = {}) => {
  const user = await User.findByPk(id);
  if (!user || user.role !== 'client') return null;

  const patch = {};
  if (data.name !== undefined) {
    patch.fullName = String(data.name);
    patch.name = String(data.name);
  }
  if (data.email !== undefined) patch.email = String(data.email).toLowerCase();
  if (data.phone !== undefined) patch.mobileNumber = String(data.phone);
  if (data.city !== undefined) patch.city = String(data.city);
  if (data.userType !== undefined) patch.userType = String(data.userType);
  await user.update(patch);

  return toClientView(user.get({ plain: true }));
};

/**
 * Search the users table for a client-user matching the given phone. Only
 * users with role='client' are returned — professional/admin accounts that
 * share a phone number are not eligible as someone else's client.
 */
const searchByPhone = async (phone) => {
  const trimmed = String(phone || '').trim();
  if (!trimmed) return { user: null, existsAsNonClient: false, role: null };

  // Normalise: strip every non-digit, then keep the last 10 digits
  // (the Indian national-number length). Stored mobileNumber values
  // in the DB live in various shapes — '9310819195', '+919310819195',
  // '91 9310 819 195', etc. — so we match by suffix-of-digits.
  const digits = trimmed.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length < 10) {
    return { user: null, existsAsNonClient: false, role: null };
  }
  const user = await User.findOne({
    where: { mobileNumber: { [Op.like]: `%${last10}` } },
    raw: true,
  });
  if (!user) return { user: null, existsAsNonClient: false, role: null };
  if (user.role === 'client') {
    return { user: toClientView(user), existsAsNonClient: false, role: 'client' };
  }
  return { user: null, existsAsNonClient: true, role: user.role || 'unknown' };
};

/** Link an existing client-user to the calling professional. */
const linkToProfessional = async (clientUserId, actor) => {
  const professionalId = await resolveActorProfessionalId(actor);
  if (!professionalId) {
    throw { statusCode: 403, message: 'Only professionals can link clients.' };
  }
  const user = await User.findByPk(clientUserId, { raw: true });
  if (!user || user.role !== 'client') {
    throw { statusCode: 404, message: 'Client user not found.' };
  }
  const existing = await ProfessionalClient.findOne({
    where: { professionalId, clientUserId },
  });
  if (existing) return toClientView(user);
  await ProfessionalClient.create({
    professionalId,
    clientUserId,
    addedByUserId: actor.id,
  });
  return toClientView(user);
};

module.exports = {
  list,
  getById,
  create,
  update,
  searchByPhone,
  linkToProfessional,
  toClientView,
  resolveActorProfessionalId,
};

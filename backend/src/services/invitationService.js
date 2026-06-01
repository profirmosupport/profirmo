// Firm-invitation service for the Profirmo backend (Phase 8).
//
// Holds the database logic behind firm invitations: creating invitations
// (firm-side), listing them, cancelling them, and the invitee-side
// list / accept / reject flows. Multi-row writes use a transaction.
// Raw invitation tokens are emailed only; only their SHA-256 hash is stored.

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize,
  User,
  LawFirm,
  FirmMember,
  FirmInvitation,
  ProfessionalDetail,
} = require('../models');
const { enqueue } = require('./queueService');
const notificationService = require('./notificationService');
const { hashToken } = require('../utils/tokenHelper');
const { resolveFirmContext, canInvite, canCancelInvitations } =
  require('./firmRoleService');
const env = require('../config/env');

// Invitations are valid for 14 days.
const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const VALID_INVITE_ROLES = ['member', 'co-owner'];

// Convert a Sequelize instance (or null) to a plain object (or null).
const plain = (record) =>
  record && typeof record.get === 'function'
    ? record.get({ plain: true })
    : record || null;

const normalizeEmail = (email) => String(email || '').toLowerCase().trim();

/**
 * Resolve the firm the caller can manage invitations for, enforcing the
 * given permission predicate. Throws 403 / 404 as appropriate.
 * @param {string} userId
 * @param {function} permissionFn - role -> boolean
 * @returns {Promise<{ lawFirm: object, role: string }>}
 */
async function requireFirmPermission(userId, permissionFn) {
  const ctx = await resolveFirmContext(userId);
  if (!ctx.lawFirm) {
    throw { statusCode: 404, message: 'You are not part of any law firm' };
  }
  if (!permissionFn(ctx.role)) {
    throw {
      statusCode: 403,
      message: 'You do not have permission to perform this action',
    };
  }
  return { lawFirm: ctx.lawFirm, role: ctx.role };
}

/**
 * Create a firm invitation. Caller must be the firm owner or a co-owner.
 *
 * @param {string} userId - the inviting user
 * @param {object} body - { email, role }
 * @returns {Promise<object>} the created invitation (plain)
 */
async function createInvitation(userId, body = {}) {
  const { lawFirm } = await requireFirmPermission(userId, canInvite);

  const email = normalizeEmail(body.email);
  if (!email) {
    throw {
      statusCode: 422,
      message: 'Validation failed',
      errors: { email: 'email is required' },
    };
  }
  const role = VALID_INVITE_ROLES.includes(body.role) ? body.role : 'member';

  // Resolve a registered user by email, if any.
  const invitedUser = await User.findOne({ where: { email } });

  // Reject if that user is already a member of the firm.
  if (invitedUser) {
    const professionalDetail = await ProfessionalDetail.findOne({
      where: { userId: invitedUser.id },
    });
    if (professionalDetail) {
      const existingMember = await FirmMember.findOne({
        where: {
          firmId: lawFirm.id,
          professionalId: professionalDetail.id,
        },
      });
      if (existingMember) {
        throw {
          statusCode: 409,
          message: 'This user is already a member of the firm',
        };
      }
    }
  }

  // Reject if a PENDING invitation already exists for this email + firm.
  const pendingExisting = await FirmInvitation.findOne({
    where: { firmId: lawFirm.id, email, status: 'PENDING' },
  });
  if (pendingExisting) {
    throw {
      statusCode: 409,
      message: 'A pending invitation already exists for this email',
    };
  }

  // Generate a random token; persist only its hash.
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const invitation = await FirmInvitation.create({
    firmId: lawFirm.id,
    invitedByUserId: userId,
    email,
    invitedUserId: invitedUser ? invitedUser.id : null,
    role,
    status: 'PENDING',
    tokenHash,
    expiresAt,
  });

  const inviter = await User.findByPk(userId);
  const inviterName = inviter
    ? inviter.fullName || inviter.name || 'A firm administrator'
    : 'A firm administrator';

  // In-app notification for a registered invitee.
  if (invitedUser) {
    try {
      await notificationService.createNotification({
        userId: invitedUser.id,
        type: 'firm_invitation',
        title: `You've been invited to join ${lawFirm.firmName}`,
        message: `${inviterName} invited you to join ${lawFirm.firmName} as a ${role}.`,
        // Lands on the pro's "My Firm" page where the new invitations
        // section renders Accept / Reject inline. Replaces the old
        // standalone /invitations route which is being deprecated.
        link: '/dashboard/professional/firm',
        metadata: { invitationId: invitation.id, firmId: lawFirm.id },
      });
    } catch (err) {
      console.error('[Invitation] notification failed:', err.message || err);
    }
  }

  // Always email the invitee (different template copy when not registered).
  const isRegistered = !!invitedUser;
  await enqueue('email', {
    to: email,
    template: 'firmInvitation',
    vars: {
      inviteeName: invitedUser
        ? invitedUser.fullName || invitedUser.name || email
        : email,
      email,
      firmName: lawFirm.firmName,
      inviterName,
      role,
      isRegistered,
      acceptUrl: isRegistered
        ? `${env.appUrl}/dashboard/professional/firm`
        : `${env.appUrl}/signup`,
    },
  });

  return plain(invitation);
}

/**
 * List a firm's invitations (any status), newest first. Caller must be part
 * of the firm.
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
async function listFirmInvitations(userId) {
  const ctx = await resolveFirmContext(userId);
  if (!ctx.lawFirm) {
    throw { statusCode: 404, message: 'You are not part of any law firm' };
  }
  const invitations = await FirmInvitation.findAll({
    where: { firmId: ctx.lawFirm.id },
    order: [['createdAt', 'DESC']],
  });
  return invitations.map((inv) => {
    const i = plain(inv);
    delete i.tokenHash;
    return i;
  });
}

/**
 * Cancel a PENDING invitation. Caller must be the firm owner or co-owner.
 * @param {string} userId
 * @param {string} invitationId
 * @returns {Promise<object>} the cancelled invitation (plain)
 */
async function cancelInvitation(userId, invitationId) {
  const { lawFirm } = await requireFirmPermission(
    userId,
    canCancelInvitations
  );
  const invitation = await FirmInvitation.findOne({
    where: { id: invitationId, firmId: lawFirm.id },
  });
  if (!invitation) {
    throw { statusCode: 404, message: 'Invitation not found in your firm' };
  }
  if (invitation.status !== 'PENDING') {
    throw {
      statusCode: 409,
      message: `Only pending invitations can be cancelled (current: ${invitation.status})`,
    };
  }
  await invitation.update({ status: 'CANCELLED' });
  const result = plain(invitation);
  delete result.tokenHash;
  return result;
}

/**
 * Build the WHERE clause that matches a caller's received invitations:
 * either invitedUserId equals the caller, or email matches the caller's.
 * @param {object} user - the caller User record
 * @returns {object} Sequelize where fragment
 */
const receivedByClause = (user) => ({
  [Op.or]: [
    { invitedUserId: user.id },
    { email: normalizeEmail(user.email) },
  ],
});

/**
 * List the caller's received PENDING invitations, with firm name / logo.
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
async function listMyInvitations(userId) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, message: 'User not found' };
  }
  const invitations = await FirmInvitation.findAll({
    where: { ...receivedByClause(user), status: 'PENDING' },
    order: [['createdAt', 'DESC']],
  });

  const out = [];
  for (const inv of invitations) {
    const i = plain(inv);
    delete i.tokenHash;
    const firm = await LawFirm.findByPk(i.firmId);
    out.push({
      ...i,
      firm: firm
        ? { id: firm.id, firmName: firm.firmName, logo: firm.logo || null }
        : null,
    });
  }
  return out;
}

/**
 * Load an invitation that belongs to the caller and is still actionable
 * (PENDING + not expired). Throws 404 / 403 / 409 as appropriate.
 * @param {object} user - the caller User record
 * @param {string} invitationId
 * @returns {Promise<object>} the FirmInvitation instance
 */
async function loadReceivedInvitation(user, invitationId) {
  const invitation = await FirmInvitation.findByPk(invitationId);
  if (!invitation) {
    throw { statusCode: 404, message: 'Invitation not found' };
  }
  const belongsToCaller =
    invitation.invitedUserId === user.id ||
    normalizeEmail(invitation.email) === normalizeEmail(user.email);
  if (!belongsToCaller) {
    throw {
      statusCode: 403,
      message: 'This invitation does not belong to you',
    };
  }
  if (invitation.status !== 'PENDING') {
    throw {
      statusCode: 409,
      message: `This invitation is no longer pending (current: ${invitation.status})`,
    };
  }
  if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
    // Lazily mark it expired so subsequent reads are consistent.
    await invitation.update({ status: 'EXPIRED' });
    throw { statusCode: 409, message: 'This invitation has expired' };
  }
  return invitation;
}

/**
 * Accept a firm invitation: create a FirmMember row for the caller and mark
 * the invitation ACCEPTED, inside a transaction.
 * @param {string} userId
 * @param {string} invitationId
 * @returns {Promise<{ invitation: object, member: object }>}
 */
async function acceptInvitation(userId, invitationId) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, message: 'User not found' };
  }
  const invitation = await loadReceivedInvitation(user, invitationId);

  // The invitee needs a ProfessionalDetail to join as a firm member.
  let professionalDetail = await ProfessionalDetail.findOne({
    where: { userId },
  });

  // Reject if already a member of this firm.
  if (professionalDetail) {
    const existing = await FirmMember.findOne({
      where: {
        firmId: invitation.firmId,
        professionalId: professionalDetail.id,
      },
    });
    if (existing) {
      throw {
        statusCode: 409,
        message: 'You are already a member of this firm',
      };
    }
  }

  const now = new Date();
  let member;
  await sequelize.transaction(async (transaction) => {
    if (!professionalDetail) {
      // Create a minimal professional profile so the user can be a member.
      professionalDetail = await ProfessionalDetail.create(
        { userId },
        { transaction }
      );
    }
    member = await FirmMember.create(
      {
        firmId: invitation.firmId,
        professionalId: professionalDetail.id,
        role: invitation.role || 'member',
        status: 'active',
        joiningDate: now,
      },
      { transaction }
    );
    await invitation.update(
      { status: 'ACCEPTED', invitedUserId: userId, respondedAt: now },
      { transaction }
    );
  });

  // Notify the firm owner.
  const firm = await LawFirm.findByPk(invitation.firmId);
  if (firm) {
    try {
      await notificationService.createNotification({
        userId: firm.ownerUserId,
        type: 'firm_invitation_accepted',
        title: 'A firm invitation was accepted',
        message: `${user.fullName || user.name || user.email} has joined ${firm.firmName}.`,
        link: '/firm/members',
        metadata: { invitationId: invitation.id, firmId: firm.id },
      });
    } catch (err) {
      console.error('[Invitation] notification failed:', err.message || err);
    }
  }

  const inv = plain(invitation);
  delete inv.tokenHash;
  return { invitation: inv, member: plain(member) };
}

/**
 * Reject a firm invitation.
 * @param {string} userId
 * @param {string} invitationId
 * @returns {Promise<object>} the rejected invitation (plain)
 */
async function rejectInvitation(userId, invitationId) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, message: 'User not found' };
  }
  const invitation = await loadReceivedInvitation(user, invitationId);

  await invitation.update({
    status: 'REJECTED',
    invitedUserId: userId,
    respondedAt: new Date(),
  });

  const firm = await LawFirm.findByPk(invitation.firmId);
  if (firm) {
    try {
      await notificationService.createNotification({
        userId: firm.ownerUserId,
        type: 'firm_invitation_rejected',
        title: 'A firm invitation was declined',
        message: `${user.fullName || user.name || user.email} declined the invitation to join ${firm.firmName}.`,
        link: '/firm/invitations',
        metadata: { invitationId: invitation.id, firmId: firm.id },
      });
    } catch (err) {
      console.error('[Invitation] notification failed:', err.message || err);
    }
  }

  const inv = plain(invitation);
  delete inv.tokenHash;
  return inv;
}

/**
 * Auto-resolve pending invitations for a newly-approved professional: any
 * PENDING invitation addressed to their email with no invitedUserId yet gets
 * linked to the new user and they are notified. Called from the professional
 * approval flow (Phase 8 task 5).
 * @param {object} user - the approved professional's User record (or id)
 * @returns {Promise<number>} number of invitations linked
 */
async function autoResolveInvitationsForUser(user) {
  const resolved =
    user && typeof user.get === 'function' ? user.get({ plain: true }) : user;
  const fullUser =
    resolved && resolved.email
      ? resolved
      : plain(await User.findByPk(resolved && resolved.id ? resolved.id : resolved));
  if (!fullUser || !fullUser.email) return 0;

  const email = normalizeEmail(fullUser.email);
  const invitations = await FirmInvitation.findAll({
    where: { email, invitedUserId: null, status: 'PENDING' },
  });

  for (const invitation of invitations) {
    await invitation.update({ invitedUserId: fullUser.id });
    const firm = await LawFirm.findByPk(invitation.firmId);
    try {
      await notificationService.createNotification({
        userId: fullUser.id,
        type: 'firm_invitation',
        title: 'You have a pending firm invitation',
        message: firm
          ? `You have been invited to join ${firm.firmName}. Open your invitations to respond.`
          : 'You have a pending firm invitation. Open your invitations to respond.',
        link: '/invitations',
        metadata: { invitationId: invitation.id, firmId: invitation.firmId },
      });
    } catch (err) {
      console.error('[Invitation] notification failed:', err.message || err);
    }
  }
  return invitations.length;
}

module.exports = {
  createInvitation,
  listFirmInvitations,
  cancelInvitation,
  listMyInvitations,
  acceptInvitation,
  rejectInvitation,
  autoResolveInvitationsForUser,
};

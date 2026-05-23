// firmJoinService — a professional requests to join a law firm; the firm
// owner / co-owner approves or rejects. Approval creates a FirmMember row.
// Professionals may also leave a firm they belong to.

const { Op } = require('sequelize');
const {
  sequelize,
  User,
  LawFirm,
  FirmMember,
  FirmJoinRequest,
  ProfessionalDetail,
} = require('../models');
const notificationService = require('./notificationService');

// Fire-and-forget notification — never breaks the calling request.
const notify = async (params) => {
  try {
    await notificationService.createNotification(params);
  } catch (err) {
    console.warn(`[notify] failed: ${err.message}`);
  }
};

const plain = (r) =>
  r && typeof r.get === 'function' ? r.get({ plain: true }) : r || null;

const displayName = (u) => {
  if (!u) return '';
  return (
    u.fullName ||
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
    u.name ||
    ''
  );
};

// Ensure the user has a ProfessionalDetail row (firm membership needs one).
const ensureProfessionalDetail = async (userId) => {
  let detail = await ProfessionalDetail.findOne({ where: { userId } });
  if (!detail) detail = await ProfessionalDetail.create({ userId });
  return detail;
};

// Is the caller the owner or a co-owner of the given law firm?
const canManageFirm = async (userId, firmId) => {
  const firm = await LawFirm.findByPk(firmId, { raw: true });
  if (!firm) return false;
  if (firm.ownerUserId === userId) return true;
  const detail = await ProfessionalDetail.findOne({
    where: { userId },
    raw: true,
  });
  if (!detail) return false;
  const member = await FirmMember.findOne({
    where: { firmId, professionalId: detail.id },
    raw: true,
  });
  return Boolean(
    member && ['owner', 'co-owner'].includes(String(member.role))
  );
};

/**
 * The caller's current firm membership, or null when they belong to no firm.
 * A firm owner is detected even when no FirmMember row exists (the LawFirm
 * `ownerUserId` column is authoritative for ownership).
 * @returns {Promise<{ firm, member }|null>}
 */
const getMyMembership = async (userId) => {
  // 1. Owner check — authoritative.
  const owned = await LawFirm.findOne({
    where: { ownerUserId: userId },
    raw: true,
  });
  if (owned) {
    const detail = await ProfessionalDetail.findOne({
      where: { userId },
      raw: true,
    });
    let member = null;
    if (detail) {
      member = await FirmMember.findOne({
        where: { firmId: owned.id, professionalId: detail.id },
        raw: true,
      });
    }
    return {
      firm: owned,
      member: member || {
        id: null,
        firmId: owned.id,
        role: 'owner',
        status: 'active',
      },
    };
  }

  // 2. Otherwise resolve via FirmMember.
  const detail = await ProfessionalDetail.findOne({
    where: { userId },
    raw: true,
  });
  if (!detail) return null;
  const member = await FirmMember.findOne({
    where: { professionalId: detail.id, status: 'active' },
    raw: true,
  });
  if (!member) return null;
  const firm = await LawFirm.findByPk(member.firmId, { raw: true });
  return { firm: firm || null, member };
};

/** ACTIVE law firms the caller can request to join (not already a member). */
const listJoinableFirms = async (userId) => {
  const membership = await getMyMembership(userId);
  const firms = await LawFirm.findAll({
    where: { status: 'ACTIVE' },
    raw: true,
  });
  const myFirmId = membership && membership.firm && membership.firm.id;
  return firms
    .filter((f) => f.id !== myFirmId)
    .map((f) => ({
      id: f.id,
      firmName: f.firmName || '',
      logo: f.logo || null,
      headquarters: f.headquarters || '',
      about: f.about || '',
    }));
};

/** Create a join request for the caller against a law firm. */
const requestJoin = async (userId, firmId, message) => {
  if (!firmId) throw { statusCode: 422, message: 'firmId is required' };

  // Accept either the actual law_firms.id or its legacyFirmId so the public
  // listing's firm ids work seamlessly.
  let firm = await LawFirm.findByPk(firmId, { raw: true });
  if (!firm) {
    firm = await LawFirm.findOne({
      where: { legacyFirmId: firmId },
      raw: true,
    });
  }
  if (!firm) throw { statusCode: 404, message: 'Firm not found.' };
  if (firm.status !== 'ACTIVE') {
    throw { statusCode: 409, message: 'This firm is not accepting members.' };
  }

  // Must not already belong to a firm.
  const membership = await getMyMembership(userId);
  if (membership) {
    throw {
      statusCode: 409,
      message: 'You are already a member of a firm. Leave it first.',
    };
  }

  // No duplicate pending request to the same firm.
  const existing = await FirmJoinRequest.findOne({
    where: { userId, firmId, status: 'PENDING' },
  });
  if (existing) {
    throw {
      statusCode: 409,
      message: 'You already have a pending request to this firm.',
    };
  }

  const detail = await ensureProfessionalDetail(userId);
  const request = await FirmJoinRequest.create({
    firmId: firm.id,
    userId,
    professionalId: detail.id,
    message: String(message || '').trim(),
    status: 'PENDING',
  });

  // Notify the firm owner so they can act on the request.
  if (firm.ownerUserId) {
    const requester = await User.findByPk(userId, { raw: true });
    const requesterName =
      (requester && displayName(requester)) || 'A professional';
    await notify({
      userId: firm.ownerUserId,
      type: 'firm_join_request',
      title: 'New firm join request',
      message: `${requesterName} has requested to join ${
        firm.firmName || 'your firm'
      }.`,
      link: '/dashboard/firm/join-requests',
      metadata: { requestId: request.id, firmId: firm.id, userId },
    });
  }

  return plain(request);
};

/** The caller's own join requests, newest first, with firm names. */
const listMyRequests = async (userId) => {
  const requests = await FirmJoinRequest.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  if (requests.length === 0) return [];
  const firms = await LawFirm.findAll({
    where: { id: { [Op.in]: requests.map((r) => r.firmId) } },
    raw: true,
  });
  const firmById = new Map(firms.map((f) => [f.id, f]));
  return requests.map((r) => ({
    ...r,
    firmName: (firmById.get(r.firmId) || {}).firmName || '',
  }));
};

/** Join requests for the firm the caller owns / co-owns. */
const listFirmRequests = async (userId) => {
  const firm = await LawFirm.findOne({
    where: { ownerUserId: userId },
    raw: true,
  });
  if (!firm) return { firm: null, requests: [] };

  const requests = await FirmJoinRequest.findAll({
    where: { firmId: firm.id },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  const users = await User.findAll({
    where: { id: { [Op.in]: requests.map((r) => r.userId).filter(Boolean) } },
    raw: true,
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  return {
    firm: { id: firm.id, firmName: firm.firmName || '' },
    requests: requests.map((r) => {
      const u = userById.get(r.userId);
      return {
        ...r,
        applicantName: displayName(u),
        applicantEmail: (u && u.email) || '',
        applicantPhoto: (u && u.profilePhoto) || null,
      };
    }),
  };
};

/** The caller cancels their own pending join request. */
const cancelRequest = async (userId, requestId) => {
  const request = await FirmJoinRequest.findByPk(requestId);
  if (!request || request.userId !== userId) {
    throw { statusCode: 404, message: 'Request not found.' };
  }
  if (request.status !== 'PENDING') {
    throw { statusCode: 409, message: 'This request is no longer pending.' };
  }
  await request.update({ status: 'CANCELLED' });
  return plain(request);
};

/**
 * Firm owner / co-owner decides a join request.
 * @param {'approve'|'reject'} decision
 */
const decideRequest = async (userId, requestId, decision) => {
  const d = String(decision || '').toLowerCase();
  if (d !== 'approve' && d !== 'reject') {
    throw {
      statusCode: 422,
      message: "decision must be 'approve' or 'reject'",
    };
  }
  const request = await FirmJoinRequest.findByPk(requestId);
  if (!request) throw { statusCode: 404, message: 'Request not found.' };

  const allowed = await canManageFirm(userId, request.firmId);
  if (!allowed) {
    throw {
      statusCode: 403,
      message: 'Only the firm owner can decide join requests.',
    };
  }
  if (request.status !== 'PENDING') {
    throw {
      statusCode: 409,
      message: 'This request has already been decided.',
    };
  }

  if (d === 'approve') {
    await sequelize.transaction(async (transaction) => {
      // Skip if somehow already a member.
      const existing = await FirmMember.findOne({
        where: {
          firmId: request.firmId,
          professionalId: request.professionalId,
        },
        transaction,
      });
      if (!existing) {
        await FirmMember.create(
          {
            firmId: request.firmId,
            professionalId: request.professionalId,
            role: 'member',
            status: 'active',
            joiningDate: new Date(),
          },
          { transaction }
        );
      }
      await request.update(
        {
          status: 'APPROVED',
          decidedByUserId: userId,
          decidedAt: new Date(),
        },
        { transaction }
      );
    });
  } else {
    await request.update({
      status: 'REJECTED',
      decidedByUserId: userId,
      decidedAt: new Date(),
    });
  }

  // Notify the requester that their join request was decided.
  const firmInfo = await LawFirm.findByPk(request.firmId, { raw: true });
  const firmName = (firmInfo && firmInfo.firmName) || 'the firm';
  await notify({
    userId: request.userId,
    type: 'firm_join_decision',
    title:
      d === 'approve'
        ? 'Firm join request approved'
        : 'Firm join request rejected',
    message:
      d === 'approve'
        ? `You are now a member of ${firmName}.`
        : `Your request to join ${firmName} was not approved.`,
    link: '/dashboard/professional/firm',
    metadata: {
      requestId: request.id,
      firmId: request.firmId,
      decision: d === 'approve' ? 'APPROVED' : 'REJECTED',
    },
  });

  return plain(request);
};

/** The caller leaves the firm they belong to (owners cannot leave). */
const leaveFirm = async (userId) => {
  const membership = await getMyMembership(userId);
  if (!membership) {
    throw { statusCode: 404, message: 'You are not a member of any firm.' };
  }
  if (String(membership.member.role) === 'owner') {
    throw {
      statusCode: 409,
      message: 'A firm owner cannot leave their own firm.',
    };
  }
  await FirmMember.destroy({ where: { id: membership.member.id } });
  return { firmId: membership.member.firmId };
};

module.exports = {
  getMyMembership,
  listJoinableFirms,
  requestJoin,
  listMyRequests,
  listFirmRequests,
  cancelRequest,
  decideRequest,
  leaveFirm,
};

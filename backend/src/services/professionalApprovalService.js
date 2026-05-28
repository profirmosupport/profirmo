// Professional approval-workflow service (Phase 7).
//
// Admin-facing operations for reviewing professional registrations: listing
// pending applications, fetching the full review payload, and the
// approve / reject / request-info actions. Multi-row writes use a transaction.

const { Op } = require('sequelize');
const {
  sequelize,
  User,
  Address,
  ProfessionalDetail,
  LawyerDetail,
  TaxConsultantDetail,
  ProfessionalApproval,
  Category,
  SubCategory,
} = require('../models');
const { enqueue } = require('./queueService');
const notificationService = require('./notificationService');
const invitationService = require('./invitationService');
const env = require('../config/env');

// Public view of a user (name / email only) for review listings.
const reviewUserView = (user) => {
  if (!user) return null;
  const u = typeof user.get === 'function' ? user.get({ plain: true }) : user;
  return {
    id: u.id,
    firstName: u.firstName || null,
    lastName: u.lastName || null,
    fullName: u.fullName || u.name || null,
    email: u.email || null,
    mobileNumber: u.mobileNumber || null,
    profilePhoto: u.profilePhoto || null,
  };
};

/**
 * List professional applications awaiting review (PENDING_APPROVAL or
 * INFO_REQUESTED), newest first, paginated.
 * @param {object} [opts] - { page, limit }
 * @returns {Promise<{ rows, page, limit, total }>}
 */
async function listPending({ page = 1, limit = 20 } = {}) {
  const safePage = Number(page) > 0 ? Math.floor(Number(page)) : 1;
  const safeLimit =
    Number(limit) > 0 ? Math.min(Math.floor(Number(limit)), 100) : 20;

  const { rows, count } = await ProfessionalApproval.findAndCountAll({
    where: { status: { [Op.in]: ['PENDING_APPROVAL', 'INFO_REQUESTED'] } },
    order: [['submittedAt', 'DESC']],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  });

  const userIds = rows.map((r) => r.userId);
  const users = userIds.length
    ? await User.findAll({ where: { id: { [Op.in]: userIds } } })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const items = rows.map((approval) => {
    const a = approval.get({ plain: true });
    return {
      id: a.id,
      userId: a.userId,
      professionalDetailId: a.professionalDetailId,
      professionalType: a.professionalType,
      status: a.status,
      submittedAt: a.submittedAt,
      reviewedAt: a.reviewedAt,
      resubmissionCount: a.resubmissionCount,
      user: reviewUserView(userById.get(a.userId)),
    };
  });

  return { rows: items, page: safePage, limit: safeLimit, total: count };
}

/**
 * Fetch the full review payload for one application: the approval, the user,
 * the address, the professional detail and the type-specific detail.
 * @param {string} approvalId
 * @returns {Promise<object>}
 */
async function getReviewPayload(approvalId) {
  const approval = await ProfessionalApproval.findByPk(approvalId);
  if (!approval) {
    throw { statusCode: 404, message: 'Application not found' };
  }

  const user = await User.findByPk(approval.userId);
  const address = await Address.findOne({
    where: { userId: approval.userId },
  });
  const professionalDetail = approval.professionalDetailId
    ? await ProfessionalDetail.findByPk(approval.professionalDetailId)
    : null;

  let lawyerDetail = null;
  let taxConsultantDetail = null;
  if (professionalDetail) {
    if (approval.professionalType === 'Legal Consultant') {
      lawyerDetail = await LawyerDetail.findOne({
        where: { professionalId: professionalDetail.id },
      });
    } else if (approval.professionalType === 'Tax Consultant') {
      taxConsultantDetail = await TaxConsultantDetail.findOne({
        where: { professionalId: professionalDetail.id },
      });
    }
  }

  // Resolve sub-category ids to readable {id, name, categoryName} rows so the
  // admin review page can render labels without an extra fetch.
  let detailPlain = professionalDetail
    ? professionalDetail.get({ plain: true })
    : null;
  if (detailPlain) {
    const ids = Array.isArray(detailPlain.subCategoryIds)
      ? detailPlain.subCategoryIds.filter(Boolean)
      : [];
    if (ids.length > 0) {
      const subs = await SubCategory.findAll({
        where: { id: { [Op.in]: ids } },
        raw: true,
      });
      const catIds = [...new Set(subs.map((s) => s.categoryId))];
      const cats = catIds.length
        ? await Category.findAll({
            where: { id: { [Op.in]: catIds } },
            raw: true,
          })
        : [];
      const catNameById = new Map(cats.map((c) => [c.id, c.name]));
      detailPlain.subCategories = subs.map((s) => ({
        id: s.id,
        name: s.name,
        categoryId: s.categoryId,
        categoryName: catNameById.get(s.categoryId) || '',
      }));
    } else {
      detailPlain.subCategories = [];
    }
  }

  return {
    approval: approval.get({ plain: true }),
    user: user ? reviewUserView(user) : null,
    address: address ? address.get({ plain: true }) : null,
    professionalDetail: detailPlain,
    lawyerDetail: lawyerDetail ? lawyerDetail.get({ plain: true }) : null,
    taxConsultantDetail: taxConsultantDetail
      ? taxConsultantDetail.get({ plain: true })
      : null,
  };
}

// Load a non-decided approval, throwing 404 / 409 as appropriate.
async function loadActionableApproval(approvalId) {
  const approval = await ProfessionalApproval.findByPk(approvalId);
  if (!approval) {
    throw { statusCode: 404, message: 'Application not found' };
  }
  return approval;
}

/**
 * Approve a professional application. Marks the approval APPROVED and the
 * professional detail verified, then emails + notifies the professional.
 * @param {string} approvalId
 * @param {string} adminId - the reviewing platform_admin user id
 * @returns {Promise<object>} the updated approval (plain)
 */
async function approve(approvalId, adminId) {
  const approval = await loadActionableApproval(approvalId);
  const now = new Date();

  await sequelize.transaction(async (transaction) => {
    await approval.update(
      { status: 'APPROVED', reviewedBy: adminId, reviewedAt: now },
      { transaction }
    );
    if (approval.professionalDetailId) {
      const detail = await ProfessionalDetail.findByPk(
        approval.professionalDetailId,
        { transaction }
      );
      if (detail) {
        await detail.update(
          {
            verificationStatus: 'verified',
            verifiedBy: adminId,
            verificationDate: now,
          },
          { transaction }
        );
      }
    }
  });

  const user = await User.findByPk(approval.userId);
  // The professional may now be activated when their email is already verified.
  if (user && user.emailVerified && user.status !== 'active') {
    user.status = 'active';
    await user.save();
  }

  if (user) {
    await enqueue('email', {
      to: user.email,
      template: 'professionalApproval',
      vars: {
        professionalName: user.fullName || user.name || 'Professional',
        professionalType: approval.professionalType || 'Professional',
        email: user.email,
        approvalDate: now.toLocaleDateString(),
        loginUrl: `${env.appUrl}/login`,
        organizationName: 'Profirmo',
      },
    });
    try {
      await notificationService.createNotification({
        userId: user.id,
        type: 'professional_approval',
        title: 'Your professional profile has been approved',
        message:
          'Congratulations! Your professional profile has been approved. You can now log in and access your dashboard.',
        link: '/dashboard',
        metadata: { approvalId: approval.id },
      });
    } catch (err) {
      console.error(
        '[ProApproval] notification failed:',
        err.message || err
      );
    }

    // Phase 8: link any firm invitations addressed to this professional's
    // email that were created before they registered, and notify them.
    try {
      await invitationService.autoResolveInvitationsForUser(user);
    } catch (err) {
      console.error(
        '[ProApproval] auto-resolving firm invitations failed:',
        err.message || err
      );
    }
  }

  return approval.get({ plain: true });
}

/**
 * Reject a professional application with a reason.
 * @param {string} approvalId
 * @param {string} adminId
 * @param {string} reason - required rejection reason
 * @returns {Promise<object>} the updated approval (plain)
 */
async function reject(approvalId, adminId, reason) {
  if (!reason || !String(reason).trim()) {
    throw {
      statusCode: 422,
      message: 'Validation failed',
      errors: { reason: 'reason is required' },
    };
  }
  const approval = await loadActionableApproval(approvalId);
  const cleanReason = String(reason).trim();
  const now = new Date();

  // Stamp the approval row first so the cascade-delete below leaves audit
  // logs / job payloads consistent with a REJECTED state.
  await approval.update({
    status: 'REJECTED',
    rejectionReason: cleanReason,
    reviewedBy: adminId,
    reviewedAt: now,
  });
  const approvalSnapshot = approval.get({ plain: true });

  // Email the rejected applicant the reason + an invite to apply again as a
  // fresh signup, then wipe the user record. The Job queue persists the
  // recipient + template vars in `payload`, so the email still goes out
  // after the user row (and the cascade-tracked approval) are deleted.
  const user = await User.findByPk(approval.userId);
  if (user) {
    await enqueue('email', {
      to: user.email,
      template: 'professionalRejection',
      vars: {
        professionalName: user.fullName || user.name || 'Professional',
        reason: cleanReason,
        resubmitUrl: `${env.appUrl}/signup`,
      },
    });
    // FK cascades clear addresses, professional/lawyer/tax details, sessions,
    // notifications, leads, cases, the approval row itself, etc.
    await user.destroy();
  }

  return approvalSnapshot;
}

/**
 * Request additional information from a professional applicant.
 * @param {string} approvalId
 * @param {string} adminId
 * @param {string} message - required info-request message
 * @returns {Promise<object>} the updated approval (plain)
 */
async function requestInfo(approvalId, adminId, message) {
  if (!message || !String(message).trim()) {
    throw {
      statusCode: 422,
      message: 'Validation failed',
      errors: { message: 'message is required' },
    };
  }
  const approval = await loadActionableApproval(approvalId);
  const now = new Date();

  await approval.update({
    status: 'INFO_REQUESTED',
    requestedInfo: String(message).trim(),
    reviewedBy: adminId,
    reviewedAt: now,
  });

  const user = await User.findByPk(approval.userId);
  if (user) {
    await enqueue('email', {
      to: user.email,
      template: 'professionalInfoRequest',
      vars: {
        professionalName: user.fullName || user.name || 'Professional',
        requestedInfo: String(message).trim(),
      },
    });
    try {
      await notificationService.createNotification({
        userId: user.id,
        type: 'professional_info_request',
        title: 'Additional information needed for your application',
        message: `An admin has requested more information: ${String(
          message
        ).trim()}. Please email the requested details to profirmo.support@gmail.com.`,
        link: 'mailto:profirmo.support@gmail.com',
        metadata: { approvalId: approval.id },
      });
    } catch (err) {
      console.error(
        '[ProApproval] notification failed:',
        err.message || err
      );
    }
  }

  return approval.get({ plain: true });
}

module.exports = {
  listPending,
  getReviewPayload,
  approve,
  reject,
  requestInfo,
};

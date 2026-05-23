const { Op } = require('sequelize');
const {
  Review,
  ReviewAppeal,
  Professional,
  ProfessionalDetail,
  User,
  LawFirm,
  FirmMember,
} = require('../models');
const { paginate } = require('./professionalService');
const firmService = require('./firmService');
const notificationService = require('./notificationService');

// Fire-and-forget notification — failures never break the request.
const notify = async (params) => {
  try {
    await notificationService.createNotification(params);
  } catch (err) {
    console.warn(`[reviewNotify] failed: ${err.message}`);
  }
};

// Resolve the public professional id (user.linkedId || detail.id) → userId.
const resolveProfessionalUserId = async (publicProfId) => {
  if (!publicProfId) return null;
  const byLinked = await User.findOne({
    where: { linkedId: publicProfId },
    raw: true,
  });
  if (byLinked) return byLinked.id;
  const detail = await ProfessionalDetail.findByPk(publicProfId, { raw: true });
  return detail ? detail.userId : null;
};

const PUBLISHED = 'PUBLISHED';
const UNDER_APPEAL = 'UNDER_APPEAL';

const today = () => new Date().toISOString().slice(0, 10);

// Validate a 1–5 star rating, throwing a 422 on bad input.
const validateRating = (rating) => {
  const n = Number(rating);
  if (Number.isNaN(n) || n < 1 || n > 5) {
    throw {
      statusCode: 422,
      message: 'rating must be a number between 1 and 5',
    };
  }
  return n;
};

// Derive a display name from a user-like object.
const displayName = (u) => {
  if (!u) return '';
  return (
    u.fullName ||
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
    u.name ||
    ''
  );
};

/**
 * Resolve display names for a set of professional listing-ids. Ids may be
 * legacy `professionals` rows or new-model `professional_details` ids.
 * @returns {Promise<Map<string,string>>}
 */
const resolveProfessionalNames = async (ids) => {
  const map = new Map();
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (unique.length === 0) return map;

  const legacy = await Professional.findAll({
    where: { id: { [Op.in]: unique } },
    attributes: ['id', 'name'],
    raw: true,
  });
  for (const p of legacy) map.set(p.id, p.name || '');

  const missing = unique.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const details = await ProfessionalDetail.findAll({
      where: { id: { [Op.in]: missing } },
      attributes: ['id', 'userId'],
      raw: true,
    });
    const users = await User.findAll({
      where: { id: { [Op.in]: details.map((d) => d.userId).filter(Boolean) } },
      raw: true,
    });
    const userById = new Map(users.map((u) => [u.id, u]));
    for (const d of details) {
      map.set(d.id, displayName(userById.get(d.userId)));
    }
  }
  return map;
};

// --- Public: write a review ------------------------------------------------

/**
 * Create a review for a professional. Requires an authenticated user; a user
 * may review each professional only once.
 * @param {{ user:Object, professionalId:string, rating:number, comment:string }}
 */
const create = async ({ user, professionalId, rating, comment }) => {
  if (!user || !user.id) {
    throw {
      statusCode: 401,
      message: 'You must be signed in to write a review.',
    };
  }
  if (!professionalId) {
    throw { statusCode: 422, message: 'professionalId is required' };
  }
  const safeRating = validateRating(rating);

  // A professional cannot review their own profile.
  if (user.linkedId && user.linkedId === professionalId) {
    throw { statusCode: 403, message: 'You cannot review your own profile.' };
  }

  // One review per user per professional.
  const existing = await Review.findOne({
    where: { userId: user.id, professionalId },
  });
  if (existing) {
    throw {
      statusCode: 409,
      message: 'You have already reviewed this professional.',
    };
  }

  // Reviews are always against a professional; a firm has no review record
  // of its own (firm reviews = the collective reviews of its professionals).
  // The client column is now `users.id` directly.
  const review = await Review.create({
    userId: user.id,
    clientId: user.role === 'client' ? user.id : null,
    clientName: displayName(user) || 'Client',
    professionalId,
    rating: safeRating,
    comment: String(comment || '').trim(),
    date: today(),
    status: PUBLISHED,
  });

  // Notify the reviewed professional.
  const reviewedUserId = await resolveProfessionalUserId(professionalId);
  if (reviewedUserId && reviewedUserId !== user.id) {
    await notify({
      userId: reviewedUserId,
      type: 'review_received',
      title: 'New client review',
      message: `${displayName(user) || 'A client'} left you a ${safeRating}-star review.`,
      link: '/dashboard/professional/reviews',
      metadata: { reviewId: review.id, rating: safeRating },
    });
  }

  return review.get({ plain: true });
};

// --- Public: read reviews --------------------------------------------------

/** Published reviews for a professional, newest first. */
const getByProfessional = async (professionalId) =>
  Review.findAll({
    where: { professionalId, status: PUBLISHED },
    order: [['createdAt', 'DESC']],
    raw: true,
  });

/**
 * Published reviews for a firm — the collective reviews of every professional
 * working under that firm (firms have no reviews of their own).
 */
const getByFirm = async (firmId) => {
  const profIds = await firmService.getFirmProfessionalIds(firmId);
  if (profIds.length === 0) return [];
  return Review.findAll({
    where: { professionalId: { [Op.in]: profIds }, status: PUBLISHED },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
};

// --- Professional dashboard ------------------------------------------------

/**
 * Every review for the logged-in professional (any status), each with its
 * latest appeal attached so the dashboard can show appeal state.
 */
const getMineForProfessional = async (user) => {
  const professionalId = user && (user.linkedId || user.firmId);
  if (!professionalId) return [];

  const reviews = await Review.findAll({
    where: { professionalId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  if (reviews.length === 0) return [];

  const appeals = await ReviewAppeal.findAll({
    where: { reviewId: { [Op.in]: reviews.map((r) => r.id) } },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  const appealByReview = new Map();
  for (const a of appeals) {
    if (!appealByReview.has(a.reviewId)) appealByReview.set(a.reviewId, a);
  }
  return reviews.map((r) => ({
    ...r,
    appeal: appealByReview.get(r.id) || null,
  }));
};

// --- Appeals ---------------------------------------------------------------

/** A professional appeals one of their reviews as wrong / unfair. */
const createAppeal = async ({ user, reviewId, reason }) => {
  if (!user || !user.id) {
    throw { statusCode: 401, message: 'Authentication required.' };
  }
  if (!reason || !String(reason).trim()) {
    throw {
      statusCode: 422,
      message: 'Please describe why this review is wrong.',
    };
  }
  const review = await Review.findByPk(reviewId);
  if (!review) {
    throw { statusCode: 404, message: 'Review not found.' };
  }
  const professionalId = user.linkedId || user.firmId;
  if (!professionalId || review.professionalId !== professionalId) {
    throw {
      statusCode: 403,
      message: 'You can only appeal reviews written about you.',
    };
  }
  const pending = await ReviewAppeal.findOne({
    where: { reviewId, status: 'PENDING' },
  });
  if (pending) {
    throw {
      statusCode: 409,
      message: 'An appeal for this review is already being reviewed.',
    };
  }

  const appeal = await ReviewAppeal.create({
    reviewId,
    professionalId,
    appealedByUserId: user.id,
    reason: String(reason).trim(),
    status: 'PENDING',
  });
  // Hide the review from public pages until an admin resolves the appeal.
  await review.update({ status: UNDER_APPEAL });
  return appeal.get({ plain: true });
};

/**
 * Firm owner / co-owner appeals a review of one of their member professionals.
 * Mirrors createAppeal but the actor is acting on behalf of a member.
 */
const createAppealOnBehalf = async ({ user, reviewId, reason }) => {
  if (!user || !user.id) {
    throw { statusCode: 401, message: 'Authentication required.' };
  }
  if (!reason || !String(reason).trim()) {
    throw {
      statusCode: 422,
      message: 'Please describe why this review is wrong.',
    };
  }
  const review = await Review.findByPk(reviewId);
  if (!review) {
    throw { statusCode: 404, message: 'Review not found.' };
  }

  // Resolve the reviewed professional to a ProfessionalDetail id so we can
  // find their FirmMember row.
  let memberProfDetail = null;
  const userByLinkedId = await User.findOne({
    where: { linkedId: review.professionalId },
    raw: true,
  });
  if (userByLinkedId) {
    memberProfDetail = await ProfessionalDetail.findOne({
      where: { userId: userByLinkedId.id },
      raw: true,
    });
  } else {
    memberProfDetail = await ProfessionalDetail.findByPk(review.professionalId, {
      raw: true,
    });
  }
  if (!memberProfDetail) {
    throw {
      statusCode: 404,
      message: 'Reviewed professional not found.',
    };
  }

  const memberRow = await FirmMember.findOne({
    where: { professionalId: memberProfDetail.id, status: 'active' },
    raw: true,
  });
  if (!memberRow) {
    throw {
      statusCode: 409,
      message: 'The reviewed professional is not a member of any firm.',
    };
  }

  // Caller must be the firm's owner or a co-owner.
  const firm = await LawFirm.findByPk(memberRow.firmId, { raw: true });
  const isOwner = firm && firm.ownerUserId === user.id;
  let isCoOwner = false;
  if (!isOwner) {
    const callerDetail = await ProfessionalDetail.findOne({
      where: { userId: user.id },
      raw: true,
    });
    if (callerDetail) {
      const coOwnerRow = await FirmMember.findOne({
        where: {
          firmId: memberRow.firmId,
          professionalId: callerDetail.id,
          role: 'co-owner',
          status: 'active',
        },
        raw: true,
      });
      isCoOwner = Boolean(coOwnerRow);
    }
  }
  if (!isOwner && !isCoOwner) {
    throw {
      statusCode: 403,
      message:
        'Only the firm owner or a co-owner can appeal on behalf of a member.',
    };
  }

  const pending = await ReviewAppeal.findOne({
    where: { reviewId, status: 'PENDING' },
  });
  if (pending) {
    throw {
      statusCode: 409,
      message: 'An appeal for this review is already being reviewed.',
    };
  }
  const appeal = await ReviewAppeal.create({
    reviewId,
    professionalId: review.professionalId,
    appealedByUserId: user.id,
    reason: String(reason).trim(),
    status: 'PENDING',
  });
  await Review.update({ status: UNDER_APPEAL }, { where: { id: reviewId } });
  return appeal.get({ plain: true });
};

// --- Admin -----------------------------------------------------------------

/** List every review with pagination + filters (admin). */
const listAll = async ({ filters = {}, page, limit } = {}) => {
  const { page: p, limit: l, offset } = paginate(page, limit);
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.professionalId) where.professionalId = filters.professionalId;
  if (filters.minRating !== undefined && filters.minRating !== '') {
    where.rating = { [Op.gte]: Number(filters.minRating) || 0 };
  }

  const { rows, count } = await Review.findAndCountAll({
    where,
    limit: l,
    offset,
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  const profName = await resolveProfessionalNames(
    rows.map((r) => r.professionalId)
  );
  const items = rows.map((r) => ({
    ...r,
    professionalName: profName.get(r.professionalId) || '',
  }));
  return { items, page: p, limit: l, total: count };
};

/** Admin edits a review's rating / comment. */
const adminUpdate = async (id, { rating, comment }) => {
  const review = await Review.findByPk(id);
  if (!review) throw { statusCode: 404, message: 'Review not found.' };
  const changes = {};
  if (rating !== undefined) changes.rating = validateRating(rating);
  if (comment !== undefined) changes.comment = String(comment || '').trim();
  await review.update(changes);
  return review.get({ plain: true });
};

/** Admin deletes a review (its appeal rows cascade away via the FK). */
const adminDelete = async (id) => {
  const review = await Review.findByPk(id);
  if (!review) throw { statusCode: 404, message: 'Review not found.' };
  await review.destroy();
  return { id };
};

/** List every appeal with pagination + filters (admin). */
const listAppeals = async ({ filters = {}, page, limit } = {}) => {
  const { page: p, limit: l, offset } = paginate(page, limit);
  const where = {};
  if (filters.status) where.status = filters.status;

  const { rows, count } = await ReviewAppeal.findAndCountAll({
    where,
    limit: l,
    offset,
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  const reviews = await Review.findAll({
    where: { id: { [Op.in]: rows.map((a) => a.reviewId).filter(Boolean) } },
    raw: true,
  });
  const reviewById = new Map(reviews.map((r) => [r.id, r]));
  const profName = await resolveProfessionalNames(
    rows.map((a) => a.professionalId)
  );
  const items = rows.map((a) => ({
    ...a,
    review: reviewById.get(a.reviewId) || null,
    professionalName: profName.get(a.professionalId) || '',
  }));
  return { items, page: p, limit: l, total: count };
};

/**
 * Admin resolves an appeal.
 *  - decision 'accept' → the review was wrong: delete it.
 *  - decision 'reject' → the review stands: restore it to PUBLISHED.
 */
const resolveAppeal = async (
  appealId,
  { decision, adminNote, adminUserId } = {}
) => {
  const appeal = await ReviewAppeal.findByPk(appealId);
  if (!appeal) throw { statusCode: 404, message: 'Appeal not found.' };
  if (appeal.status !== 'PENDING') {
    throw {
      statusCode: 409,
      message: 'This appeal has already been resolved.',
    };
  }
  const d = String(decision || '').toLowerCase();
  if (d !== 'accept' && d !== 'reject') {
    throw {
      statusCode: 422,
      message: "decision must be 'accept' or 'reject'",
    };
  }

  const review = await Review.findByPk(appeal.reviewId);
  if (d === 'accept') {
    // The review is wrong — remove it entirely.
    if (review) await review.destroy();
  } else {
    // The review stands — make it public again.
    if (review) await review.update({ status: PUBLISHED });
  }
  await appeal.update({
    status: d === 'accept' ? 'ACCEPTED' : 'REJECTED',
    adminNote: String(adminNote || '').trim() || null,
    resolvedByUserId: adminUserId || null,
    resolvedAt: new Date(),
  });

  // Notify the user who filed the appeal.
  if (appeal.appealedByUserId) {
    await notify({
      userId: appeal.appealedByUserId,
      type: 'review_appeal_resolved',
      title:
        d === 'accept' ? 'Appeal accepted' : 'Appeal rejected',
      message:
        d === 'accept'
          ? 'Your appeal was accepted — the review was removed.'
          : 'Your appeal was reviewed and the review will remain public.',
      link: '/dashboard/professional/reviews',
      metadata: {
        appealId: appeal.id,
        reviewId: appeal.reviewId,
        decision: d === 'accept' ? 'ACCEPTED' : 'REJECTED',
      },
    });
  }

  return appeal.get({ plain: true });
};

module.exports = {
  create,
  getByProfessional,
  getByFirm,
  getMineForProfessional,
  createAppeal,
  createAppealOnBehalf,
  listAll,
  adminUpdate,
  adminDelete,
  listAppeals,
  resolveAppeal,
};

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

  // 1. Direct match against the legacy `professionals` table.
  const legacy = await Professional.findAll({
    where: { id: { [Op.in]: unique } },
    attributes: ['id', 'name'],
    raw: true,
  });
  for (const p of legacy) map.set(p.id, p.name || '');

  // 2. Match against ProfessionalDetail.id for new-model professionals.
  let missing = unique.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const details = await ProfessionalDetail.findAll({
      where: { id: { [Op.in]: missing } },
      attributes: ['id', 'userId'],
      raw: true,
    });
    if (details.length > 0) {
      const users = await User.findAll({
        where: {
          id: { [Op.in]: details.map((d) => d.userId).filter(Boolean) },
        },
        raw: true,
      });
      const userById = new Map(users.map((u) => [u.id, u]));
      for (const d of details) {
        map.set(d.id, displayName(userById.get(d.userId)));
      }
    }
  }

  // 3. Fall back to User.linkedId — covers reviews keyed by a user's alias
  //    (e.g. firm-owner users whose linkedId points at a legacy firm id).
  missing = unique.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const aliasUsers = await User.findAll({
      where: { linkedId: { [Op.in]: missing } },
      raw: true,
    });
    for (const u of aliasUsers) {
      map.set(u.linkedId, displayName(u));
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
const create = async ({
  user,
  professionalId,
  rating,
  comment,
  kind: rawKind,
  bookingId,
  reviewedUserId,
}) => {
  if (!user || !user.id) {
    throw {
      statusCode: 401,
      message: 'You must be signed in to write a review.',
    };
  }
  const kind = String(rawKind || 'professional').toLowerCase();
  if (!['professional', 'consultation', 'client'].includes(kind)) {
    throw {
      statusCode: 422,
      message: "kind must be 'professional', 'consultation' or 'client'.",
    };
  }
  const safeRating = validateRating(rating);

  // 5-day review window for booking-anchored reviews. Past that point the
  // booking is considered "closed" and nobody (client or pro) can add a
  // review — escrow has either released by then anyway.
  if (bookingId) {
    const { Booking } = require('../models');
    const bookingRow = await Booking.findByPk(bookingId, { raw: true });
    if (bookingRow && bookingRow.completedAt) {
      const windowMs = 5 * 24 * 60 * 60 * 1000;
      const age = Date.now() - new Date(bookingRow.completedAt).getTime();
      if (age > windowMs) {
        throw {
          statusCode: 403,
          message:
            'The 5-day review window for this booking has closed.',
        };
      }
    }
  }

  // Per-kind validation + uniqueness check.
  let dupeWhere = null;
  let resolvedProfessionalId = professionalId || null;
  let resolvedReviewedUserId = reviewedUserId || null;

  if (kind === 'professional') {
    if (!resolvedProfessionalId) {
      throw { statusCode: 422, message: 'professionalId is required' };
    }
    if (user.linkedId && user.linkedId === resolvedProfessionalId) {
      throw {
        statusCode: 403,
        message: 'You cannot review your own profile.',
      };
    }
    dupeWhere = {
      userId: user.id,
      professionalId: resolvedProfessionalId,
      kind,
    };
  } else if (kind === 'consultation') {
    if (!bookingId) {
      throw {
        statusCode: 422,
        message: 'bookingId is required for a consultation review.',
      };
    }
    dupeWhere = { userId: user.id, bookingId, kind };
  } else {
    // kind === 'client' — pro reviewing a client. Booking anchored.
    if (!bookingId) {
      throw {
        statusCode: 422,
        message: 'bookingId is required for a client review.',
      };
    }
    if (!resolvedReviewedUserId) {
      throw {
        statusCode: 422,
        message: 'reviewedUserId is required for a client review.',
      };
    }
    if (resolvedReviewedUserId === user.id) {
      throw { statusCode: 403, message: 'You cannot review yourself.' };
    }
    dupeWhere = { userId: user.id, bookingId, kind };
  }

  const existing = await Review.findOne({ where: dupeWhere });
  if (existing) {
    throw {
      statusCode: 409,
      message: 'You have already submitted this review.',
    };
  }

  // The JWT only carries `id / role / linkedId / firmId`, so we look up the
  // full User row to pull the reviewer's display name.
  const reviewerUser = await User.findByPk(user.id, { raw: true });
  const reviewerName =
    displayName(reviewerUser) || displayName(user) || 'Client';

  const review = await Review.create({
    userId: user.id,
    clientId: user.role === 'client' ? user.id : null,
    clientName: reviewerName,
    professionalId: resolvedProfessionalId,
    rating: safeRating,
    comment: String(comment || '').trim(),
    date: today(),
    status: PUBLISHED,
    kind,
    bookingId: bookingId || null,
    reviewedUserId: resolvedReviewedUserId,
  });

  // Notifications: pro→client and client→pro reviews land in the recipient's
  // inbox; the consultation review is silent (it's about the booking, not a
  // specific user, so there's nobody to "ping").
  if (kind === 'professional') {
    const reviewedUserId = await resolveProfessionalUserId(resolvedProfessionalId);
    if (reviewedUserId && reviewedUserId !== user.id) {
      await notify({
        userId: reviewedUserId,
        type: 'review_received',
        title: 'New client review',
        message: `${reviewerName} left you a ${safeRating}-star review.`,
        link: '/dashboard/professional/reviews',
        metadata: { reviewId: review.id, rating: safeRating },
      });
    }
  } else if (kind === 'client' && resolvedReviewedUserId) {
    await notify({
      userId: resolvedReviewedUserId,
      type: 'review_received',
      title: 'Professional left you a review',
      message: `${reviewerName} left you a ${safeRating}-star review.`,
      link: '/dashboard/client/bookings',
      metadata: { reviewId: review.id, rating: safeRating, bookingId },
    });
  }

  // Escrow release rule: funds release when BOTH parties have submitted a
  // consultation review for the same booking. (The 5-day fallback lives in
  // bookingDetailService and walletService — this is the "happy path".)
  // Anything other than a consultation review never moves the escrow.
  if (kind === 'consultation' && bookingId) {
    try {
      const { Op } = require('sequelize');
      const consultationCount = await Review.count({
        where: { bookingId, kind: 'consultation' },
      });
      if (consultationCount >= 2) {
        const { EscrowEntry } = require('../models');
        const escrow = await EscrowEntry.findOne({
          where: {
            bookingId,
            status: { [Op.in]: ['awaiting_review', 'escrowed'] },
          },
        });
        if (escrow) {
          const walletService = require('./walletService');
          await walletService.onReviewSubmitted({
            bookingId,
            reviewId: review.id,
          });
        }
      }
    } catch (err) {
      console.warn(`[reviewService] escrow release hook failed: ${err.message}`);
    }
  }

  return review.get({ plain: true });
};

// --- Public: read reviews --------------------------------------------------

/**
 * Published reviews for a professional, newest first. Only kind='professional'
 * rows surface here — consultation + client reviews are anchored to specific
 * bookings and shouldn't leak into the public profile.
 */
/**
 * Public reviews for a professional, enriched with each reviewer's
 * profile photo so the profile-page review list can render an avatar
 * instead of always falling back to the name-initials placeholder.
 *
 * `clientPhoto` (and the back-compat alias `authorPhoto`) is null when
 * the reviewer hasn't set a profile photo or the linked User row is
 * gone (deleted account).
 */
const getByProfessional = async (professionalId) => {
  const rows = await Review.findAll({
    where: { professionalId, status: PUBLISHED, kind: 'professional' },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  if (rows.length === 0) return rows;

  // Reviews carry both `userId` and `clientId`; prefer the canonical
  // userId since older rows sometimes left clientId null.
  const reviewerIds = [
    ...new Set(
      rows.map((r) => r.userId || r.clientId).filter(Boolean)
    ),
  ];
  if (reviewerIds.length === 0) return rows;

  const users = await User.findAll({
    where: { id: { [Op.in]: reviewerIds } },
    attributes: ['id', 'profilePhoto'],
    raw: true,
  });
  const photoByUser = new Map(
    users.map((u) => [u.id, u.profilePhoto || null])
  );

  return rows.map((r) => {
    const key = r.userId || r.clientId;
    const photo = key ? photoByUser.get(key) : null;
    return {
      ...r,
      clientPhoto: photo || null,
      authorPhoto: photo || null,
    };
  });
};

/**
 * Published reviews for a firm — the collective reviews of every professional
 * working under that firm. Each row is enriched with the reviewed
 * professional's display name + photo so the firm owner can tell who was
 * reviewed, and the latest appeal state so already-appealed rows can show
 * a badge instead of an Appeal button.
 */
const getByFirm = async (firmId) => {
  const profIds = await firmService.getFirmProfessionalIds(firmId);
  if (profIds.length === 0) return [];
  const reviews = await Review.findAll({
    where: {
      professionalId: { [Op.in]: profIds },
      status: PUBLISHED,
      kind: 'professional',
    },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  if (reviews.length === 0) return [];

  // Resolve each reviewedProfessionalId → User { name, profilePhoto }. Some
  // rows reference legacy `prof-N` ids (linkedId), others reference the new
  // ProfessionalDetail.id; we honour both.
  const ids = [...new Set(reviews.map((r) => r.professionalId).filter(Boolean))];
  const [details, linkedUsers] = await Promise.all([
    ProfessionalDetail.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'userId'],
      raw: true,
    }),
    User.findAll({
      where: { linkedId: { [Op.in]: ids } },
      attributes: ['id', 'linkedId', 'fullName', 'firstName', 'lastName', 'name', 'profilePhoto'],
      raw: true,
    }),
  ]);
  const detailUserIds = details.map((d) => d.userId).filter(Boolean);
  const detailUsers = detailUserIds.length
    ? await User.findAll({
        where: { id: { [Op.in]: detailUserIds } },
        attributes: ['id', 'fullName', 'firstName', 'lastName', 'name', 'profilePhoto'],
        raw: true,
      })
    : [];
  const detailUserById = new Map(detailUsers.map((u) => [u.id, u]));
  const userByLinked = new Map(linkedUsers.map((u) => [u.linkedId, u]));
  const proById = new Map();
  for (const d of details) {
    const u = detailUserById.get(d.userId);
    if (u) proById.set(d.id, u);
  }
  for (const [linkedId, u] of userByLinked) proById.set(linkedId, u);

  // Latest appeal per review so the UI can show "Appealed" status.
  const appeals = await ReviewAppeal.findAll({
    where: { reviewId: { [Op.in]: reviews.map((r) => r.id) } },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  const appealByReview = new Map();
  for (const a of appeals) {
    if (!appealByReview.has(a.reviewId)) appealByReview.set(a.reviewId, a);
  }

  return reviews.map((r) => {
    const u = proById.get(r.professionalId);
    return {
      ...r,
      reviewedProfessionalName: u
        ? u.fullName ||
          [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
          u.name ||
          ''
        : '',
      reviewedProfessionalPhoto: (u && u.profilePhoto) || null,
      appeal: appealByReview.get(r.id) || null,
    };
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

  // Professional dashboard only lists kind='professional' reviews — the
  // consultation + client reviews live on the booking detail page.
  const reviews = await Review.findAll({
    where: { professionalId, kind: 'professional' },
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
  // Optional filter by review kind so admin can split "reviews of the
  // professional" from "reviews on a specific booking" (consultation /
  // client). NULL is silently ignored (= no filter).
  if (filters.kind) where.kind = filters.kind;

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

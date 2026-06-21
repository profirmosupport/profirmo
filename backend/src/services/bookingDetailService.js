// bookingDetailService — assembles the rich "booking detail" payload used by
// both /dashboard/client/bookings/:id and /dashboard/professional/bookings/:id.
//
// The same record carries: the booking itself, the professional's public
// profile (name + contact details), payment + escrow status, the list of
// notes, and — for the client viewer — whether they've already reviewed the
// professional (so the UI can hide the review form when it isn't needed).

const { Op } = require('sequelize');
const {
  Booking,
  BookingNote,
  Payment,
  EscrowEntry,
  ProfessionalDetail,
  Professional,
  User,
  Review,
  Case,
} = require('../models');

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
 * Resolve a public professional id (Professional.id OR ProfessionalDetail.id)
 * to a contact-rich snapshot the booking detail page can render.
 *
 * @param {string} professionalId
 * @returns {Promise<object|null>}
 */
async function resolveProfessional(professionalId) {
  if (!professionalId) return null;

  // New-model first: ProfessionalDetail.id → User row holds the contact.
  const detail = await ProfessionalDetail.findByPk(professionalId, {
    raw: true,
  });
  if (detail && detail.userId) {
    const user = await User.findByPk(detail.userId, { raw: true });
    if (user) {
      return {
        id: professionalId,
        userId: user.id,
        name: displayName(user) || 'Professional',
        email: user.email || null,
        phone: user.mobileNumber || null,
        profilePhoto: user.profilePhoto || null,
        designation: detail.designation || null,
        organization: detail.organization || null,
        bio: detail.bio || null,
        professionalType: detail.professionalType || null,
        consultationFee: detail.consultationFee || null,
        // Public-profile fields surfaced on the client's booking-detail card
        // so the "professional card on top" mirrors the marketplace listing
        // — saves a second roundtrip to /api/professionals/:id.
        city: (user && user.city) || null,
        rating: detail.rating != null ? Number(detail.rating) : null,
        reviewsCount:
          detail.reviewsCount != null ? Number(detail.reviewsCount) : null,
        yearsOfExperience:
          detail.yearsOfExperience != null
            ? Number(detail.yearsOfExperience)
            : null,
        verified: detail.verificationStatus === 'verified',
      };
    }
  }

  // Legacy: Professional row + companion user via linkedId.
  const legacy = await Professional.findByPk(professionalId, { raw: true });
  if (legacy) {
    const user = await User.findOne({
      where: { linkedId: professionalId },
      raw: true,
    });
    return {
      id: professionalId,
      userId: user ? user.id : null,
      name: legacy.name || (user && displayName(user)) || 'Professional',
      email: legacy.email || (user && user.email) || null,
      phone: legacy.phone || (user && user.mobileNumber) || null,
      profilePhoto: user ? user.profilePhoto : null,
      designation: null,
      organization: null,
      bio: legacy.bio || null,
      professionalType: legacy.professionType || null,
      consultationFee: legacy.perMinuteRate || null,
    };
  }
  return null;
}

/**
 * Has the given client previously reviewed this professional? Used to hide
 * the review form when there's nothing to capture.
 */
async function findClientProfessionalReview(clientUserId, professionalId) {
  if (!clientUserId || !professionalId) return null;
  return Review.findOne({
    where: { userId: clientUserId, professionalId, kind: 'professional' },
    raw: true,
  });
}

/** Has the given user already left a consultation review for the booking? */
async function findConsultationReview(authorUserId, bookingId) {
  if (!authorUserId || !bookingId) return null;
  return Review.findOne({
    where: { userId: authorUserId, bookingId, kind: 'consultation' },
    raw: true,
  });
}

/** Has the professional already reviewed THIS client for THIS booking? */
async function findProfessionalsClientReview(proUserId, bookingId) {
  if (!proUserId || !bookingId) return null;
  return Review.findOne({
    where: { userId: proUserId, bookingId, kind: 'client' },
    raw: true,
  });
}

/**
 * Build the booking-detail payload. The caller must be either the booking's
 * client (`booking.clientId === user.id`) OR the assigned professional
 * (booking.professionalId resolves to user.id) OR a platform admin.
 *
 * @param {string} bookingId
 * @param {object} user - the calling user (from req.user)
 * @returns {Promise<object|null>}
 */
async function getBookingDetail(bookingId, user) {
  const booking = await Booking.findByPk(bookingId, { raw: true });
  if (!booking) return null;

  const professional = await resolveProfessional(booking.professionalId);
  const profUserId = professional ? professional.userId : null;

  // Access control: only the client, the professional, or an admin may see
  // a booking's full detail (including contact info + notes).
  const isClient = booking.clientId && booking.clientId === user.id;
  const isProfessional = profUserId && profUserId === user.id;
  const isAdmin = user.role === 'platform_admin';
  if (!isClient && !isProfessional && !isAdmin) {
    throw { statusCode: 403, message: 'You cannot view this booking.' };
  }

  const [
    payment,
    notes,
    clientUser,
    professionalReview,
    consultationByClient,
    consultationByPro,
    proClientReview,
  ] = await Promise.all([
    // Prefer the most recent paid/refunded payment so the booking
    // summary "Amount paid" line reflects the actual money exchanged.
    // If no such payment exists yet, fall back to the latest created/
    // failed attempt so the Pay-again banner on the client side can
    // surface the amount due. The frontend treats `payment.status`
    // explicitly, so emitting a pending row here is safe.
    Payment.findOne({
      where: { bookingId },
      order: [
        // Sort: paid > refunded > failed > created. FIELD() returns 0
        // for unmatched values; lower wins with ASC. Then by recency.
        [
          Payment.sequelize.literal(
            "FIELD(status, 'paid', 'refunded', 'failed', 'created')"
          ),
          'ASC',
        ],
        ['createdAt', 'DESC'],
      ],
    }),
    BookingNote.findAll({
      where: { bookingId },
      order: [['createdAt', 'ASC']],
      raw: true,
    }),
    booking.clientId
      ? User.findByPk(booking.clientId, { raw: true })
      : Promise.resolve(null),
    booking.clientId && booking.professionalId
      ? findClientProfessionalReview(booking.clientId, booking.professionalId)
      : Promise.resolve(null),
    // Two consultation reviews are possible: one from the client (kind=
    // 'consultation', userId=client) and one from the professional
    // (kind='consultation', userId=pro). Both are surfaced so each side
    // sees the other's perspective on the consultancy.
    booking.clientId
      ? findConsultationReview(booking.clientId, booking.id)
      : Promise.resolve(null),
    profUserId
      ? findConsultationReview(profUserId, booking.id)
      : Promise.resolve(null),
    profUserId
      ? findProfessionalsClientReview(profUserId, booking.id)
      : Promise.resolve(null),
  ]);

  let escrow = null;
  if (payment) {
    escrow = await EscrowEntry.findOne({
      where: { paymentId: payment.id },
      raw: true,
    });
  }

  // 5-day review window: anchored to booking.completedAt. Outside the window
  // nobody can add a review (server rejects with 403) and any still-locked
  // escrow auto-releases on this fetch — keeps the worker queue simple.
  const REVIEW_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
  const completedAt = booking.completedAt
    ? new Date(booking.completedAt)
    : null;
  const completedAge = completedAt ? Date.now() - completedAt.getTime() : 0;
  const reviewWindowOpen = booking.status === 'completed' && completedAt
    ? completedAge <= REVIEW_WINDOW_MS
    : booking.status === 'completed'; // completedAt missing → keep window open
  const reviewWindowClosesAt = completedAt
    ? new Date(completedAt.getTime() + REVIEW_WINDOW_MS)
    : null;

  if (
    escrow &&
    escrow.status === 'awaiting_review' &&
    completedAt &&
    completedAge > REVIEW_WINDOW_MS
  ) {
    try {
      const walletService = require('./walletService');
      await walletService.onReviewSubmitted({
        bookingId: booking.id,
        reviewId: null,
      });
      escrow = await EscrowEntry.findOne({
        where: { paymentId: payment.id },
        raw: true,
      });
    } catch (err) {
      console.warn(
        `[bookingDetail] auto-release after 5d window failed: ${err.message}`
      );
    }
  }

  // Surface the existing case (if any) so the booking detail page can show
  // an "Open case" link instead of the "Convert to case" CTA when this
  // booking has already been converted.
  const linkedCase = await Case.findOne({
    where: { bookingId: booking.id },
    attributes: ['id', 'title', 'status'],
    raw: true,
  });

  return {
    booking,
    professional,
    client: clientUser
      ? {
          id: clientUser.id,
          name: displayName(clientUser) || 'Client',
          email: clientUser.email || null,
          phone: clientUser.mobileNumber || null,
        }
      : null,
    payment: payment ? payment.get({ plain: true }) : null,
    escrow,
    notes,
    // Existing case derived from this booking. Null when the booking
    // hasn't been converted yet OR after the case was deleted.
    linkedCase: linkedCase || null,
    // Legacy single-review field kept for older frontend reads.
    review: professionalReview || null,
    reviews: {
      professional: professionalReview || null,
      // BOTH consultation reviews are surfaced; the frontend renders them
      // side by side so each party sees the other's perspective.
      consultationByClient: consultationByClient || null,
      consultationByProfessional: consultationByPro || null,
      client: proClientReview || null,
    },
    reviewWindow: {
      open: reviewWindowOpen,
      closesAt: reviewWindowClosesAt,
      windowDays: 5,
    },
    permissions: {
      canAddNote: isClient || isProfessional,
      // Reviews unlock on completion + while the 5-day window is open.
      canReviewProfessional:
        isClient &&
        !professionalReview &&
        booking.status === 'completed' &&
        reviewWindowOpen,
      canReviewConsultationAsClient:
        isClient &&
        !consultationByClient &&
        booking.status === 'completed' &&
        reviewWindowOpen,
      canReviewConsultationAsProfessional:
        isProfessional &&
        !consultationByPro &&
        booking.status === 'completed' &&
        reviewWindowOpen,
      canReviewClient:
        isProfessional &&
        !proClientReview &&
        booking.status === 'completed' &&
        reviewWindowOpen,
      // Legacy alias retained for older frontend code.
      canReview:
        isClient &&
        !professionalReview &&
        booking.status === 'completed' &&
        reviewWindowOpen,
      // Conversion is gated on (a) caller is the assigned pro, (b) the
      // booking isn't cancelled, (c) NO live case is already linked. The
      // frontend additionally surfaces an "Open case" link when one exists.
      canConvertToCase:
        isProfessional &&
        booking.status !== 'cancelled' &&
        !linkedCase,
    },
  };
}

/**
 * Append a free-text note to the booking. Caller must be the client or the
 * assigned professional.
 */
async function addNote(bookingId, user, { body, attachments } = {}) {
  const text = String(body || '').trim();
  // Attachments are optional, but if there's no body the user must at least
  // be attaching something.
  const cleanAttachments = Array.isArray(attachments)
    ? attachments
        .filter((a) => a && typeof a.url === 'string' && a.url.trim())
        .map((a) => ({
          url: String(a.url).trim(),
          name: a.name ? String(a.name) : null,
          mimeType: a.mimeType ? String(a.mimeType) : null,
          size:
            a.size !== undefined && a.size !== null
              ? Number(a.size) || null
              : null,
        }))
    : [];
  if (!text && cleanAttachments.length === 0) {
    throw { statusCode: 422, message: 'Note body or at least one attachment is required.' };
  }
  const booking = await Booking.findByPk(bookingId, { raw: true });
  if (!booking) throw { statusCode: 404, message: 'Booking not found.' };

  const professional = await resolveProfessional(booking.professionalId);
  const profUserId = professional ? professional.userId : null;
  const isClient = booking.clientId && booking.clientId === user.id;
  const isProfessional = profUserId && profUserId === user.id;
  if (!isClient && !isProfessional) {
    throw { statusCode: 403, message: 'Only booking participants can add notes.' };
  }
  const userRow = await User.findByPk(user.id, { raw: true });
  const note = await BookingNote.create({
    bookingId,
    authorUserId: user.id,
    authorRole: isClient ? 'client' : 'professional',
    authorName: displayName(userRow) || null,
    body: text,
    attachments: cleanAttachments.length ? cleanAttachments : null,
  });
  return note.get({ plain: true });
}

module.exports = {
  getBookingDetail,
  addNote,
  resolveProfessional,
};

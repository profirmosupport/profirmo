// walletService — derive a professional's wallet view from their escrow
// entries + ledger rows. Nothing is denormalised; balances are computed
// on each call so the ledger is the single source of truth.

const { Op } = require('sequelize');
const {
  EscrowEntry,
  WalletTransaction,
  Payment,
  Booking,
  User,
} = require('../models');

// Sum the netAmount of escrow rows whose status is in `statuses` and
// belong to `userId`. Returns 0 for no rows.
async function sumNet(userId, statuses) {
  const total = await EscrowEntry.sum('netAmount', {
    where: {
      professionalUserId: userId,
      status: { [Op.in]: statuses },
    },
  });
  return Number(total) || 0;
}

/**
 * Build the wallet summary card shown on the professional dashboard.
 * All amounts in paise. Frontend renders rupees.
 */
async function getSummary(userId) {
  if (!userId) return null;
  const [
    escrowedBalance,
    readyToRelease,
    pendingPayout,
    withdrawn,
    totalEarnings,
    grossEarnings,
    markupDeducted,
  ] = await Promise.all([
    sumNet(userId, ['escrowed', 'awaiting_review']),
    sumNet(userId, ['ready_to_release']),
    sumNet(userId, ['payout_requested', 'released']),
    sumNet(userId, ['withdrawn']),
    sumNet(userId, [
      'escrowed',
      'awaiting_review',
      'ready_to_release',
      'payout_requested',
      'released',
      'withdrawn',
    ]),
    // Gross + cumulative markup let the wallet card show the
    // admin-configured platform cut at a glance.
    EscrowEntry.sum('grossAmount', {
      where: {
        professionalUserId: userId,
        status: { [require('sequelize').Op.ne]: 'refunded' },
      },
    }).then((n) => Number(n) || 0),
    EscrowEntry.sum('platformFee', {
      where: {
        professionalUserId: userId,
        status: { [require('sequelize').Op.ne]: 'refunded' },
      },
    }).then((n) => Number(n) || 0),
  ]);

  // Snapshot the rate that WOULD apply to a new payment for this user
  // RIGHT NOW. Read fresh from their active subscription's plan so
  // post-upgrade Premium users immediately see "Current platform markup:
  // 5%" alongside the cumulative-deducted total from older 10% payments.
  // Falls back to the admin-setting global rate, then env default.
  let currentMarkupBps = 1000;
  try {
    const { ProfessionalSubscription, SubscriptionPlan } = require('../models');
    const sub = await ProfessionalSubscription.findOne({
      where: { userId, status: 'active' },
      order: [['startDate', 'DESC']],
      raw: true,
    });
    if (sub && sub.subscriptionPlanId) {
      const plan = await SubscriptionPlan.findByPk(sub.subscriptionPlanId, {
        raw: true,
      });
      if (plan && plan.commissionPercent !== null && plan.commissionPercent !== undefined) {
        currentMarkupBps = Math.round(Number(plan.commissionPercent) * 100);
      }
    } else {
      const adminSettingsService = require('./adminSettingsService');
      currentMarkupBps = await adminSettingsService.getNumber('bookingMarkupBps');
    }
  } catch {
    /* fall back to default */
  }

  return {
    currency: 'INR',
    totalEarnings,
    grossEarnings,
    markupDeducted,
    currentMarkupBps,
    escrowedBalance,
    readyToRelease,
    availableForPayout: readyToRelease,
    pendingPayout,
    withdrawn,
  };
}

/**
 * Paginated ledger view. Joined-light: returns the wallet rows + the
 * companion payment (for client name + booking id) and booking date so the
 * professional can identify each entry without a second roundtrip.
 */
async function listTransactions(userId, { page = 1, limit = 30 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 100));
  const offset = (safePage - 1) * safeLimit;

  const { rows, count } = await WalletTransaction.findAndCountAll({
    where: { walletUserId: userId },
    order: [['createdAt', 'DESC']],
    limit: safeLimit,
    offset,
    raw: true,
  });
  const paymentIds = [...new Set(rows.map((r) => r.paymentId).filter(Boolean))];
  const bookingIds = [...new Set(rows.map((r) => r.bookingId).filter(Boolean))];
  const payments = paymentIds.length
    ? await Payment.findAll({
        where: { id: { [Op.in]: paymentIds } },
        raw: true,
      })
    : [];
  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const bookings = bookingIds.length
    ? await Booking.findAll({
        where: { id: { [Op.in]: bookingIds } },
        raw: true,
      })
    : [];
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const clientIds = [
    ...new Set(
      payments.map((p) => p.userId).filter(Boolean)
    ),
  ];
  const clients = clientIds.length
    ? await User.findAll({
        where: { id: { [Op.in]: clientIds } },
        attributes: ['id', 'fullName', 'firstName', 'lastName'],
        raw: true,
      })
    : [];
  const clientById = new Map(
    clients.map((c) => [
      c.id,
      c.fullName ||
        [c.firstName, c.lastName].filter(Boolean).join(' ').trim() ||
        'Client',
    ])
  );

  const items = rows.map((r) => {
    const payment = r.paymentId ? paymentById.get(r.paymentId) : null;
    const booking = r.bookingId ? bookingById.get(r.bookingId) : null;
    return {
      ...r,
      clientName: payment ? clientById.get(payment.userId) || 'Client' : '',
      grossAmount: payment ? payment.amount : null,
      platformFee: payment ? payment.platformFee : null,
      bookingDate: booking ? booking.date : null,
    };
  });

  return {
    items,
    page: safePage,
    limit: safeLimit,
    total: count,
  };
}

/**
 * Mark a booking's escrow entry "awaiting_review" once the consultation is
 * marked completed. Called from bookingService.updateStatus.
 */
async function onBookingCompleted(bookingId) {
  if (!bookingId) return;
  const escrow = await EscrowEntry.findOne({
    where: { bookingId, status: 'escrowed' },
  });
  if (!escrow) return;
  await escrow.update({ status: 'awaiting_review' });
  await WalletTransaction.create({
    walletUserId: escrow.professionalUserId,
    entryType: 'credit',
    category: 'escrow_status_change',
    amount: 0,
    bookingId,
    paymentId: escrow.paymentId,
    escrowId: escrow.id,
    escrowStatus: 'awaiting_review',
    description: 'Booking marked completed — awaiting client review.',
  });
}

/**
 * Flip a booking's escrow to ready_to_release once the client posts a
 * review. Called from reviewService.create. Safe to call before booking
 * completion — it will only trigger if the escrow is already in
 * awaiting_review (or escrowed, for "early review" flows).
 */
async function onReviewSubmitted({ bookingId, reviewId }) {
  if (!bookingId) return;
  const escrow = await EscrowEntry.findOne({
    where: {
      bookingId,
      status: { [Op.in]: ['awaiting_review', 'escrowed'] },
    },
  });
  if (!escrow) return;
  await escrow.update({
    status: 'ready_to_release',
    reviewId: reviewId || null,
  });
  await WalletTransaction.create({
    walletUserId: escrow.professionalUserId,
    entryType: 'credit',
    category: 'escrow_release',
    amount: 0,
    bookingId,
    paymentId: escrow.paymentId,
    escrowId: escrow.id,
    escrowStatus: 'ready_to_release',
    description: 'Review submitted — funds ready to release.',
    metadata: { reviewId: reviewId || null },
  });
}

module.exports = {
  getSummary,
  listTransactions,
  onBookingCompleted,
  onReviewSubmitted,
};

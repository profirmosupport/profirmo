// paymentController — Razorpay order/verify endpoints, webhook, and read
// helpers for the client receipt screen.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const paymentsService = require('../services/paymentsService');
const { Payment } = require('../models');

// POST /api/payments/orders  body: { bookingId }
const createOrder = asyncHandler(async (req, res) => {
  const { bookingId } = req.body || {};
  if (!bookingId) {
    throw { statusCode: 400, message: 'bookingId is required.' };
  }
  const result = await paymentsService.createOrderForBooking({
    bookingId,
    user: req.user,
  });
  return successResponse(res, 201, 'Order created', result);
});

// POST /api/payments/verify
// body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
const verifyPayment = asyncHandler(async (req, res) => {
  const result = await paymentsService.verifyAndRecordPayment({
    ...req.body,
    userId: req.user && req.user.id,
  });
  return successResponse(res, 200, 'Payment verified', result);
});

// GET /api/payments/mine — payment history for the caller.
// `side=client`: payments made by the caller (default for clients).
// `side=professional`: payments received into the caller's escrow.
// `side=any`: union of both, used when role doesn't make the side obvious.
const listMine = asyncHandler(async (req, res) => {
  const { Op } = require('sequelize');
  const { Booking, User } = require('../models');
  const side = String(req.query.side || '').toLowerCase();
  const where = {};
  if (side === 'client') {
    where.userId = req.user.id;
  } else if (side === 'professional') {
    where.professionalUserId = req.user.id;
  } else {
    where[Op.or] = [
      { userId: req.user.id },
      { professionalUserId: req.user.id },
    ];
  }
  const rows = await Payment.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: 100,
    raw: true,
  });

  // Decorate with counterparty names + booking date so the table is useful
  // without a second roundtrip per row.
  const userIds = [
    ...new Set(
      [
        ...rows.map((r) => r.userId).filter(Boolean),
        ...rows.map((r) => r.professionalUserId).filter(Boolean),
      ].filter((u) => u !== req.user.id)
    ),
  ];
  const users = userIds.length
    ? await User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ['id', 'fullName', 'firstName', 'lastName', 'email'],
        raw: true,
      })
    : [];
  const byUserId = new Map(users.map((u) => [u.id, u]));
  const display = (u) =>
    u
      ? u.fullName ||
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
        u.email ||
        ''
      : '';
  const bookingIds = [...new Set(rows.map((r) => r.bookingId).filter(Boolean))];
  const bookings = bookingIds.length
    ? await Booking.findAll({
        where: { id: { [Op.in]: bookingIds } },
        attributes: ['id', 'date', 'time', 'duration'],
        raw: true,
      })
    : [];
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  const items = rows.map((r) => ({
    ...r,
    isPayer: r.userId === req.user.id,
    isPayee: r.professionalUserId === req.user.id,
    counterpartyName:
      r.userId === req.user.id
        ? display(byUserId.get(r.professionalUserId))
        : display(byUserId.get(r.userId)),
    booking: r.bookingId ? bookingById.get(r.bookingId) || null : null,
  }));
  return successResponse(res, 200, 'Payment history', { items });
});

// GET /api/payments/:id — used by the client receipt screen.
const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findByPk(req.params.id);
  if (!payment) throw { statusCode: 404, message: 'Payment not found.' };
  if (
    req.user &&
    req.user.role !== 'platform_admin' &&
    payment.userId !== req.user.id &&
    payment.professionalUserId !== req.user.id
  ) {
    throw { statusCode: 403, message: 'Forbidden.' };
  }
  return successResponse(res, 200, 'Payment fetched', payment.get({ plain: true }));
});

// POST /api/payments/webhook — Razorpay calls this with payment.failed /
// refund.processed events. Signature verification is mandatory; the route
// must be mounted with the raw body parser (see routes file).
const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const raw = req.rawBody || JSON.stringify(req.body || {});
  const ok = await paymentsService.verifyWebhookSignature(raw, signature);
  if (!ok) {
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }
  const result = await paymentsService.handleWebhookEvent(req.body || {});
  return res.status(200).json({ success: true, result });
});

module.exports = {
  createOrder,
  verifyPayment,
  getPayment,
  listMine,
  webhook,
};

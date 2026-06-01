// paymentsService — Razorpay integration + payment lifecycle.
//
// Surface:
//   createOrderForBooking({ bookingId, user }) -> { order, payment, keyId }
//   verifyAndRecordPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature })
//   handleWebhookEvent(event)            -> for payment.failed / refund.processed
//   refundPayment(paymentId, { amount, reason, adminId })
//
// Amounts are paise (integer) end-to-end; rupees only appear in formatters.

const crypto = require('crypto');
const Razorpay = require('razorpay');
const {
  sequelize,
  Payment,
  EscrowEntry,
  Booking,
  User,
  WalletTransaction,
  ProfessionalClient,
  ProfessionalSubscription,
  SubscriptionPlan,
} = require('../models');
const env = require('../config/env');
const { logAudit } = require('../utils/auditLogger');
const { enqueue } = require('./queueService');
const notificationService = require('./notificationService');
const adminSettingsService = require('./adminSettingsService');

let _client = null;
let _clientFingerprint = null;

/**
 * Resolve Razorpay credentials, admin-settings first, env fallback. Lets
 * the admin rotate keys from /admin/settings without a redeploy.
 */
async function resolveRazorpayCreds() {
  let keyId = '';
  let keySecret = '';
  try {
    keyId = (await adminSettingsService.getString('razorpayKeyId')) || '';
    keySecret =
      (await adminSettingsService.getString('razorpayKeySecret')) || '';
  } catch {
    /* DB unreachable — fall back to env */
  }
  if (!keyId) keyId = env.razorpay.keyId || '';
  if (!keySecret) keySecret = env.razorpay.keySecret || '';
  return { keyId, keySecret };
}

async function resolveRazorpayWebhookSecret() {
  try {
    const v = await adminSettingsService.getString('razorpayWebhookSecret');
    if (v) return v;
  } catch {
    /* fall back */
  }
  return env.razorpay.webhookSecret || '';
}

/**
 * Lazily build the Razorpay SDK client. Now async — credentials come from
 * the admin-settings DB row (preferred) or env (fallback). The cached
 * client is invalidated when the credentials fingerprint changes, so an
 * admin who rotates the keys gets a fresh client on the next call.
 */
async function razorpay() {
  const { keyId, keySecret } = await resolveRazorpayCreds();
  if (!keyId || !keySecret) {
    throw {
      statusCode: 500,
      message:
        'Razorpay is not configured. Set the Razorpay keys in /admin/settings (or RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in backend/.env).',
    };
  }
  const fp = `${keyId}|${keySecret.length}`;
  if (!_client || _clientFingerprint !== fp) {
    _client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    _clientFingerprint = fp;
  }
  return _client;
}

// Sync getter for the public key id — used by /api/auth/razorpay-config so
// the browser can open Checkout without baking the key into the build.
async function getPublicKeyId() {
  const { keyId } = await resolveRazorpayCreds();
  return keyId || '';
}

/**
 * Compute the platform fee + net payout for a gross paise amount.
 *
 * Source of the rate, in priority order:
 *   1. The professional's active subscription plan's commissionPercent.
 *      Read fresh on every payment, so a plan-level change applies to
 *      future payments immediately — and ONLY to future payments (this
 *      function is called at verify time; past Payment rows keep their
 *      frozen `platformFee` column unchanged).
 *   2. AdminSetting key=bookingMarkupBps (legacy global override).
 *   3. env.platformFeeBps default (10%).
 *
 * `bps` is basis points (1% = 100 bps). The plan's commissionPercent is
 * a decimal percentage — multiplied by 100 to convert.
 *
 * @param {number} grossPaise
 * @param {string} [payeeUserId] - the receiving professional's user id.
 *   Optional for back-compat callers that have no payee context.
 * @returns {Promise<{ platformFee: number, netAmount: number, bps: number, source: string }>}
 */
async function splitFee(grossPaise, payeeUserId = null) {
  let bps = null;
  let source = 'env';

  // 1. Subscription-plan-driven commission — preferred path.
  if (payeeUserId) {
    try {
      const sub = await ProfessionalSubscription.findOne({
        where: { userId: payeeUserId, status: 'active' },
        order: [['startDate', 'DESC']],
        raw: true,
      });
      if (sub && sub.subscriptionPlanId) {
        const plan = await SubscriptionPlan.findByPk(sub.subscriptionPlanId, {
          raw: true,
        });
        if (plan && plan.commissionPercent !== null && plan.commissionPercent !== undefined) {
          // commissionPercent is a DECIMAL like 10 or 5.5; convert to bps.
          bps = Math.round(Number(plan.commissionPercent) * 100);
          source = `plan:${plan.slug || plan.id}`;
        }
      }
    } catch {
      // Fall through to the admin-setting path.
    }
  }

  // 2. Admin-setting override (legacy / per-platform global rate).
  if (bps === null) {
    try {
      bps = await adminSettingsService.getNumber('bookingMarkupBps');
      source = 'admin_setting';
    } catch {
      bps = Number(env.platformFeeBps) || 1000;
      source = 'env';
    }
  }

  bps = Math.max(0, Math.min(10000, bps));
  const platformFee = Math.floor((grossPaise * bps) / 10000);
  const netAmount = grossPaise - platformFee;
  return { platformFee, netAmount, bps, source };
}

/**
 * Resolve a Booking's payee — for legacy `Professional.id` rows we follow
 * the chain via User.linkedId; for new-model rows we read ProfessionalDetail.
 *
 * @param {object} booking
 * @returns {Promise<string|null>} payee user id, or null when no payee
 */
async function resolvePayeeUserId(booking) {
  if (!booking || !booking.professionalId) return null;
  // New-model: ProfessionalDetail.id matches; userId is directly on it.
  const { ProfessionalDetail } = require('../models');
  const detail = await ProfessionalDetail.findOne({
    where: { id: booking.professionalId },
    raw: true,
  });
  if (detail && detail.userId) return detail.userId;
  // Legacy: lookup users.linkedId -> professionalId.
  const user = await User.findOne({
    where: { linkedId: booking.professionalId, role: 'professional' },
    raw: true,
  });
  return user ? user.id : null;
}

/**
 * Create a Razorpay order for a booking. Each call inserts a new Payment
 * row in state=created; the client uses the returned `order_id` to open
 * the checkout modal.
 */
async function createOrderForBooking({ bookingId, user }) {
  if (!user || !user.id) {
    throw { statusCode: 401, message: 'Authentication required.' };
  }
  const booking = await Booking.findByPk(bookingId);
  if (!booking) {
    throw { statusCode: 404, message: 'Booking not found.' };
  }

  // Pre-flight: only the booking's client may pay. clientId on bookings is
  // a users.id directly per the bookingService write path.
  if (booking.clientId && booking.clientId !== user.id) {
    throw {
      statusCode: 403,
      message: 'You can only pay for your own bookings.',
    };
  }

  const rupees = Number(booking.estimatedCost) || 0;
  if (rupees <= 0) {
    throw {
      statusCode: 422,
      message: 'Booking has no payable amount.',
    };
  }
  const paise = Math.round(rupees * 100);
  if (paise < 100) {
    throw {
      statusCode: 422,
      message: 'Amount must be at least ₹1.',
    };
  }
  const receipt = `bk_${booking.id.slice(-32)}`;

  const rzp = await razorpay();
  const order = await rzp.orders.create({
    amount: paise,
    currency: 'INR',
    receipt,
    notes: { bookingId: booking.id },
  });

  const payeeUserId = await resolvePayeeUserId(booking);
  if (!payeeUserId) {
    throw {
      statusCode: 422,
      message: 'Could not resolve the booking\'s professional for payout.',
    };
  }

  const payment = await Payment.create({
    bookingId: booking.id,
    userId: user.id,
    professionalUserId: payeeUserId,
    razorpayOrderId: order.id,
    receipt,
    amount: paise,
    currency: 'INR',
    status: 'created',
    rawOrder: order,
  });

  await logAudit({
    userId: user.id,
    action: 'payment.order_created',
    entity: 'payment',
    entityId: payment.id,
    status: 'success',
    metadata: { bookingId: booking.id, razorpayOrderId: order.id, amount: paise },
  });

  const { keyId } = await resolveRazorpayCreds();
  return {
    order,
    payment: payment.get({ plain: true }),
    keyId,
  };
}

/**
 * HMAC SHA-256 over `${orderId}|${paymentId}` with the Razorpay secret.
 * Re-used by both the verify endpoint and the webhook handler.
 */
async function expectedSignature(orderId, paymentId) {
  const { keySecret } = await resolveRazorpayCreds();
  return crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

/**
 * Verify the signature returned by Razorpay's success callback, then mark
 * the booking paid, create the escrow entry and credit the professional's
 * wallet — all inside a single transaction so a half-applied state cannot
 * exist on failure.
 */
async function verifyAndRecordPayment({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  userId,
}) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw {
      statusCode: 400,
      message: 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required.',
    };
  }
  const { keySecret } = await resolveRazorpayCreds();
  if (!keySecret) {
    throw {
      statusCode: 500,
      message: 'Razorpay is not configured on the server.',
    };
  }

  const payment = await Payment.findOne({
    where: { razorpayOrderId: razorpay_order_id },
  });
  if (!payment) {
    throw { statusCode: 404, message: 'No payment matches this order.' };
  }
  if (userId && payment.userId !== userId) {
    throw {
      statusCode: 403,
      message: 'You cannot verify a payment that is not yours.',
    };
  }

  const expected = await expectedSignature(
    razorpay_order_id,
    razorpay_payment_id
  );
  if (expected !== razorpay_signature) {
    await payment.update({
      status: 'failed',
      failureReason: 'Signature mismatch',
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });
    await logAudit({
      userId: payment.userId,
      action: 'payment.signature_mismatch',
      entity: 'payment',
      entityId: payment.id,
      status: 'failure',
      metadata: { razorpay_order_id, razorpay_payment_id },
    });
    throw { statusCode: 400, message: 'Payment signature verification failed.' };
  }

  // Idempotent: if we've already marked this paid, return what we have.
  if (payment.status === 'paid') {
    const existingEscrow = await EscrowEntry.findOne({
      where: { paymentId: payment.id },
    });
    return {
      payment: payment.get({ plain: true }),
      escrow: existingEscrow ? existingEscrow.get({ plain: true }) : null,
      alreadyVerified: true,
    };
  }

  // Pass the payee user id so splitFee reads their current subscription's
  // commission. payment.professionalUserId is frozen on the row at
  // checkout-creation time, so a mid-flight subscription upgrade between
  // create-order and verify is captured correctly here.
  const { platformFee, netAmount } = await splitFee(
    payment.amount,
    payment.professionalUserId
  );

  let escrowSnapshot = null;
  await sequelize.transaction(async (t) => {
    await payment.update(
      {
        status: 'paid',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        platformFee,
        netAmount,
        capturedAt: new Date(),
      },
      { transaction: t }
    );

    const escrow = await EscrowEntry.create(
      {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        professionalUserId: payment.professionalUserId,
        grossAmount: payment.amount,
        platformFee,
        netAmount,
        status: 'escrowed',
      },
      { transaction: t }
    );
    escrowSnapshot = escrow.get({ plain: true });

    await WalletTransaction.create(
      {
        walletUserId: payment.professionalUserId,
        entryType: 'credit',
        category: 'escrow_in',
        amount: netAmount,
        bookingId: payment.bookingId,
        paymentId: payment.id,
        escrowId: escrow.id,
        escrowStatus: 'escrowed',
        description: 'Payment escrowed after successful Razorpay capture.',
      },
      { transaction: t }
    );

    if (payment.bookingId) {
      await Booking.update(
        { status: 'confirmed' },
        { where: { id: payment.bookingId }, transaction: t }
      );
    }

    // Auto-link the paying client to the professional's clients list. The
    // booking row carries the public professional id, which is what the
    // ProfessionalClient table FKs against (see lawFirmService.getFirmClients
    // for the dual lookup). Skip silently if the booking has no professional
    // or if the link already exists (the unique index would throw).
    if (payment.bookingId) {
      const bookingRow = await Booking.findByPk(payment.bookingId, {
        transaction: t,
        attributes: ['professionalId'],
      });
      const professionalListingId = bookingRow && bookingRow.professionalId;
      if (professionalListingId && payment.userId) {
        const existingLink = await ProfessionalClient.findOne({
          where: {
            professionalId: professionalListingId,
            clientUserId: payment.userId,
          },
          transaction: t,
        });
        if (!existingLink) {
          await ProfessionalClient.create(
            {
              professionalId: professionalListingId,
              clientUserId: payment.userId,
              addedByUserId: payment.userId,
            },
            { transaction: t }
          );
        }
      }
    }
  });

  await logAudit({
    userId: payment.userId,
    action: 'payment.verified',
    entity: 'payment',
    entityId: payment.id,
    status: 'success',
    metadata: {
      bookingId: payment.bookingId,
      razorpay_payment_id,
      amount: payment.amount,
      platformFee,
      netAmount,
    },
  });

  // Notifications — best-effort, fire-and-forget. Failures here must not
  // unwind the verified payment.
  try {
    await notificationService.createNotification({
      userId: payment.userId,
      type: 'payment_success',
      title: 'Payment received',
      message: `We received your payment of ₹${(payment.amount / 100).toFixed(2)}. Your booking is confirmed.`,
      link: payment.bookingId
        ? `/dashboard/client/bookings`
        : '/dashboard',
      metadata: { paymentId: payment.id },
    });
    await notificationService.createNotification({
      userId: payment.professionalUserId,
      type: 'escrow_created',
      title: 'New escrowed booking',
      message: `₹${(netAmount / 100).toFixed(2)} is now held in escrow for your upcoming consultation.`,
      link: '/dashboard/professional/wallet',
      metadata: { paymentId: payment.id, escrowId: escrowSnapshot.id },
    });
    if (payment.userId) {
      await enqueue('email', {
        to: (await User.findByPk(payment.userId, { raw: true })).email,
        template: 'paymentReceipt',
        vars: {
          amount: (payment.amount / 100).toFixed(2),
          bookingId: payment.bookingId,
          paymentId: payment.id,
        },
      });
    }
  } catch (err) {
    console.warn(`[paymentsService] notification failure: ${err.message}`);
  }

  return {
    payment: await Payment.findByPk(payment.id).then((p) => p.get({ plain: true })),
    escrow: escrowSnapshot,
  };
}

/**
 * Handle a Razorpay webhook event. The webhook secret is configured in the
 * Razorpay dashboard and validated by the route handler before calling this.
 */
async function handleWebhookEvent(event) {
  if (!event || !event.event) return { ignored: true };

  // subscription.* events → delegate to the subscription webhook handler.
  // Lazy require to avoid the circular import (subscriptionRazorpayService
  // → paymentsService.razorpay).
  if (String(event.event).startsWith('subscription.')) {
    const subWebhook = require('./subscriptionWebhookService');
    return subWebhook.handleSubscriptionEvent(event);
  }

  // payment.failed → record the failure if we still have a Payment row.
  if (event.event === 'payment.failed') {
    const ent = (event.payload && event.payload.payment && event.payload.payment.entity) || {};
    const payment = await Payment.findOne({
      where: { razorpayOrderId: ent.order_id || '' },
    });
    if (payment && payment.status !== 'paid') {
      await payment.update({
        status: 'failed',
        razorpayPaymentId: ent.id || payment.razorpayPaymentId,
        failureReason: ent.error_description || 'payment.failed webhook',
        rawPayment: ent,
      });
      await logAudit({
        userId: payment.userId,
        action: 'payment.failed',
        entity: 'payment',
        entityId: payment.id,
        status: 'failure',
        metadata: { code: ent.error_code, reason: ent.error_description },
      });
    }
    return { handled: 'payment.failed', paymentId: payment ? payment.id : null };
  }

  // refund.processed → mark the parent payment refunded + reverse escrow.
  if (event.event === 'refund.processed') {
    const refund = (event.payload && event.payload.refund && event.payload.refund.entity) || {};
    const payment = await Payment.findOne({
      where: { razorpayPaymentId: refund.payment_id || '' },
    });
    if (payment) {
      await refundPayment(payment.id, {
        amount: Number(refund.amount) || payment.amount,
        reason: 'Refund processed via Razorpay',
        source: 'webhook',
      });
    }
    return { handled: 'refund.processed', paymentId: payment ? payment.id : null };
  }

  return { ignored: true, event: event.event };
}

/**
 * Issue a refund through Razorpay and reverse the escrow + wallet entries.
 * `amount` is in paise; pass `payment.amount` for a full refund.
 */
async function refundPayment(paymentId, { amount, reason, adminId, source }) {
  const payment = await Payment.findByPk(paymentId);
  if (!payment) {
    throw { statusCode: 404, message: 'Payment not found.' };
  }
  if (payment.status !== 'paid' && payment.status !== 'refunded') {
    throw {
      statusCode: 400,
      message: 'Only paid payments can be refunded.',
    };
  }
  const refundPaise = Math.max(1, Math.min(amount || payment.amount, payment.amount - payment.refundedAmount));
  if (refundPaise <= 0) {
    throw { statusCode: 400, message: 'No remaining amount to refund.' };
  }

  // Only call the Razorpay refund API for admin-initiated refunds; webhook
  // events already mean Razorpay processed the refund themselves.
  if (source !== 'webhook' && payment.razorpayPaymentId) {
    try {
      const rzp = await razorpay();
      await rzp.payments.refund(payment.razorpayPaymentId, {
        amount: refundPaise,
        notes: { reason: reason || 'Admin refund', paymentId: payment.id },
      });
    } catch (err) {
      throw {
        statusCode: 502,
        message: `Razorpay refund failed: ${err.message || err}`,
      };
    }
  }

  // Reverse escrow + wallet ledger.
  await sequelize.transaction(async (t) => {
    const escrow = await EscrowEntry.findOne({
      where: { paymentId: payment.id },
      transaction: t,
    });
    if (escrow) {
      await escrow.update({ status: 'refunded' }, { transaction: t });
      await WalletTransaction.create(
        {
          walletUserId: escrow.professionalUserId,
          entryType: 'debit',
          category: 'refund_reversal',
          amount: escrow.netAmount,
          bookingId: payment.bookingId,
          paymentId: payment.id,
          escrowId: escrow.id,
          escrowStatus: 'refunded',
          description: reason || 'Payment refunded',
          metadata: { adminId: adminId || null, refundPaise },
        },
        { transaction: t }
      );
    }
    await payment.update(
      {
        status: 'refunded',
        refundedAmount: payment.refundedAmount + refundPaise,
      },
      { transaction: t }
    );
  });

  await logAudit({
    userId: adminId || null,
    action: 'payment.refunded',
    entity: 'payment',
    entityId: payment.id,
    status: 'success',
    metadata: { refundPaise, reason, source: source || 'admin' },
  });

  return { payment: (await Payment.findByPk(payment.id)).get({ plain: true }) };
}

/**
 * Verify a Razorpay webhook signature header. Returns true / false; the
 * route handler responds with 400 on false. Async because the webhook
 * secret can now live in admin settings (rotated without a redeploy).
 */
async function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = await resolveRazorpayWebhookSecret();
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(String(signatureHeader || ''), 'hex')
    );
  } catch {
    return false;
  }
}

module.exports = {
  createOrderForBooking,
  verifyAndRecordPayment,
  refundPayment,
  handleWebhookEvent,
  verifyWebhookSignature,
  splitFee,
  // Internals exposed so the subscription service can reuse the same
  // credential-resolution chain.
  razorpay,
  resolveRazorpayCreds,
  resolveRazorpayWebhookSecret,
  getPublicKeyId,
};

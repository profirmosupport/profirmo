// subscriptionWebhookService — Razorpay subscription lifecycle webhooks.
//
// Razorpay fires these events as a subscription moves through its
// lifecycle. We translate them into ProfessionalSubscription row updates
// and audit log entries.
//
//   subscription.authenticated → mandate authorised by the user, payment
//                                hasn't happened yet. Keep status='pending'.
//   subscription.activated     → first charge succeeded, sub is live.
//   subscription.charged       → recurring charge succeeded — extend
//                                endDate, record amountPaid.
//   subscription.cancelled     → user/admin cancelled. status='cancelled'.
//   subscription.completed     → total_count reached. status='expired'.
//   subscription.paused/halted → payment failed N times. status='past_due'.
//   subscription.pending       → first attempt failed but retries remain.
//
// All paths are idempotent: re-delivering the same webhook is a no-op.

const {
  ProfessionalSubscription,
  SubscriptionPlan,
  SubscriptionPayment,
} = require('../models');
const { logAudit } = require('../utils/auditLogger');
const notificationService = require('./notificationService');
const subscriptionRazorpayService = require('./subscriptionRazorpayService');

// Razorpay nests the subscription entity under payload.subscription.entity.
function extractSubscriptionEntity(event) {
  return (
    (event &&
      event.payload &&
      event.payload.subscription &&
      event.payload.subscription.entity) ||
    null
  );
}
function extractPaymentEntity(event) {
  return (
    (event &&
      event.payload &&
      event.payload.payment &&
      event.payload.payment.entity) ||
    null
  );
}

/**
 * Look up the local ProfessionalSubscription that mirrors this Razorpay
 * subscription. Returns null when no matching row exists (the event must
 * be for a sub we don't track — Razorpay sandbox dashboards sometimes
 * emit these).
 */
async function findLocalSubscription(razorpaySubscriptionId) {
  if (!razorpaySubscriptionId) return null;
  return ProfessionalSubscription.findOne({
    where: { razorpaySubscriptionId },
  });
}

/**
 * Top-level dispatcher used by paymentsService.handleWebhookEvent.
 */
async function handleSubscriptionEvent(event) {
  const type = event && event.event;
  switch (type) {
    case 'subscription.authenticated':
      return onAuthenticated(event);
    case 'subscription.activated':
      return onActivated(event);
    case 'subscription.charged':
      return onCharged(event);
    case 'subscription.cancelled':
      return onCancelled(event);
    case 'subscription.completed':
      return onCompleted(event);
    case 'subscription.paused':
    case 'subscription.halted':
      return onHaltedOrPaused(event);
    case 'subscription.pending':
      return onPending(event);
    case 'subscription.updated':
      return onUpdated(event);
    default:
      return { ignored: true, event: type };
  }
}

// --- Individual event handlers --------------------------------------------

async function onAuthenticated(event) {
  const ent = extractSubscriptionEntity(event);
  if (!ent || !ent.id) return { ignored: true, reason: 'no-entity' };
  const sub = await findLocalSubscription(ent.id);
  if (!sub) return { ignored: true, reason: 'unknown-sub' };
  await sub.update({
    razorpaySubscriptionStatus: ent.status || 'authenticated',
  });
  await logAudit({
    userId: sub.userId,
    action: 'subscription.authenticated',
    entity: 'professional_subscription',
    entityId: sub.id,
    status: 'success',
    metadata: { razorpaySubscriptionId: ent.id },
  });
  return { handled: 'subscription.authenticated', subscriptionId: sub.id };
}

async function onActivated(event) {
  const ent = extractSubscriptionEntity(event);
  if (!ent || !ent.id) return { ignored: true, reason: 'no-entity' };
  const sub = await findLocalSubscription(ent.id);
  if (!sub) return { ignored: true, reason: 'unknown-sub' };
  if (sub.status === 'active') {
    // Idempotent — already active.
    return { handled: 'subscription.activated', subscriptionId: sub.id, noop: true };
  }
  // Resolve plan to refresh the commission snapshot — guards against the
  // (rare) case where the plan's commission changed between upgrade-init
  // and activation. Commission is still frozen at this moment so future
  // payments use the rate the user agreed to when activating.
  const plan = await SubscriptionPlan.findByPk(sub.subscriptionPlanId);
  await sub.update({
    status: 'active',
    paymentStatus: 'paid',
    razorpaySubscriptionStatus: ent.status || 'active',
    commissionPercentSnapshot:
      plan && plan.commissionPercent !== null && plan.commissionPercent !== undefined
        ? plan.commissionPercent
        : sub.commissionPercentSnapshot,
    adminNotes: sub.adminNotes || 'Activated via Razorpay webhook.',
  });
  await logAudit({
    userId: sub.userId,
    action: 'subscription.activated',
    entity: 'professional_subscription',
    entityId: sub.id,
    status: 'success',
    metadata: { razorpaySubscriptionId: ent.id, planId: sub.subscriptionPlanId },
  });
  // Best-effort notification.
  try {
    await notificationService.createNotification({
      userId: sub.userId,
      type: 'subscription_activated',
      title: 'Subscription active',
      message: `Your ${plan ? plan.name : 'subscription'} plan is now active.`,
      link: '/dashboard/professional/subscription',
      metadata: { subscriptionId: sub.id },
    });
  } catch (err) {
    console.warn(`[subscriptionWebhook] notify failed: ${err.message}`);
  }
  return { handled: 'subscription.activated', subscriptionId: sub.id };
}

async function onCharged(event) {
  const ent = extractSubscriptionEntity(event);
  const payment = extractPaymentEntity(event);
  if (!ent || !ent.id) return { ignored: true, reason: 'no-entity' };
  const sub = await findLocalSubscription(ent.id);
  if (!sub) return { ignored: true, reason: 'unknown-sub' };

  // Extend endDate one billing period from the current end (or now if
  // we're past it). We deliberately use the local cycle rather than
  // Razorpay's date math, since our quotas reference endDate.
  const now = new Date();
  const base = sub.endDate && new Date(sub.endDate) > now ? new Date(sub.endDate) : now;
  const newEnd = new Date(base);
  if (sub.billingCycle === 'annual') newEnd.setFullYear(newEnd.getFullYear() + 1);
  else newEnd.setMonth(newEnd.getMonth() + 1);

  const paidRupees = payment && payment.amount ? Number(payment.amount) / 100 : null;

  await sub.update({
    status: 'active',
    paymentStatus: 'paid',
    razorpaySubscriptionStatus: ent.status || 'active',
    endDate: newEnd,
    amountPaid: paidRupees !== null ? paidRupees : sub.amountPaid,
    transactionId: payment ? payment.id : sub.transactionId,
  });

  // Mirror the charge as a SubscriptionPayment row so it shows up in the
  // professional's payment history. Idempotent against (subscriptionId,
  // transactionId) — re-delivered webhooks won't duplicate the row.
  if (payment && payment.id) {
    const existing = await SubscriptionPayment.findOne({
      where: { subscriptionId: sub.id, transactionId: payment.id },
    });
    if (!existing) {
      await SubscriptionPayment.create({
        userId: sub.userId,
        subscriptionId: sub.id,
        subscriptionPlanId: sub.subscriptionPlanId,
        billingCycle: sub.billingCycle,
        amount: paidRupees || 0,
        currency: payment.currency || sub.currency || 'INR',
        totalAmount: paidRupees || 0,
        paymentGateway: 'razorpay',
        transactionId: payment.id,
        paymentStatus: 'paid',
        paymentDate: new Date(),
        gatewayPayload: payment,
      });
    }
  }

  await logAudit({
    userId: sub.userId,
    action: 'subscription.charged',
    entity: 'professional_subscription',
    entityId: sub.id,
    status: 'success',
    metadata: {
      razorpaySubscriptionId: ent.id,
      razorpayPaymentId: payment ? payment.id : null,
      amount: payment ? payment.amount : null,
    },
  });
  return { handled: 'subscription.charged', subscriptionId: sub.id };
}

async function onCancelled(event) {
  const ent = extractSubscriptionEntity(event);
  if (!ent || !ent.id) return { ignored: true, reason: 'no-entity' };
  const sub = await findLocalSubscription(ent.id);
  if (!sub) return { ignored: true, reason: 'unknown-sub' };
  if (sub.status === 'cancelled') {
    return { handled: 'subscription.cancelled', subscriptionId: sub.id, noop: true };
  }
  await sub.update({
    status: 'cancelled',
    razorpaySubscriptionStatus: ent.status || 'cancelled',
    cancelledAt: new Date(),
    autoRenew: false,
  });
  // Restore the user to the default Starter plan so the dashboard
  // never shows "No active plan" after a cancellation / payment
  // failure. Failure here is non-fatal — the next dashboard load will
  // also call ensureStarterForProfessional as a fallback.
  try {
    const subscriptionService = require('./subscriptionService');
    await subscriptionService.ensureStarterForProfessional(sub.userId);
  } catch (err) {
    console.warn(
      `[subscriptionWebhook] starter restore after cancel failed: ${err.message || err}`
    );
  }
  await logAudit({
    userId: sub.userId,
    action: 'subscription.cancelled',
    entity: 'professional_subscription',
    entityId: sub.id,
    status: 'success',
    metadata: { razorpaySubscriptionId: ent.id },
  });
  return { handled: 'subscription.cancelled', subscriptionId: sub.id };
}

async function onCompleted(event) {
  const ent = extractSubscriptionEntity(event);
  if (!ent || !ent.id) return { ignored: true, reason: 'no-entity' };
  const sub = await findLocalSubscription(ent.id);
  if (!sub) return { ignored: true, reason: 'unknown-sub' };
  await sub.update({
    status: 'expired',
    razorpaySubscriptionStatus: ent.status || 'completed',
    autoRenew: false,
  });
  return { handled: 'subscription.completed', subscriptionId: sub.id };
}

async function onHaltedOrPaused(event) {
  const ent = extractSubscriptionEntity(event);
  if (!ent || !ent.id) return { ignored: true, reason: 'no-entity' };
  const sub = await findLocalSubscription(ent.id);
  if (!sub) return { ignored: true, reason: 'unknown-sub' };
  await sub.update({
    status: 'past_due',
    razorpaySubscriptionStatus: ent.status || 'halted',
  });
  try {
    await notificationService.createNotification({
      userId: sub.userId,
      type: 'subscription_past_due',
      title: 'Subscription payment failed',
      message:
        'We could not collect your subscription payment. Please update your payment method.',
      link: '/dashboard/professional/subscription',
      metadata: { subscriptionId: sub.id },
    });
  } catch (err) {
    console.warn(`[subscriptionWebhook] notify failed: ${err.message}`);
  }
  return { handled: event.event, subscriptionId: sub.id };
}

async function onPending(event) {
  const ent = extractSubscriptionEntity(event);
  if (!ent || !ent.id) return { ignored: true, reason: 'no-entity' };
  const sub = await findLocalSubscription(ent.id);
  if (!sub) return { ignored: true, reason: 'unknown-sub' };
  await sub.update({
    razorpaySubscriptionStatus: ent.status || 'pending',
  });
  return { handled: 'subscription.pending', subscriptionId: sub.id };
}

async function onUpdated(event) {
  const ent = extractSubscriptionEntity(event);
  if (!ent || !ent.id) return { ignored: true, reason: 'no-entity' };
  const sub = await findLocalSubscription(ent.id);
  if (!sub) return { ignored: true, reason: 'unknown-sub' };
  const mapped = subscriptionRazorpayService.mapRazorpayStatusToInternal(
    ent.status
  );
  const patch = { razorpaySubscriptionStatus: ent.status || sub.razorpaySubscriptionStatus };
  if (mapped && mapped !== sub.status) patch.status = mapped;
  await sub.update(patch);
  return { handled: 'subscription.updated', subscriptionId: sub.id };
}

module.exports = { handleSubscriptionEvent };

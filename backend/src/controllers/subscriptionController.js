// subscriptionController — admin HTTP surface for the subscription module.
// All routes are auth-gated by adminRoutes (authenticate + authorize
// 'platform_admin'), so we don't repeat the gate here.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const { logAudit } = require('../utils/auditLogger');
const subscriptionService = require('../services/subscriptionService');

const meta = (req) => ({
  userAgent: req.get('User-Agent'),
  ipAddress: req.ip,
});

// GET /api/admin/subscription-plans
const adminList = asyncHandler(async (req, res) => {
  const items = await subscriptionService.adminList({
    search: req.query.search,
    status: req.query.status,
    planType: req.query.planType,
  });
  return successResponse(res, 200, 'Subscription plans', { items });
});

// GET /api/admin/subscription-plans/feature-keys
// Returns the canonical feature-key registry so the admin editor can render
// the rules grid without hard-coding the list on the frontend.
const adminFeatureKeys = asyncHandler(async (req, res) => {
  return successResponse(res, 200, 'Feature keys', {
    items: subscriptionService.FEATURE_KEYS.map(([key, name]) => ({ key, name })),
  });
});

// GET /api/admin/subscription-plans/:id
const adminGet = asyncHandler(async (req, res) => {
  const item = await subscriptionService.adminGet(req.params.id);
  return successResponse(res, 200, 'Subscription plan', { item });
});

// POST /api/admin/subscription-plans
const adminCreate = asyncHandler(async (req, res) => {
  const item = await subscriptionService.adminCreate(req.body);
  await logAudit({
    req,
    userId: req.user && req.user.id,
    action: 'admin.subscription_plan.created',
    entity: 'subscription_plan',
    entityId: item.id,
    status: 'success',
    metadata: { name: item.name, slug: item.slug },
  });
  return successResponse(res, 201, 'Plan created', { item });
});

// PATCH /api/admin/subscription-plans/:id
const adminUpdate = asyncHandler(async (req, res) => {
  const item = await subscriptionService.adminUpdate(req.params.id, req.body);
  await logAudit({
    req,
    userId: req.user && req.user.id,
    action: 'admin.subscription_plan.updated',
    entity: 'subscription_plan',
    entityId: item.id,
    status: 'success',
    metadata: { name: item.name, slug: item.slug },
  });
  return successResponse(res, 200, 'Plan updated', { item });
});

// PATCH /api/admin/subscription-plans/:id/status   body: { status }
const adminSetStatus = asyncHandler(async (req, res) => {
  const item = await subscriptionService.adminSetStatus(
    req.params.id,
    req.body && req.body.status
  );
  await logAudit({
    req,
    userId: req.user && req.user.id,
    action: 'admin.subscription_plan.status_changed',
    entity: 'subscription_plan',
    entityId: item.id,
    status: 'success',
    metadata: { newStatus: item.status },
  });
  return successResponse(res, 200, 'Plan status updated', { item });
});

// POST /api/admin/subscription-plans/:id/duplicate
const adminDuplicate = asyncHandler(async (req, res) => {
  const item = await subscriptionService.adminDuplicate(req.params.id);
  await logAudit({
    req,
    userId: req.user && req.user.id,
    action: 'admin.subscription_plan.duplicated',
    entity: 'subscription_plan',
    entityId: item.id,
    status: 'success',
    metadata: { sourceId: req.params.id, newSlug: item.slug },
  });
  return successResponse(res, 201, 'Plan duplicated', { item });
});

// DELETE /api/admin/subscription-plans/:id
const adminDelete = asyncHandler(async (req, res) => {
  try {
    const result = await subscriptionService.adminDelete(req.params.id);
    await logAudit({
      req,
      userId: req.user && req.user.id,
      action: 'admin.subscription_plan.deleted',
      entity: 'subscription_plan',
      entityId: req.params.id,
      status: 'success',
    });
    return successResponse(res, 200, 'Plan deleted', result);
  } catch (err) {
    if (err && err.statusCode === 409) {
      return res
        .status(409)
        .json({ success: false, message: err.message, errors: null });
    }
    throw err;
  }
});

// GET /api/admin/subscription-plans/:id/subscribers
const adminListSubscribers = asyncHandler(async (req, res) => {
  const items = await subscriptionService.adminListSubscribers(req.params.id);
  return successResponse(res, 200, 'Subscribers', { items });
});

// --- Public / professional handlers ---------------------------------------

// GET /api/subscription-plans   (public, no auth required)
// Returns the plans that should appear on the dashboard subscription page.
const listPublicPlans = asyncHandler(async (req, res) => {
  const items = await subscriptionService.listPublicPlans();
  return successResponse(res, 200, 'Subscription plans', { items });
});

// GET /api/subscriptions/me   (auth required)
// Returns the logged-in user's active subscription + the plan it links to,
// or null when the user has no subscription on record.
const getMine = asyncHandler(async (req, res) => {
  const userId = req.user && (req.user.id || req.user.sub);
  const subscription =
    await subscriptionService.getActiveSubscriptionForUser(userId);
  return successResponse(res, 200, 'Current subscription', { subscription });
});

// GET /api/subscriptions/usage   (auth required)
// Returns the logged-in user's current usage against their plan's limits
// (cases, firms, firm cases, firm members). Powers the per-page quota
// banners on the dashboards. Returns `usage: null` when no plan is on file.
const getMyUsage = asyncHandler(async (req, res) => {
  const userId = req.user && (req.user.id || req.user.sub);
  const usage = await subscriptionService.getUsageForUser(userId);
  return successResponse(res, 200, 'Current usage', { usage });
});

// POST /api/subscriptions/upgrade   (auth required)
// Body: { planSlug, billingCycle? }
// Switches the logged-in user to the named plan. Custom plans are rejected
// here — they must be initiated via the support CTA.
const upgrade = asyncHandler(async (req, res) => {
  const userId = req.user && (req.user.id || req.user.sub);
  const { planSlug, billingCycle } = req.body || {};
  try {
    const subscription = await subscriptionService.upgradeSubscription(userId, {
      planSlug,
      billingCycle,
    });
    await logAudit({
      req,
      userId,
      action: 'subscription.upgraded',
      entity: 'professional_subscription',
      entityId: subscription.id,
      status: 'success',
      metadata: {
        planSlug,
        billingCycle: subscription.billingCycle,
        paymentStatus: subscription.paymentStatus,
      },
    });
    return successResponse(res, 200, 'Subscription updated', { subscription });
  } catch (err) {
    await logAudit({
      req,
      userId,
      action: 'subscription.upgrade_failed',
      entity: 'professional_subscription',
      status: 'failure',
      metadata: { planSlug, code: err && err.code ? err.code : undefined },
    });
    if (
      err &&
      (err.code === 'CUSTOM_PLAN_REQUIRES_SUPPORT' || err.statusCode === 400)
    ) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message,
        errors: null,
        code: err.code,
      });
    }
    throw err;
  }
});

// POST /api/subscriptions/confirm   (auth required)
// Body: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
// Called by the frontend right after Razorpay Checkout reports success.
// Verifies the signature, flips the subscription to active immediately
// and records a SubscriptionPayment row — without waiting on the webhook.
const confirmPayment = asyncHandler(async (req, res) => {
  const userId = req.user && (req.user.id || req.user.sub);
  const result = await subscriptionService.confirmSubscriptionPayment(
    userId,
    req.body || {}
  );
  await logAudit({
    req,
    userId,
    action: 'subscription.payment_confirmed',
    entity: 'professional_subscription',
    entityId: result.subscription && result.subscription.id,
    status: 'success',
    metadata: {
      razorpayPaymentId: req.body && req.body.razorpay_payment_id,
      razorpaySubscriptionId: req.body && req.body.razorpay_subscription_id,
    },
  });
  return successResponse(res, 200, 'Subscription payment confirmed', result);
});

// GET /api/subscriptions/payments/mine   (auth required)
// Subscription payment history for the caller (paid plans only).
const listMyPayments = asyncHandler(async (req, res) => {
  const userId = req.user && (req.user.id || req.user.sub);
  const items = await subscriptionService.listSubscriptionPaymentsForUser(userId);
  return successResponse(res, 200, 'Subscription payments', { items });
});

// POST /api/admin/users/:id/subscription   (platform_admin only)
// Body: { planId | planSlug, billingCycle, endDate?, amountPaid?, adminNotes? }
// Grants the target user a subscription for a fixed window without
// going through Razorpay. Cancels any existing active subscription
// (including the Razorpay mandate) first.
const adminActivateSubscription = asyncHandler(async (req, res) => {
  const actingUserId = req.user && (req.user.id || req.user.sub);
  const targetUserId = req.params.id;
  const subscription = await subscriptionService.adminActivateSubscription({
    targetUserId,
    planId: req.body && req.body.planId,
    planSlug: req.body && req.body.planSlug,
    billingCycle: (req.body && req.body.billingCycle) || 'monthly',
    endDate: req.body && req.body.endDate,
    amountPaid: req.body && req.body.amountPaid,
    adminNotes: req.body && req.body.adminNotes,
    actingUserId,
  });
  await logAudit({
    req,
    userId: actingUserId,
    action: 'admin.subscription.activated',
    entity: 'professional_subscription',
    entityId: subscription.id,
    status: 'success',
    metadata: {
      targetUserId,
      planId: subscription.subscriptionPlanId,
      billingCycle: subscription.billingCycle,
      endDate: subscription.endDate,
    },
  });
  return successResponse(res, 201, 'Subscription activated', { subscription });
});

module.exports = {
  adminList,
  adminFeatureKeys,
  adminGet,
  adminCreate,
  adminUpdate,
  adminSetStatus,
  adminDuplicate,
  adminDelete,
  adminListSubscribers,
  listPublicPlans,
  getMine,
  getMyUsage,
  upgrade,
  confirmPayment,
  listMyPayments,
  adminActivateSubscription,
};

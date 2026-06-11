// subscriptionRazorpayService — Razorpay Subscriptions API wrapper.
//
// Razorpay's recurring billing flow per the docs:
//   1. Create a "plan" object once per (price, period) — we store the
//      resulting `plan_id` on SubscriptionPlan.razorpayPlanIdMonthly /
//      ...Annual. (Admin can paste the id from the dashboard, or call
//      `createRazorpayPlanForLocal` to provision it server-side.)
//   2. Create a "customer" once per professional — id stored on
//      ProfessionalSubscription.razorpayCustomerId for reuse.
//   3. Create a "subscription" against (plan_id, customer_id) — Razorpay
//      returns sub_xxx + a short_url. Frontend opens Razorpay Checkout
//      with `subscription_id` so the user can authorise the mandate.
//   4. Webhook subscription.authenticated → 'authenticated';
//      subscription.activated → 'active'; subscription.charged →
//      recurring payment captured; subscription.cancelled/halted/expired
//      → terminal states.
//
// All credentials are resolved through paymentsService.resolveRazorpayCreds
// so the same DB-first / env-fallback chain applies — no duplicate config.

const { Op } = require('sequelize');
const Razorpay = require('razorpay');
const {
  ProfessionalSubscription,
  SubscriptionPlan,
  User,
} = require('../models');
const paymentsService = require('./paymentsService');
const { logAudit } = require('../utils/auditLogger');

/**
 * Build a Razorpay SDK client. Re-uses the credential resolver from
 * paymentsService so admin-settings rotation Just Works for both flows.
 */
async function razorpayClient() {
  return paymentsService.razorpay();
}

/**
 * Map our internal billing cycle to the Razorpay plan_id stored on the
 * SubscriptionPlan row. Throws 422 when the cycle isn't enabled for the
 * plan (e.g. annual not yet wired in the admin UI).
 */
function razorpayPlanIdFor(plan, billingCycle) {
  if (billingCycle === 'annual') {
    if (!plan.razorpayPlanIdAnnual) {
      throw {
        statusCode: 422,
        message:
          `The "${plan.name}" plan does not have a Razorpay annual plan id ` +
          'configured. Set it in the admin plan editor before enabling annual billing.',
      };
    }
    return plan.razorpayPlanIdAnnual;
  }
  if (!plan.razorpayPlanIdMonthly) {
    throw {
      statusCode: 422,
      message:
        `The "${plan.name}" plan does not have a Razorpay monthly plan id ` +
        'configured. Set it in the admin plan editor before charging this plan.',
    };
  }
  return plan.razorpayPlanIdMonthly;
}

/**
 * Lazily provision a Razorpay plan when the local SubscriptionPlan
 * doesn't already have an id for the requested billing cycle. The new
 * `plan_xxx` id is persisted back to the row so we only ever create one
 * Razorpay plan per (local plan, cycle).
 *
 * Razorpay plans are immutable once created — if the admin changes the
 * price, they must clear the saved id from the plan editor first; the
 * next upgrade will then provision a fresh Razorpay plan at the new
 * price.
 */
async function ensureRazorpayPlanId(plan, billingCycle) {
  const field =
    billingCycle === 'annual' ? 'razorpayPlanIdAnnual' : 'razorpayPlanIdMonthly';
  if (plan[field]) return plan[field];

  // Sanity-check the local plan is actually billable on this cycle.
  if (billingCycle === 'annual' && !plan.annualEnabled) {
    throw {
      statusCode: 422,
      message: `Annual billing is not enabled for the "${plan.name}" plan.`,
    };
  }
  if (billingCycle === 'monthly' && !plan.monthlyEnabled) {
    throw {
      statusCode: 422,
      message: `Monthly billing is not enabled for the "${plan.name}" plan.`,
    };
  }

  const priceRupees =
    billingCycle === 'annual'
      ? Number(plan.annualPrice)
      : Number(plan.monthlyPrice);
  if (!Number.isFinite(priceRupees) || priceRupees <= 0) {
    throw {
      statusCode: 422,
      message:
        `The "${plan.name}" plan has no ${billingCycle} price set — cannot ` +
        'create a Razorpay subscription. Update the price in the admin plan editor.',
    };
  }
  const amountPaise = Math.round(priceRupees * 100);

  const rzp = await razorpayClient();
  let created;
  try {
    created = await rzp.plans.create({
      period: billingCycle === 'annual' ? 'yearly' : 'monthly',
      interval: 1,
      item: {
        name: `${plan.name} (${billingCycle})`.slice(0, 100),
        amount: amountPaise,
        currency: plan.currency || 'INR',
        description: (plan.shortDescription || '').slice(0, 250) || undefined,
      },
      notes: {
        planId: plan.id,
        planSlug: plan.slug,
        billingCycle,
      },
    });
  } catch (err) {
    throw {
      statusCode: 502,
      message: `Razorpay plan create failed: ${err.message || err.error?.description || err}`,
    };
  }

  // Persist back so subsequent upgrades reuse the same Razorpay plan.
  await SubscriptionPlan.update(
    { [field]: created.id },
    { where: { id: plan.id } }
  );
  plan[field] = created.id;

  try {
    await logAudit({
      action: 'razorpay.plan_auto_provisioned',
      entity: 'subscription_plan',
      entityId: plan.id,
      status: 'success',
      metadata: {
        billingCycle,
        razorpayPlanId: created.id,
        amountPaise,
        currency: plan.currency || 'INR',
      },
    });
  } catch {
    /* audit best-effort */
  }
  return created.id;
}

/**
 * Re-use the customer attached to the user's most recent subscription
 * (active or otherwise) before creating a new one. Razorpay rejects
 * duplicate customers with the same contact info, so we always look up
 * first.
 */
async function getOrCreateCustomer(userId) {
  const user = await User.findByPk(userId, { raw: true });
  if (!user) {
    throw { statusCode: 404, message: 'User not found.' };
  }

  const existingWithCustomer = await ProfessionalSubscription.findOne({
    where: { userId, razorpayCustomerId: { [Op.ne]: null } },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  if (existingWithCustomer && existingWithCustomer.razorpayCustomerId) {
    return existingWithCustomer.razorpayCustomerId;
  }

  const rzp = await razorpayClient();
  const fullName =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email ||
    'Profirmo customer';

  let customer;
  try {
    customer = await rzp.customers.create({
      name: fullName.slice(0, 50),
      email: user.email || undefined,
      contact: user.mobileNumber || undefined,
      fail_existing: 0, // return the matching customer instead of erroring
      notes: { userId: user.id },
    });
  } catch (err) {
    throw {
      statusCode: 502,
      message: `Razorpay customer create failed: ${err.message || err.error?.description || err}`,
    };
  }
  return customer.id;
}

/**
 * Create a Razorpay subscription for the given user + plan + billing
 * cycle. Returns the Razorpay subscription entity + the short_url so the
 * caller can store ids on the ProfessionalSubscription row.
 *
 * Razorpay requires `total_count` (number of billing cycles to charge).
 * We use 60 months for monthly, 10 years for annual — large enough that
 * the user won't hit the cap before they cancel, small enough to keep
 * Razorpay happy.
 */
async function createSubscription({ userId, plan, billingCycle = 'monthly' }) {
  if (!userId) throw { statusCode: 401, message: 'Not authenticated.' };
  if (!plan) throw { statusCode: 404, message: 'Plan not found.' };

  // total_count is required by Razorpay. Cap recurring billing windows so
  // they're not effectively perpetual — Razorpay rejects unbounded subs.
  const totalCount = billingCycle === 'annual' ? 10 : 60;
  const planField =
    billingCycle === 'annual'
      ? 'razorpayPlanIdAnnual'
      : 'razorpayPlanIdMonthly';

  // Auto-provisions a Razorpay plan if one isn't already linked to this
  // local plan + cycle. Admins only need to set the price; the Razorpay
  // plan id is created and persisted on first use.
  let razorpayPlanId = await ensureRazorpayPlanId(plan, billingCycle);
  let customerId = await getOrCreateCustomer(userId);

  async function attempt() {
    const rzp = await razorpayClient();
    return rzp.subscriptions.create({
      plan_id: razorpayPlanId,
      customer_id: customerId,
      total_count: totalCount,
      customer_notify: 1,
      notes: {
        userId,
        planId: plan.id,
        planSlug: plan.slug,
        billingCycle,
      },
    });
  }

  function describeError(err) {
    return String(
      err?.error?.description ||
        err?.message ||
        err ||
        ''
    );
  }
  // Razorpay returns this generic message when EITHER the plan_id OR
  // the customer_id is from another account / environment (e.g. after
  // an admin flipped the live/test mode toggle without clearing the
  // cached ids on the local SubscriptionPlan / ProfessionalSubscription
  // rows).
  function isUnknownIdError(err) {
    const msg = describeError(err).toLowerCase();
    return (
      msg.includes('id provided does not exist') ||
      msg.includes('does not exist') ||
      msg.includes('no such')
    );
  }

  let subscription;
  try {
    subscription = await attempt();
  } catch (err) {
    if (!isUnknownIdError(err)) {
      throw {
        statusCode: 502,
        message: `Razorpay subscription create failed: ${describeError(err) || err}`,
      };
    }
    // Recovery — the admin-configured `razorpayPlanIdMonthly` /
    // `razorpayPlanIdAnnual` is the SOURCE OF TRUTH for which Razorpay
    // plan to bill against. We never overwrite it here. If it's stale,
    // the admin must update it on the subscription plan edit page.
    // Only the user's auto-generated customer id is cleared and
    // re-minted, since that's a record we own end-to-end.
    try {
      await ProfessionalSubscription.update(
        { razorpayCustomerId: null },
        { where: { userId } }
      );
      customerId = await getOrCreateCustomer(userId);
    } catch (innerErr) {
      throw {
        statusCode: 502,
        message: `Razorpay customer re-provision failed: ${describeError(innerErr) || innerErr}`,
      };
    }
    try {
      subscription = await attempt();
    } catch (retryErr) {
      // Still failing — the configured plan id is the prime suspect.
      // Surface that explicitly so the admin knows where to look.
      if (isUnknownIdError(retryErr)) {
        throw {
          statusCode: 502,
          message:
            `Razorpay rejected plan id "${razorpayPlanId}" for the ` +
            `"${plan.name}" plan (${billingCycle}). Update the ` +
            `${planField} field on the admin subscription plan edit page ` +
            `with a valid id from your active Razorpay account.`,
        };
      }
      throw {
        statusCode: 502,
        message: `Razorpay subscription create failed (after retry): ${describeError(retryErr) || retryErr}`,
      };
    }
  }
  return {
    subscription,
    customerId,
    razorpayPlanId,
  };
}

/**
 * Cancel a live Razorpay subscription. `cancel_at_cycle_end=0` cancels
 * immediately; pass `true` to let it run until the current billing cycle
 * ends (default).
 */
async function cancelSubscription(razorpaySubscriptionId, { atCycleEnd = true } = {}) {
  if (!razorpaySubscriptionId) {
    throw { statusCode: 400, message: 'Razorpay subscription id required.' };
  }
  const rzp = await razorpayClient();
  try {
    return await rzp.subscriptions.cancel(razorpaySubscriptionId, atCycleEnd);
  } catch (err) {
    throw {
      statusCode: 502,
      message: `Razorpay subscription cancel failed: ${err.message || err.error?.description || err}`,
    };
  }
}

/**
 * Fetch a subscription's current state from Razorpay — used by the
 * "resync from Razorpay" admin action and by the post-checkout flow to
 * confirm the subscription is actually live before the user sees an
 * "active" badge.
 */
async function fetchSubscription(razorpaySubscriptionId) {
  if (!razorpaySubscriptionId) return null;
  const rzp = await razorpayClient();
  try {
    return await rzp.subscriptions.fetch(razorpaySubscriptionId);
  } catch (err) {
    if (err && err.statusCode === 404) return null;
    throw {
      statusCode: 502,
      message: `Razorpay subscription fetch failed: ${err.message || err.error?.description || err}`,
    };
  }
}

/**
 * Map a Razorpay subscription status to our internal
 * ProfessionalSubscription.status column. Razorpay has more granular
 * states than we model — this is the canonical translation table.
 */
function mapRazorpayStatusToInternal(rzpStatus) {
  switch ((rzpStatus || '').toLowerCase()) {
    case 'created':
    case 'authenticated':
      return 'pending';
    case 'active':
      return 'active';
    case 'paused':
    case 'halted':
      return 'past_due';
    case 'cancelled':
      return 'cancelled';
    case 'completed':
    case 'expired':
      return 'expired';
    default:
      return null;
  }
}

module.exports = {
  getOrCreateCustomer,
  createSubscription,
  cancelSubscription,
  fetchSubscription,
  mapRazorpayStatusToInternal,
  razorpayPlanIdFor,
  ensureRazorpayPlanId,
};

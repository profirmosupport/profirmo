// subscriptionService — admin CRUD over subscription plans + feature rules,
// plus a small helper for "who's subscribed to plan X". The public-facing
// pro dashboard surface is intentionally NOT here — that goes on a separate
// service when we wire the pro-side subscription UI.

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  SubscriptionPlan,
  SubscriptionFeatureRule,
  ProfessionalSubscription,
  SubscriptionPayment,
  User,
  sequelize,
} = require('../models');

// Canonical feature-key registry — must stay in sync with the seeder.
const FEATURE_KEYS = [
  ['consultation_booking', 'Consultation booking'],
  ['escrow_payment', 'Escrow payment'],
  ['payout_request', 'Payout request'],
  ['case_management', 'Case management'],
  ['case_limit', 'Case limit'],
  ['firm_creation', 'Firm creation'],
  ['firm_limit', 'Firm limit'],
  ['firm_professional_limit', 'Firm professional limit'],
  ['firm_case_limit', 'Firm case limit'],
  ['team_management', 'Team management'],
  ['document_upload', 'Document upload'],
  ['client_management', 'Client management'],
  ['calendar_management', 'Calendar management'],
  ['invoice_generation', 'Invoice generation'],
  ['priority_support', 'Priority support'],
  ['whatsapp_support', 'WhatsApp support'],
  ['featured_profile', 'Featured profile'],
  ['priority_listing', 'Priority listing'],
  ['ai_features', 'AI features'],
  ['custom_branding', 'Custom branding'],
  ['analytics_dashboard', 'Analytics dashboard'],
];
const FEATURE_NAME_BY_KEY = Object.fromEntries(FEATURE_KEYS);

// --- Helpers --------------------------------------------------------------

const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

async function ensureUniqueSlug(base, ignoreId = null) {
  let candidate = base || 'plan';
  let n = 2;
  while (true) {
    const where = { slug: candidate };
    if (ignoreId) where.id = { [Op.ne]: ignoreId };
    const exists = await SubscriptionPlan.findOne({ where });
    if (!exists) return candidate;
    candidate = `${base}-${n++}`;
  }
}

// Decorate a plan row with its feature rules + active-subscriber count so
// the admin UI can render the full picture in one fetch.
async function decorate(plan, { withSubscribers = false } = {}) {
  if (!plan) return null;
  const row = plan.get ? plan.get({ plain: true }) : plan;
  const [rules, subscriberCount] = await Promise.all([
    SubscriptionFeatureRule.findAll({
      where: { subscriptionPlanId: row.id },
      raw: true,
    }),
    ProfessionalSubscription.count({
      where: { subscriptionPlanId: row.id, status: 'active' },
    }),
  ]);
  row.featureRules = rules;
  row.activeSubscriberCount = subscriberCount;
  if (withSubscribers) {
    const subs = await ProfessionalSubscription.findAll({
      where: { subscriptionPlanId: row.id, status: 'active' },
      raw: true,
    });
    const userIds = subs.map((s) => s.userId);
    const users = userIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: userIds } },
          attributes: [
            'id',
            'email',
            'fullName',
            'firstName',
            'lastName',
            'role',
            'mobileNumber',
            'status',
          ],
          raw: true,
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));
    row.subscribers = subs.map((s) => ({
      ...s,
      user: userById.get(s.userId) || null,
    }));
  }
  return row;
}

// --- List / get -----------------------------------------------------------

async function adminList({ search = '', status = '', planType = '' } = {}) {
  const where = {};
  if (status) where.status = String(status).toLowerCase();
  if (planType) where.planType = String(planType).toLowerCase();
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { slug: { [Op.like]: `%${search}%` } },
    ];
  }
  const rows = await SubscriptionPlan.findAll({
    where,
    order: [
      ['displayOrder', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });
  return Promise.all(rows.map((r) => decorate(r)));
}

async function adminGet(id, opts) {
  const row = await SubscriptionPlan.findByPk(id);
  if (!row) {
    const err = new Error('Subscription plan not found.');
    err.statusCode = 404;
    throw err;
  }
  return decorate(row, opts);
}

// --- Create / update ------------------------------------------------------

// Whitelisted column set so a malicious client can't set primary keys etc.
const WRITABLE_COLUMNS = new Set([
  'name',
  'slug',
  'shortDescription',
  'description',
  'planType',
  'visibility',
  'status',
  'displayOrder',
  'recommendedBadge',
  'featuredBadge',
  'currency',
  'monthlyEnabled',
  'monthlyPrice',
  'annualEnabled',
  'annualPrice',
  'annualDiscountPercent',
  'annualSavingsLabel',
  'commissionPercent',
  'commissionAppliesOn',
  'commissionOverrideAllowed',
  'caseManagementEnabled',
  'caseLimit',
  'unlimitedCases',
  'caseArchiveAllowed',
  'documentUploadAllowed',
  'storageLimitMb',
  'clientNotesAllowed',
  'caseTimelineAllowed',
  'taskManagementAllowed',
  'firmCreationAllowed',
  'firmLimit',
  'unlimitedFirms',
  'professionalsAllowed',
  'unlimitedProfessionals',
  'firmCaseLimit',
  'unlimitedFirmCases',
  'firmBrandingAllowed',
  'firmProfilePageAllowed',
  'firmAdminRoleAllowed',
  'teamManagementEnabled',
  'roleManagementAllowed',
  'staffAccessAllowed',
  'internalNotesAllowed',
  'supportType',
  'supportResponseTime',
  'supportTicketLimit',
  'priorityEscalation',
  'whatsappSupport',
  'callSupport',
  'featuredProfileAllowed',
  'featuredInSearch',
  'featuredOnHomepage',
  'priorityRanking',
  'priorityListing',
  'leadPriority',
  'customBrandingAllowed',
  'analyticsDashboardAllowed',
  'consultationBookingAllowed',
  'bookingCalendarAllowed',
  'escrowPaymentAllowed',
  'payoutRequestAllowed',
  'autoPayoutEligible',
  'manualAdminApprovalRequired',
  'cancellationRules',
  'refundRules',
  'rescheduleRules',
  'isCustomPlan',
  'customCtaLabel',
  'customCtaAction',
  'customCtaTarget',
  'gracePeriodDays',
  'autoDowngradePlanId',
  'renewalReminderDays',
  // Razorpay plan ids — admin pastes the rzp_plan_XXX id created in the
  // Razorpay dashboard for the monthly / annual price point.
  'razorpayPlanIdMonthly',
  'razorpayPlanIdAnnual',
]);

const PLAN_TYPES = new Set(['free', 'paid', 'custom']);
const VISIBILITIES = new Set(['public', 'private', 'hidden']);
const STATUSES = new Set(['active', 'inactive']);

function buildPatch(body = {}) {
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (!WRITABLE_COLUMNS.has(k)) continue;
    out[k] = v === '' ? null : v;
  }
  if (out.planType && !PLAN_TYPES.has(out.planType)) {
    throw {
      statusCode: 422,
      message: `planType must be one of ${[...PLAN_TYPES].join(', ')}`,
    };
  }
  if (out.visibility && !VISIBILITIES.has(out.visibility)) {
    throw {
      statusCode: 422,
      message: `visibility must be one of ${[...VISIBILITIES].join(', ')}`,
    };
  }
  if (out.status && !STATUSES.has(out.status)) {
    throw {
      statusCode: 422,
      message: `status must be one of ${[...STATUSES].join(', ')}`,
    };
  }
  return out;
}

async function adminCreate(body = {}) {
  const name = String(body.name || '').trim();
  if (!name) {
    throw { statusCode: 422, message: 'Plan name is required.' };
  }
  const slugBase = (body.slug && slugify(body.slug)) || slugify(name);
  const slug = await ensureUniqueSlug(slugBase);
  const patch = buildPatch(body);
  const plan = await SubscriptionPlan.create({ ...patch, name, slug });

  // Default feature rules — every plan gets one row per canonical key, all
  // disabled. Admin can flip them on / set limits in the editor.
  await SubscriptionFeatureRule.bulkCreate(
    FEATURE_KEYS.map(([key, label]) => ({
      subscriptionPlanId: plan.id,
      featureKey: key,
      featureName: label,
      isEnabled: false,
      limitValue: null,
      isUnlimited: false,
    }))
  );

  // Optional feature rules in the create payload (same shape as adminUpdate).
  if (Array.isArray(body.featureRules)) {
    await replaceFeatureRules(plan.id, body.featureRules);
  }
  return decorate(plan);
}

async function adminUpdate(id, body = {}) {
  const plan = await SubscriptionPlan.findByPk(id);
  if (!plan) {
    throw { statusCode: 404, message: 'Subscription plan not found.' };
  }
  const patch = buildPatch(body);
  // Slug change → re-uniqueify against own id.
  if (body.slug !== undefined) {
    const slugBase = slugify(body.slug) || slugify(body.name || plan.name);
    patch.slug = await ensureUniqueSlug(slugBase, plan.id);
  }
  await plan.update(patch);

  if (Array.isArray(body.featureRules)) {
    await replaceFeatureRules(plan.id, body.featureRules);
  }
  return decorate(plan);
}

// Idempotent feature-rule sync: incoming list overrides existing rows on
// (planId, featureKey) — non-listed keys keep their current values.
async function replaceFeatureRules(planId, rules) {
  for (const r of rules) {
    if (!r || !r.featureKey) continue;
    const existing = await SubscriptionFeatureRule.findOne({
      where: { subscriptionPlanId: planId, featureKey: r.featureKey },
    });
    const payload = {
      subscriptionPlanId: planId,
      featureKey: r.featureKey,
      featureName: r.featureName || FEATURE_NAME_BY_KEY[r.featureKey] || r.featureKey,
      isEnabled: r.isEnabled !== false,
      limitValue:
        r.limitValue === undefined || r.limitValue === '' ? null : r.limitValue,
      isUnlimited: r.isUnlimited === true,
    };
    if (existing) {
      await existing.update(payload);
    } else {
      await SubscriptionFeatureRule.create(payload);
    }
  }
}

// --- Status / duplicate / delete -----------------------------------------

async function adminSetStatus(id, status) {
  if (!STATUSES.has(status)) {
    throw {
      statusCode: 422,
      message: `status must be one of ${[...STATUSES].join(', ')}`,
    };
  }
  const plan = await SubscriptionPlan.findByPk(id);
  if (!plan) {
    throw { statusCode: 404, message: 'Subscription plan not found.' };
  }
  await plan.update({ status });
  return decorate(plan);
}

async function adminDuplicate(id) {
  const source = await SubscriptionPlan.findByPk(id);
  if (!source) {
    throw { statusCode: 404, message: 'Subscription plan not found.' };
  }
  const plain = source.get({ plain: true });
  delete plain.id;
  delete plain.createdAt;
  delete plain.updatedAt;
  const baseName = `${plain.name} (Copy)`;
  const newSlug = await ensureUniqueSlug(slugify(baseName));
  // Duplicates land as draft (`inactive`) so an accidental copy doesn't
  // appear on the public listing immediately.
  const created = await SubscriptionPlan.create({
    ...plain,
    name: baseName,
    slug: newSlug,
    status: 'inactive',
    recommendedBadge: false,
  });
  // Copy feature rules.
  const sourceRules = await SubscriptionFeatureRule.findAll({
    where: { subscriptionPlanId: source.id },
    raw: true,
  });
  if (sourceRules.length > 0) {
    await SubscriptionFeatureRule.bulkCreate(
      sourceRules.map((r) => ({
        subscriptionPlanId: created.id,
        featureKey: r.featureKey,
        featureName: r.featureName,
        isEnabled: r.isEnabled,
        limitValue: r.limitValue,
        isUnlimited: r.isUnlimited,
      }))
    );
  }
  return decorate(created);
}

async function adminDelete(id) {
  const plan = await SubscriptionPlan.findByPk(id);
  if (!plan) {
    throw { statusCode: 404, message: 'Subscription plan not found.' };
  }
  // Safety: refuse to delete a plan with active subscribers — that would
  // orphan their commission snapshots and access rules.
  const activeSubs = await ProfessionalSubscription.count({
    where: { subscriptionPlanId: plan.id, status: 'active' },
  });
  if (activeSubs > 0) {
    throw {
      statusCode: 409,
      message:
        `Cannot delete this plan — ${activeSubs} active subscriber(s) ` +
        'still reference it. Move them to another plan or wait for their ' +
        'subscription to end.',
    };
  }
  // Cascade: delete feature rules manually (no FK).
  await SubscriptionFeatureRule.destroy({
    where: { subscriptionPlanId: plan.id },
  });
  await plan.destroy();
  return { id };
}

// --- Subscribers ----------------------------------------------------------

async function adminListSubscribers(planId) {
  const decorated = await adminGet(planId, { withSubscribers: true });
  return decorated.subscribers || [];
}

// --- Public / professional surface ----------------------------------------

// Strip admin-only fields off a plan row for public consumption. We omit
// `autoDowngradePlanId` (an internal admin concept), the audit timestamps
// and any fields that don't make sense on the marketing-style plan card.
function publicView(plan) {
  if (!plan) return null;
  const row = plan.get ? plan.get({ plain: true }) : plan;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription,
    description: row.description,
    planType: row.planType,
    visibility: row.visibility,
    status: row.status,
    displayOrder: row.displayOrder,
    recommendedBadge: row.recommendedBadge,
    featuredBadge: row.featuredBadge,
    currency: row.currency,
    monthlyEnabled: row.monthlyEnabled,
    monthlyPrice: row.monthlyPrice,
    annualEnabled: row.annualEnabled,
    annualPrice: row.annualPrice,
    annualDiscountPercent: row.annualDiscountPercent,
    annualSavingsLabel: row.annualSavingsLabel,
    commissionPercent: row.commissionPercent,
    caseLimit: row.caseLimit,
    unlimitedCases: row.unlimitedCases,
    storageLimitMb: row.storageLimitMb,
    firmCreationAllowed: row.firmCreationAllowed,
    firmLimit: row.firmLimit,
    unlimitedFirms: row.unlimitedFirms,
    professionalsAllowed: row.professionalsAllowed,
    unlimitedProfessionals: row.unlimitedProfessionals,
    firmCaseLimit: row.firmCaseLimit,
    unlimitedFirmCases: row.unlimitedFirmCases,
    featuredProfileAllowed: row.featuredProfileAllowed,
    priorityListing: row.priorityListing,
    supportType: row.supportType,
    supportResponseTime: row.supportResponseTime,
    whatsappSupport: row.whatsappSupport,
    callSupport: row.callSupport,
    customBrandingAllowed: row.customBrandingAllowed,
    analyticsDashboardAllowed: row.analyticsDashboardAllowed,
    teamManagementEnabled: row.teamManagementEnabled,
    isCustomPlan: row.isCustomPlan,
    customCtaLabel: row.customCtaLabel,
    customCtaAction: row.customCtaAction,
    customCtaTarget: row.customCtaTarget,
  };
}

/**
 * List every plan that should appear on the professional-facing
 * `/dashboard/professional/subscription` page. Filters to status='active'
 * + visibility='public' so admin-only / private tiers stay hidden.
 */
async function listPublicPlans() {
  const rows = await SubscriptionPlan.findAll({
    where: { status: 'active', visibility: 'public' },
    order: [
      ['displayOrder', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });
  return rows.map(publicView);
}

/**
 * Resolve the active subscription for a given user. Always returns the
 * MOST RECENT row matching status='active' so callers can rely on a
 * single canonical "current" subscription.
 *
 * Returns null when the user has no active subscription on record.
 */
async function getActiveSubscriptionForUser(userId) {
  if (!userId) return null;
  // Prefer an active subscription, but fall back to a pending one so the
  // dashboard surfaces "payment authorised, awaiting activation" state
  // instead of "No active plan" — common while the Razorpay webhook is
  // still in flight (or unreachable on localhost).
  let sub = await ProfessionalSubscription.findOne({
    where: { userId, status: 'active' },
    order: [['startDate', 'DESC']],
  });
  if (!sub) {
    sub = await ProfessionalSubscription.findOne({
      where: { userId, status: 'pending' },
      order: [['startDate', 'DESC']],
    });
  }
  if (!sub) return null;

  // Self-heal: if the row is still 'pending' but Razorpay says the
  // subscription is already 'active' / 'authenticated', refresh our
  // mirror so the dashboard doesn't get stuck behind a missed webhook.
  if (sub.status === 'pending' && sub.razorpaySubscriptionId) {
    try {
      const sr = require('./subscriptionRazorpayService');
      const rzpSub = await sr.fetchSubscription(sub.razorpaySubscriptionId);
      if (rzpSub) {
        const mapped = sr.mapRazorpayStatusToInternal(rzpSub.status);
        if (mapped && mapped !== sub.status) {
          await sub.update({
            status: mapped,
            paymentStatus: mapped === 'active' ? 'paid' : sub.paymentStatus,
            razorpaySubscriptionStatus: rzpSub.status || sub.razorpaySubscriptionStatus,
          });
          // Re-read so the response reflects the patched values.
          sub = await ProfessionalSubscription.findByPk(sub.id);
        }
      }
    } catch (err) {
      console.warn(
        `[subscriptionService] self-heal fetchSubscription failed: ${err.message || err}`
      );
    }
  }

  const plain = sub.get({ plain: true });
  // Decorate with the plan it points to so the dashboard can render a
  // single payload.
  if (plain.subscriptionPlanId) {
    const plan = await SubscriptionPlan.findByPk(plain.subscriptionPlanId);
    plain.plan = publicView(plan);
  }
  return plain;
}

/**
 * Switch a user to a different plan.
 *
 * Free plans: instant switch — previous active sub cancelled, new one
 * created with paymentStatus='free' and status='active'. No Razorpay call.
 *
 * Paid plans: a Razorpay subscription is created (sub_xxx). The local
 * ProfessionalSubscription row is recorded with status='pending' and
 * paymentStatus='pending'. The frontend opens Razorpay Checkout against
 * the returned subscription_id; the subscription.activated webhook flips
 * the row to status='active' once the mandate goes through.
 *
 * Custom plans are rejected — they must go via the support CTA.
 */
async function upgradeSubscription(userId, { planSlug, billingCycle = 'monthly' }) {
  if (!userId) {
    throw { statusCode: 401, message: 'Not authenticated.' };
  }
  const plan = await SubscriptionPlan.findOne({ where: { slug: planSlug } });
  if (!plan) {
    throw { statusCode: 404, message: 'Plan not found.' };
  }
  if (plan.status !== 'active' || plan.visibility !== 'public') {
    throw {
      statusCode: 400,
      message: 'This plan is not available for subscription.',
    };
  }
  if (plan.isCustomPlan || plan.planType === 'custom') {
    throw {
      statusCode: 400,
      message:
        'Custom plans cannot be self-served. Please use the support CTA on the plan card.',
      code: 'CUSTOM_PLAN_REQUIRES_SUPPORT',
    };
  }

  // No-op when the user already has a LIVE subscription on this exact
  // plan + cycle. (We deliberately match against status active|pending so
  // a half-finished Razorpay mandate isn't duplicated on a retry.)
  const liveOnPlan = await ProfessionalSubscription.findOne({
    where: {
      userId,
      subscriptionPlanId: plan.id,
      billingCycle,
      status: { [Op.in]: ['active', 'pending'] },
    },
    order: [['startDate', 'DESC']],
  });
  if (liveOnPlan) {
    const plain = liveOnPlan.get({ plain: true });
    plain.plan = publicView(plan);
    return plain;
  }

  // Cancel any previous active/pending sub so we never have two live rows.
  const previous = await ProfessionalSubscription.findOne({
    where: { userId, status: { [Op.in]: ['active', 'pending'] } },
    order: [['startDate', 'DESC']],
  });
  if (previous) {
    // If a Razorpay subscription is attached, cancel it too. Downgrading
    // to a free plan cancels IMMEDIATELY (the user wanted off the paid
    // plan — keep no recurring mandate alive). Switching between paid
    // plans cancels at cycle end so the user isn't double-billed for
    // the rest of their already-paid period.
    if (previous.razorpaySubscriptionId) {
      const atCycleEnd = plan.planType !== 'free';
      try {
        const sr = require('./subscriptionRazorpayService');
        await sr.cancelSubscription(previous.razorpaySubscriptionId, {
          atCycleEnd,
        });
      } catch (err) {
        // Don't block the switch if Razorpay refuses — log + continue.
        console.warn(
          `[subscriptionService] previous Razorpay sub cancel failed: ${err.message || err}`
        );
      }
    }
    await previous.update({
      status: 'cancelled',
      cancelledAt: new Date(),
      razorpaySubscriptionStatus: previous.razorpaySubscriptionId
        ? 'cancelled'
        : previous.razorpaySubscriptionStatus,
    });
  }

  // Derive billing window end-date. Free plans have no expiry. Paid plans
  // expire one month / one year from now (server-side bookkeeping; the
  // authoritative dates come from Razorpay webhook subscription.charged).
  let endDate = null;
  const start = new Date();
  if (plan.planType === 'paid') {
    endDate = new Date(start);
    if (billingCycle === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
  }

  const amount =
    plan.planType === 'free'
      ? 0
      : billingCycle === 'annual'
        ? plan.annualPrice
        : plan.monthlyPrice;

  // For free plans: we're done — just create the active row.
  if (plan.planType === 'free') {
    const created = await ProfessionalSubscription.create({
      userId,
      subscriptionPlanId: plan.id,
      billingCycle,
      startDate: start,
      endDate,
      status: 'active',
      amountPaid: 0,
      currency: plan.currency || 'INR',
      commissionPercentSnapshot: plan.commissionPercent || 0,
      paymentStatus: 'free',
      autoRenew: false,
      adminNotes: 'Free plan — no Razorpay subscription required.',
    });
    const plain = created.get({ plain: true });
    plain.plan = publicView(plan);
    return plain;
  }

  // Paid plan path — create the Razorpay subscription first so we can
  // store its id on the local row.
  const sr = require('./subscriptionRazorpayService');
  const { subscription, customerId } = await sr.createSubscription({
    userId,
    plan,
    billingCycle,
  });

  const created = await ProfessionalSubscription.create({
    userId,
    subscriptionPlanId: plan.id,
    billingCycle,
    startDate: start,
    endDate,
    // Stay in 'pending' until the subscription.activated webhook fires.
    status: 'pending',
    amountPaid: 0, // first charge hasn't happened yet
    currency: plan.currency || 'INR',
    commissionPercentSnapshot: plan.commissionPercent || 0,
    paymentStatus: 'pending',
    autoRenew: true,
    razorpaySubscriptionId: subscription.id,
    razorpayCustomerId: customerId,
    razorpaySubscriptionStatus: subscription.status || 'created',
    razorpayShortUrl: subscription.short_url || null,
    adminNotes: `Awaiting Razorpay subscription activation (${subscription.id}).`,
  });
  const plain = created.get({ plain: true });
  plain.plan = publicView(plan);
  // Expose the checkout-relevant fields so the frontend can open
  // Razorpay Checkout right away.
  plain.razorpay = {
    subscriptionId: subscription.id,
    customerId,
    shortUrl: subscription.short_url || null,
    status: subscription.status || 'created',
    amount,
    currency: plan.currency || 'INR',
  };
  return plain;
}

/**
 * Build a usage snapshot for the logged-in user against their active
 * subscription's limits. Returns null when the user has no subscription.
 *
 * Shape:
 *   {
 *     planName, planSlug,
 *     cases:        { used, limit, remaining, unlimited },
 *     firms:        { used, limit, remaining, unlimited, allowed },
 *     // Set only when the user owns / co-owns a firm.
 *     firmCases:    { used, limit, remaining, unlimited, firmId },
 *     firmMembers:  { used, limit, remaining, unlimited, firmId },
 *   }
 *
 * "Used" for cases/firmCases is the non-closed count, matching the gate.
 */
async function getUsageForUser(userId) {
  if (!userId) return null;
  // Lazy require to avoid a circular import at module-load time.
  const gates = require('./subscriptionGateService');
  const ctx = await gates.loadContext(userId);
  if (!ctx) return null;
  const { plan } = ctx;

  const { Case, FirmMember, LawFirm } = require('../models');
  // Cases / FirmMember rows key off the legacy professional id, not the
  // user id. Pull it from the context loaded by the gate service.
  const professionalId = ctx.professionalId;

  // Assignee-count categorisation — same rule the gate uses. Single
  // assignee = individual case; 2+ = firm case. Closed cases ARE counted.
  const SINGLE_ASSIGNEE = sequelize.literal(
    'COALESCE(JSON_LENGTH(`professionalIds`), 1) <= 1'
  );
  const MULTI_ASSIGNEE = sequelize.literal(
    'COALESCE(JSON_LENGTH(`professionalIds`), 1) >= 2'
  );

  // --- Individual cases owned by the user (single assignee, all statuses).
  const caseCount = professionalId
    ? await Case.count({
        where: {
          professionalId,
          [Op.and]: [SINGLE_ASSIGNEE],
        },
      })
    : 0;
  const caseLimit = plan.unlimitedCases ? null : plan.caseLimit;
  const caseRemaining =
    plan.unlimitedCases || caseLimit === null
      ? null
      : Math.max(0, caseLimit - caseCount);

  // --- Firms owned by the user. Count via FirmMember roster (legacy id
  // primary) AND LawFirm.ownerUserId (covers fresh firms not yet on the
  // roster). Use the max so we don't undercount.
  const [memberCount, lawFirmCount] = await Promise.all([
    professionalId
      ? FirmMember.count({
          where: {
            professionalId,
            role: { [Op.in]: ['OWNER', 'ADMIN', 'owner', 'admin'] },
          },
        })
      : 0,
    LawFirm.count({ where: { ownerUserId: userId } }),
  ]);
  const firmOwnerships = Math.max(memberCount, lawFirmCount);
  const firmLimit = plan.unlimitedFirms ? null : plan.firmLimit;
  const firmRemaining =
    !plan.firmCreationAllowed
      ? 0
      : plan.unlimitedFirms || firmLimit === null
        ? null
        : Math.max(0, firmLimit - firmOwnerships);

  // --- Firm-scoped quotas: populated when the user is the firm OWNER OR
  // a CO-OWNER. Quotas are read from the OWNER's plan (the owner pays for
  // the plan; co-owners just inherit the cap).
  let firmCases = null;
  let firmMembers = null;
  // Strategy:
  //  1. Try LawFirm.ownerUserId = userId (caller is the owner).
  //  2. Fall back to a FirmMember roster lookup for owner/co-owner/admin
  //     roles — needed for co-owners since they don't have ownerUserId.
  let ownedFirm = await LawFirm.findOne({
    where: { ownerUserId: userId },
    raw: true,
  });
  if (!ownedFirm && professionalId) {
    const ownedRow = await FirmMember.findOne({
      where: {
        professionalId,
        // Include 'co-owner' so co-owners see the same quota panel as the
        // owner. Members / regular pros do not match.
        role: {
          [Op.in]: [
            'OWNER',
            'ADMIN',
            'owner',
            'admin',
            'CO-OWNER',
            'co-owner',
            'coOwner',
          ],
        },
      },
      order: [['createdAt', 'ASC']],
      raw: true,
    });
    if (ownedRow && ownedRow.firmId) {
      ownedFirm = await LawFirm.findByPk(ownedRow.firmId, { raw: true });
    }
  }
  if (ownedFirm && ownedFirm.id) {
    const firmId = ownedFirm.id;
    // Resolve the OWNER's plan — quotas always come from the owner who
    // pays for the subscription, not the caller. For the actual owner
    // this is `plan` from ctx. For a co-owner we have to load the
    // owner's context separately.
    let quotaPlan = plan;
    if (ownedFirm.ownerUserId && ownedFirm.ownerUserId !== userId) {
      const ownerCtx = await gates.loadContext(ownedFirm.ownerUserId);
      if (ownerCtx && ownerCtx.plan) quotaPlan = ownerCtx.plan;
    }

    // Per spec: a case counts as a firm case when 2+ pros are assigned
    // AND at least one assignee is a firm member. Closed cases counted.
    const fcCount = await gates.countFirmCases(firmId);
    const fcLimit = quotaPlan.unlimitedFirmCases
      ? null
      : quotaPlan.firmCaseLimit;
    firmCases = {
      firmId,
      // Surface the OWNER's plan name explicitly — co-owners may be on a
      // different personal plan, but the firm-scoped quota comes from
      // the firm's payer.
      planName: quotaPlan.name,
      used: fcCount,
      limit: fcLimit,
      remaining:
        quotaPlan.unlimitedFirmCases || fcLimit === null
          ? null
          : Math.max(0, fcLimit - fcCount),
      unlimited: !!quotaPlan.unlimitedFirmCases,
    };
    // Exclude the firm owner from the count — quotas are on additional
    // professionals, not on the owner who pays for the plan.
    const fmCount = await FirmMember.count({
      where: {
        firmId,
        status: { [Op.ne]: 'inactive' },
        role: { [Op.notIn]: ['owner', 'OWNER'] },
      },
    });
    const fmLimit = quotaPlan.unlimitedProfessionals
      ? null
      : quotaPlan.professionalsAllowed;
    firmMembers = {
      firmId,
      planName: quotaPlan.name,
      used: fmCount,
      limit: fmLimit,
      remaining:
        quotaPlan.unlimitedProfessionals || fmLimit === null
          ? null
          : Math.max(0, fmLimit - fmCount),
      unlimited: !!quotaPlan.unlimitedProfessionals,
    };
  }

  return {
    planName: plan.name,
    planSlug: plan.slug,
    cases: {
      used: caseCount,
      limit: caseLimit,
      remaining: caseRemaining,
      unlimited: !!plan.unlimitedCases,
    },
    firms: {
      used: firmOwnerships,
      limit: firmLimit,
      remaining: firmRemaining,
      unlimited: !!plan.unlimitedFirms,
      allowed: !!plan.firmCreationAllowed,
    },
    firmCases,
    firmMembers,
  };
}

/**
 * Verify the Razorpay signature returned by the subscription Checkout
 * handler callback and flip the local ProfessionalSubscription to
 * 'active' immediately — so the dashboard doesn't have to wait for the
 * webhook (which can be slow, or unreachable on localhost). Also
 * records a SubscriptionPayment row so the charge appears in the
 * professional's payment history.
 *
 * Idempotent: re-posting the same payment id is a no-op once the row
 * is recorded.
 *
 * Signature format per Razorpay docs:
 *   HMAC-SHA256(razorpay_payment_id + '|' + razorpay_subscription_id,
 *               key_secret)
 */
async function confirmSubscriptionPayment(userId, {
  razorpay_payment_id,
  razorpay_subscription_id,
  razorpay_signature,
}) {
  if (!userId) throw { statusCode: 401, message: 'Not authenticated.' };
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    throw {
      statusCode: 400,
      message:
        'razorpay_payment_id, razorpay_subscription_id and razorpay_signature are required.',
    };
  }

  const sub = await ProfessionalSubscription.findOne({
    where: { razorpaySubscriptionId: razorpay_subscription_id },
  });
  if (!sub) {
    throw {
      statusCode: 404,
      message: 'No local subscription matches this Razorpay subscription id.',
    };
  }
  if (sub.userId !== userId) {
    throw {
      statusCode: 403,
      message: 'You cannot confirm a subscription that is not yours.',
    };
  }

  const paymentsService = require('./paymentsService');
  const { keySecret } = await paymentsService.resolveRazorpayCreds();
  if (!keySecret) {
    throw {
      statusCode: 500,
      message: 'Razorpay is not configured on the server.',
    };
  }
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest('hex');
  if (expected !== razorpay_signature) {
    throw {
      statusCode: 400,
      message: 'Subscription payment signature verification failed.',
    };
  }

  const plan = await SubscriptionPlan.findByPk(sub.subscriptionPlanId);

  // Record the payment row. Idempotent against (subscriptionId, transactionId).
  let payment = await SubscriptionPayment.findOne({
    where: {
      subscriptionId: sub.id,
      transactionId: razorpay_payment_id,
    },
  });
  if (!payment) {
    // Try to read the Razorpay payment for an authoritative amount; fall
    // back to the plan's monthly/annual price when the fetch fails.
    let paidRupees = 0;
    let rawPayment = null;
    try {
      const rzp = await paymentsService.razorpay();
      rawPayment = await rzp.payments.fetch(razorpay_payment_id);
      if (rawPayment && rawPayment.amount) {
        paidRupees = Number(rawPayment.amount) / 100;
      }
    } catch (err) {
      console.warn(
        `[subscriptionService] payment fetch failed for ${razorpay_payment_id}: ${err.message || err}`
      );
    }
    if (!paidRupees && plan) {
      paidRupees =
        sub.billingCycle === 'annual'
          ? Number(plan.annualPrice || 0)
          : Number(plan.monthlyPrice || 0);
    }
    payment = await SubscriptionPayment.create({
      userId: sub.userId,
      subscriptionId: sub.id,
      subscriptionPlanId: sub.subscriptionPlanId,
      billingCycle: sub.billingCycle,
      amount: paidRupees,
      currency: sub.currency || 'INR',
      totalAmount: paidRupees,
      paymentGateway: 'razorpay',
      transactionId: razorpay_payment_id,
      gatewaySignature: razorpay_signature,
      paymentStatus: 'paid',
      paymentDate: new Date(),
      gatewayPayload: rawPayment || null,
    });
  }

  // Flip the local subscription to active so the dashboard updates
  // immediately. The webhook still runs separately and is idempotent.
  if (sub.status !== 'active' || sub.paymentStatus !== 'paid') {
    const patch = {
      status: 'active',
      paymentStatus: 'paid',
      transactionId: razorpay_payment_id,
      razorpaySubscriptionStatus: 'active',
    };
    if (plan && plan.commissionPercent !== null && plan.commissionPercent !== undefined) {
      patch.commissionPercentSnapshot = plan.commissionPercent;
    }
    await sub.update(patch);
  }

  const fresh = await ProfessionalSubscription.findByPk(sub.id);
  const plain = fresh.get({ plain: true });
  plain.plan = publicView(plan);
  return {
    subscription: plain,
    payment: payment.get({ plain: true }),
  };
}

/**
 * Admin-only: grant a user a subscription manually for a specific time
 * period without going through Razorpay. Used for comp accounts, support
 * cases, manual offline payments, beta access, etc.
 *
 * Cancels any existing active / pending subscription first (including
 * any attached Razorpay sub — at cycle end for paid downgrades, but
 * immediately when the admin is overriding state). The new row is
 * recorded with paymentStatus='manual' so reconciliation can tell the
 * difference between a real Razorpay-paid charge and an admin grant.
 */
async function adminActivateSubscription({
  targetUserId,
  planSlug,
  planId,
  billingCycle = 'monthly',
  endDate, // ISO string OR Date
  amountPaid = null,
  adminNotes = '',
  actingUserId,
}) {
  if (!targetUserId) {
    throw { statusCode: 400, message: 'targetUserId is required.' };
  }
  const target = await User.findByPk(targetUserId);
  if (!target) {
    throw { statusCode: 404, message: 'User not found.' };
  }

  // Resolve the plan by id OR slug — admin form passes whichever it has.
  let plan = null;
  if (planId) plan = await SubscriptionPlan.findByPk(planId);
  if (!plan && planSlug) {
    plan = await SubscriptionPlan.findOne({ where: { slug: planSlug } });
  }
  if (!plan) {
    throw { statusCode: 404, message: 'Subscription plan not found.' };
  }
  if (plan.status !== 'active') {
    throw {
      statusCode: 400,
      message: 'This plan is inactive — re-activate it before granting it.',
    };
  }

  if (!['monthly', 'annual', 'lifetime', 'custom'].includes(billingCycle)) {
    throw {
      statusCode: 422,
      message:
        'billingCycle must be one of: monthly, annual, lifetime, custom.',
    };
  }

  // Parse + validate the end date. Free plans accept null. Paid plans
  // can have an explicit end date OR fall back to one cycle from now.
  let parsedEnd = null;
  if (endDate) {
    parsedEnd = new Date(endDate);
    if (Number.isNaN(parsedEnd.getTime())) {
      throw { statusCode: 422, message: 'endDate is not a valid date.' };
    }
  } else if (plan.planType !== 'free' && billingCycle !== 'lifetime') {
    parsedEnd = new Date();
    if (billingCycle === 'annual') {
      parsedEnd.setFullYear(parsedEnd.getFullYear() + 1);
    } else {
      parsedEnd.setMonth(parsedEnd.getMonth() + 1);
    }
  }

  // Cancel any prior active / pending subscription. Razorpay-attached
  // subs are also cancelled (immediately — the admin is taking control).
  const previous = await ProfessionalSubscription.findOne({
    where: { userId: targetUserId, status: { [Op.in]: ['active', 'pending'] } },
    order: [['startDate', 'DESC']],
  });
  if (previous) {
    if (previous.razorpaySubscriptionId) {
      try {
        const sr = require('./subscriptionRazorpayService');
        await sr.cancelSubscription(previous.razorpaySubscriptionId, {
          atCycleEnd: false,
        });
      } catch (err) {
        console.warn(
          `[subscriptionService] admin grant: prior Razorpay cancel failed: ${err.message || err}`
        );
      }
    }
    await previous.update({
      status: 'cancelled',
      cancelledAt: new Date(),
      razorpaySubscriptionStatus: previous.razorpaySubscriptionId
        ? 'cancelled'
        : previous.razorpaySubscriptionStatus,
    });
  }

  // Default amount — keep the admin's number when provided, otherwise
  // mirror the plan's listed price for the chosen cycle (handy for
  // reporting). amountPaid=0 means "comp / no charge".
  let amount = amountPaid;
  if (amount === null || amount === undefined || amount === '') {
    if (plan.planType === 'free') {
      amount = 0;
    } else if (billingCycle === 'annual') {
      amount = Number(plan.annualPrice || 0);
    } else {
      amount = Number(plan.monthlyPrice || 0);
    }
  }

  const created = await ProfessionalSubscription.create({
    userId: targetUserId,
    subscriptionPlanId: plan.id,
    billingCycle,
    startDate: new Date(),
    endDate: parsedEnd,
    status: 'active',
    amountPaid: amount,
    currency: plan.currency || 'INR',
    commissionPercentSnapshot: plan.commissionPercent || 0,
    paymentStatus: plan.planType === 'free' ? 'free' : 'manual',
    autoRenew: false, // admin grants do NOT auto-renew
    adminNotes:
      adminNotes ||
      `Manually activated by admin${actingUserId ? ` ${actingUserId}` : ''} on ${new Date().toISOString()}.`,
  });

  const plain = created.get({ plain: true });
  plain.plan = publicView(plan);
  return plain;
}

/**
 * Subscription payments for a single user — used by the professional
 * payment history page so subscription charges appear alongside booking
 * payments.
 */
async function listSubscriptionPaymentsForUser(userId) {
  if (!userId) return [];
  const rows = await SubscriptionPayment.findAll({
    where: { userId },
    order: [['paymentDate', 'DESC'], ['createdAt', 'DESC']],
    limit: 100,
    raw: true,
  });
  if (!rows.length) return [];
  const planIds = [...new Set(rows.map((r) => r.subscriptionPlanId).filter(Boolean))];
  const plans = planIds.length
    ? await SubscriptionPlan.findAll({
        where: { id: { [Op.in]: planIds } },
        attributes: ['id', 'name', 'slug'],
        raw: true,
      })
    : [];
  const planById = new Map(plans.map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    plan: r.subscriptionPlanId ? planById.get(r.subscriptionPlanId) || null : null,
  }));
}

module.exports = {
  FEATURE_KEYS,
  FEATURE_NAME_BY_KEY,
  adminList,
  adminGet,
  adminCreate,
  adminUpdate,
  adminSetStatus,
  adminDuplicate,
  adminDelete,
  adminListSubscribers,
  // Public / professional surface
  listPublicPlans,
  getActiveSubscriptionForUser,
  upgradeSubscription,
  confirmSubscriptionPayment,
  listSubscriptionPaymentsForUser,
  adminActivateSubscription,
  getUsageForUser,
};

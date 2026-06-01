// One-shot seeder for the subscription management module.
//
// Creates the four default plans described in the spec (Starter, Premium,
// Team, Custom), their per-feature rule rows, and back-fills every existing
// professional with an active Starter-plan subscription so the rest of the
// platform can read `users.activeSubscription` without a null check.
//
// Idempotent — re-running skips any plan whose slug already exists, only
// creates feature rules that are missing, and only assigns a Starter
// subscription to professionals who don't already have an active one.
//
// Usage (from backend/):  node src/scripts/seedSubscriptionPlans.js

require('dotenv').config();

const {
  SubscriptionPlan,
  SubscriptionFeatureRule,
  ProfessionalSubscription,
  User,
  sequelize,
} = require('../models');
const { Op } = require('sequelize');

// --- Feature key registry (spec §20) -------------------------------------
// Single source of truth for the canonical feature_key strings. Per-plan
// values below reference these.
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

// --- Plan definitions ----------------------------------------------------
// `featureRules` is a map of feature_key -> { isEnabled, limitValue, isUnlimited }.
// `topLevel` is the full set of SubscriptionPlan columns.
const PLANS = [
  {
    slug: 'starter',
    topLevel: {
      name: 'Starter Plan',
      shortDescription: 'Free plan for individual professionals starting on the platform.',
      description:
        'Best for individual professionals starting on the platform. Includes basic profile, ' +
        'consultation bookings with escrow payments, up to 5 active cases, and a single firm. ' +
        '10% platform commission per transaction.',
      planType: 'free',
      visibility: 'public',
      status: 'active',
      displayOrder: 10,
      currency: 'INR',
      monthlyEnabled: true,
      monthlyPrice: 0,
      annualEnabled: false,
      annualPrice: null,
      commissionPercent: 10,
      commissionAppliesOn: 'all',
      caseManagementEnabled: true,
      caseLimit: 5,
      unlimitedCases: false,
      documentUploadAllowed: true,
      storageLimitMb: 200,
      taskManagementAllowed: false,
      firmCreationAllowed: true,
      firmLimit: 1,
      professionalsAllowed: 1,
      firmCaseLimit: 5,
      firmBrandingAllowed: false,
      firmProfilePageAllowed: true,
      firmAdminRoleAllowed: false,
      teamManagementEnabled: false,
      supportType: 'basic',
      supportResponseTime: '2 business days',
      featuredProfileAllowed: false,
      priorityListing: false,
      consultationBookingAllowed: true,
      escrowPaymentAllowed: true,
      payoutRequestAllowed: true,
      autoPayoutEligible: false,
      gracePeriodDays: 0,
      renewalReminderDays: 0,
    },
    featureRules: {
      consultation_booking: { isEnabled: true },
      escrow_payment: { isEnabled: true },
      payout_request: { isEnabled: true },
      case_management: { isEnabled: true },
      case_limit: { isEnabled: true, limitValue: 5, isUnlimited: false },
      firm_creation: { isEnabled: true, limitValue: 1 },
      firm_limit: { isEnabled: true, limitValue: 1 },
      firm_professional_limit: { isEnabled: true, limitValue: 1 },
      firm_case_limit: { isEnabled: true, limitValue: 5 },
      team_management: { isEnabled: false },
      document_upload: { isEnabled: true },
      client_management: { isEnabled: true },
      calendar_management: { isEnabled: true },
      invoice_generation: { isEnabled: true },
      priority_support: { isEnabled: false },
      whatsapp_support: { isEnabled: false },
      featured_profile: { isEnabled: false },
      priority_listing: { isEnabled: false },
      ai_features: { isEnabled: false },
      custom_branding: { isEnabled: false },
      analytics_dashboard: { isEnabled: false },
    },
  },
  {
    slug: 'premium',
    topLevel: {
      name: 'Premium Plan',
      shortDescription: 'Lower commission, featured visibility and unlimited case management.',
      description:
        'For active professionals and firms who want more visibility and advanced case ' +
        'management. Unlimited cases and firm professionals, featured listing, priority ' +
        'support, and a reduced 5% platform commission.',
      planType: 'paid',
      visibility: 'public',
      status: 'active',
      displayOrder: 20,
      recommendedBadge: true,
      currency: 'INR',
      monthlyEnabled: true,
      monthlyPrice: 999,
      annualEnabled: true,
      annualPrice: 9999,
      annualDiscountPercent: 16,
      annualSavingsLabel: 'Save 2 months',
      commissionPercent: 5,
      commissionAppliesOn: 'all',
      caseManagementEnabled: true,
      caseLimit: null,
      unlimitedCases: true,
      documentUploadAllowed: true,
      storageLimitMb: 10240,
      taskManagementAllowed: true,
      firmCreationAllowed: true,
      firmLimit: null,
      unlimitedFirms: false,
      professionalsAllowed: null,
      unlimitedProfessionals: true,
      firmCaseLimit: null,
      unlimitedFirmCases: true,
      firmBrandingAllowed: true,
      firmProfilePageAllowed: true,
      firmAdminRoleAllowed: true,
      teamManagementEnabled: true,
      roleManagementAllowed: true,
      staffAccessAllowed: true,
      internalNotesAllowed: true,
      supportType: 'priority',
      supportResponseTime: '4 business hours',
      priorityEscalation: true,
      whatsappSupport: true,
      featuredProfileAllowed: true,
      featuredInSearch: true,
      featuredOnHomepage: true,
      priorityRanking: true,
      priorityListing: true,
      leadPriority: true,
      customBrandingAllowed: true,
      analyticsDashboardAllowed: true,
      consultationBookingAllowed: true,
      escrowPaymentAllowed: true,
      payoutRequestAllowed: true,
      autoPayoutEligible: true,
      gracePeriodDays: 7,
      renewalReminderDays: 7,
    },
    featureRules: {
      consultation_booking: { isEnabled: true },
      escrow_payment: { isEnabled: true },
      payout_request: { isEnabled: true },
      case_management: { isEnabled: true },
      case_limit: { isEnabled: true, limitValue: null, isUnlimited: true },
      firm_creation: { isEnabled: true, isUnlimited: true },
      firm_limit: { isEnabled: true, isUnlimited: true },
      firm_professional_limit: { isEnabled: true, isUnlimited: true },
      firm_case_limit: { isEnabled: true, isUnlimited: true },
      team_management: { isEnabled: true, isUnlimited: true },
      document_upload: { isEnabled: true },
      client_management: { isEnabled: true },
      calendar_management: { isEnabled: true },
      invoice_generation: { isEnabled: true },
      priority_support: { isEnabled: true },
      whatsapp_support: { isEnabled: true },
      featured_profile: { isEnabled: true },
      priority_listing: { isEnabled: true },
      ai_features: { isEnabled: true },
      custom_branding: { isEnabled: true },
      analytics_dashboard: { isEnabled: true },
    },
  },
  {
    slug: 'team',
    topLevel: {
      name: 'Team Plan',
      shortDescription: 'Firm-based plan for small and mid-size professional firms.',
      description:
        'Designed for small and mid-size professional firms. Multiple professionals, ' +
        'role-based access, shared calendar, team dashboard and internal notes. Pricing ' +
        'and commission are admin-configurable.',
      planType: 'paid',
      visibility: 'public',
      status: 'active',
      displayOrder: 30,
      currency: 'INR',
      monthlyEnabled: true,
      monthlyPrice: 2499,
      annualEnabled: true,
      annualPrice: 24999,
      annualDiscountPercent: 16,
      commissionPercent: 7,
      commissionAppliesOn: 'all',
      caseManagementEnabled: true,
      caseLimit: 200,
      unlimitedCases: false,
      taskManagementAllowed: true,
      documentUploadAllowed: true,
      storageLimitMb: 51200,
      firmCreationAllowed: true,
      firmLimit: 3,
      professionalsAllowed: 10,
      firmCaseLimit: 500,
      firmBrandingAllowed: true,
      firmProfilePageAllowed: true,
      firmAdminRoleAllowed: true,
      teamManagementEnabled: true,
      roleManagementAllowed: true,
      staffAccessAllowed: true,
      internalNotesAllowed: true,
      supportType: 'priority',
      supportResponseTime: '4 business hours',
      whatsappSupport: true,
      featuredProfileAllowed: true,
      featuredInSearch: true,
      priorityRanking: true,
      priorityListing: true,
      leadPriority: true,
      analyticsDashboardAllowed: true,
      consultationBookingAllowed: true,
      escrowPaymentAllowed: true,
      payoutRequestAllowed: true,
      autoPayoutEligible: true,
      gracePeriodDays: 7,
      renewalReminderDays: 14,
    },
    featureRules: {
      consultation_booking: { isEnabled: true },
      escrow_payment: { isEnabled: true },
      payout_request: { isEnabled: true },
      case_management: { isEnabled: true },
      case_limit: { isEnabled: true, limitValue: 200 },
      firm_creation: { isEnabled: true, limitValue: 3 },
      firm_limit: { isEnabled: true, limitValue: 3 },
      firm_professional_limit: { isEnabled: true, limitValue: 10 },
      firm_case_limit: { isEnabled: true, limitValue: 500 },
      team_management: { isEnabled: true, limitValue: 10 },
      document_upload: { isEnabled: true },
      client_management: { isEnabled: true },
      calendar_management: { isEnabled: true },
      invoice_generation: { isEnabled: true },
      priority_support: { isEnabled: true },
      whatsapp_support: { isEnabled: true },
      featured_profile: { isEnabled: true },
      priority_listing: { isEnabled: true },
      ai_features: { isEnabled: false },
      custom_branding: { isEnabled: true },
      analytics_dashboard: { isEnabled: true },
    },
  },
  {
    slug: 'custom',
    topLevel: {
      name: 'Custom Plan',
      shortDescription: 'Enterprise plan with bespoke pricing, commission and limits.',
      description:
        'For enterprise customers needing custom pricing, dedicated onboarding, custom ' +
        'commission terms and a named account manager. Click "Discuss with Support" to ' +
        'start a conversation.',
      planType: 'custom',
      visibility: 'public',
      status: 'active',
      displayOrder: 40,
      featuredBadge: true,
      currency: 'INR',
      // Display-only — the custom CTA replaces the buy button.
      monthlyEnabled: false,
      monthlyPrice: 0,
      annualEnabled: false,
      commissionPercent: 0, // admin overrides per contract
      commissionOverrideAllowed: true,
      caseManagementEnabled: true,
      caseLimit: null,
      unlimitedCases: true,
      taskManagementAllowed: true,
      documentUploadAllowed: true,
      firmCreationAllowed: true,
      firmLimit: null,
      unlimitedFirms: true,
      professionalsAllowed: null,
      unlimitedProfessionals: true,
      firmCaseLimit: null,
      unlimitedFirmCases: true,
      firmBrandingAllowed: true,
      firmProfilePageAllowed: true,
      firmAdminRoleAllowed: true,
      teamManagementEnabled: true,
      roleManagementAllowed: true,
      staffAccessAllowed: true,
      internalNotesAllowed: true,
      supportType: 'dedicated',
      supportResponseTime: 'Same-day',
      priorityEscalation: true,
      whatsappSupport: true,
      callSupport: true,
      featuredProfileAllowed: true,
      featuredInSearch: true,
      featuredOnHomepage: true,
      priorityRanking: true,
      priorityListing: true,
      leadPriority: true,
      customBrandingAllowed: true,
      analyticsDashboardAllowed: true,
      consultationBookingAllowed: true,
      escrowPaymentAllowed: true,
      payoutRequestAllowed: true,
      autoPayoutEligible: true,
      manualAdminApprovalRequired: true,
      isCustomPlan: true,
      customCtaLabel: 'Discuss with Support',
      customCtaAction: 'support_form',
      customCtaTarget: '/contact?topic=custom-plan',
      gracePeriodDays: 30,
      renewalReminderDays: 30,
    },
    featureRules: {
      consultation_booking: { isEnabled: true },
      escrow_payment: { isEnabled: true },
      payout_request: { isEnabled: true },
      case_management: { isEnabled: true },
      case_limit: { isEnabled: true, isUnlimited: true },
      firm_creation: { isEnabled: true, isUnlimited: true },
      firm_limit: { isEnabled: true, isUnlimited: true },
      firm_professional_limit: { isEnabled: true, isUnlimited: true },
      firm_case_limit: { isEnabled: true, isUnlimited: true },
      team_management: { isEnabled: true, isUnlimited: true },
      document_upload: { isEnabled: true },
      client_management: { isEnabled: true },
      calendar_management: { isEnabled: true },
      invoice_generation: { isEnabled: true },
      priority_support: { isEnabled: true },
      whatsapp_support: { isEnabled: true },
      featured_profile: { isEnabled: true },
      priority_listing: { isEnabled: true },
      ai_features: { isEnabled: true },
      custom_branding: { isEnabled: true },
      analytics_dashboard: { isEnabled: true },
    },
  },
];

// --- Runner --------------------------------------------------------------

async function upsertPlan(def) {
  const existing = await SubscriptionPlan.findOne({ where: { slug: def.slug } });
  if (existing) {
    console.log(`[subscription] plan exists: ${def.slug}`);
    return existing;
  }
  const created = await SubscriptionPlan.create({
    slug: def.slug,
    ...def.topLevel,
  });
  console.log(`[subscription] created plan: ${def.slug} (${created.id})`);
  return created;
}

async function upsertFeatureRules(plan, rules) {
  let created = 0;
  let skipped = 0;
  for (const [key, cfg] of Object.entries(rules)) {
    const exists = await SubscriptionFeatureRule.findOne({
      where: { subscriptionPlanId: plan.id, featureKey: key },
    });
    if (exists) {
      skipped += 1;
      continue;
    }
    await SubscriptionFeatureRule.create({
      subscriptionPlanId: plan.id,
      featureKey: key,
      featureName: FEATURE_NAME_BY_KEY[key] || key,
      isEnabled: cfg.isEnabled !== false,
      limitValue: cfg.limitValue === undefined ? null : cfg.limitValue,
      isUnlimited: cfg.isUnlimited === true,
    });
    created += 1;
  }
  console.log(
    `[subscription] feature rules for ${plan.slug}: created=${created} skipped=${skipped}`
  );
}

async function backfillStarterSubscriptions(starterPlan) {
  // Every professional / firm-admin / firm-professional should have at
  // least one active subscription so the booking / commission / feature
  // gates can always read a non-null row.
  const pros = await User.findAll({
    where: {
      role: {
        [Op.in]: ['professional', 'firm_admin', 'firm_professional', 'firm'],
      },
    },
    raw: true,
  });
  if (pros.length === 0) {
    console.log('[subscription] no professionals to backfill.');
    return;
  }
  const ids = pros.map((p) => p.id);
  const existing = await ProfessionalSubscription.findAll({
    where: { userId: { [Op.in]: ids }, status: 'active' },
    raw: true,
  });
  const haveActive = new Set(existing.map((r) => r.userId));

  let created = 0;
  for (const p of pros) {
    if (haveActive.has(p.id)) continue;
    await ProfessionalSubscription.create({
      userId: p.id,
      subscriptionPlanId: starterPlan.id,
      billingCycle: 'monthly',
      startDate: new Date(),
      endDate: null, // free plan has no expiry
      status: 'active',
      amountPaid: 0,
      currency: 'INR',
      commissionPercentSnapshot: starterPlan.commissionPercent,
      paymentStatus: 'free',
      autoRenew: false,
      adminNotes: 'Backfilled by seedSubscriptionPlans on first run.',
    });
    created += 1;
  }
  console.log(
    `[subscription] backfill: created=${created} skipped=${
      pros.length - created
    } total_professionals=${pros.length}`
  );
}

async function run() {
  await sequelize.authenticate();
  console.log('[subscription] DB connected.');

  const planBySlug = {};
  for (const def of PLANS) {
    const plan = await upsertPlan(def);
    planBySlug[def.slug] = plan;
    await upsertFeatureRules(plan, def.featureRules);
  }

  // Wire each plan's autoDowngradePlanId to point at the Starter plan so
  // expiry handling has a fallback. Skip Starter itself.
  const starter = planBySlug.starter;
  if (starter) {
    for (const slug of ['premium', 'team', 'custom']) {
      const plan = planBySlug[slug];
      if (!plan) continue;
      if (plan.autoDowngradePlanId !== starter.id) {
        await plan.update({ autoDowngradePlanId: starter.id });
        console.log(
          `[subscription] auto-downgrade target for ${slug} set to starter (${starter.id})`
        );
      }
    }
    await backfillStarterSubscriptions(starter);
  }

  console.log('[subscription] done.');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[subscription] failed:', err);
    process.exit(1);
  });

// Sequelize model: SubscriptionPlan
//
// One row per subscription tier the admin offers — Starter, Premium, Team,
// Custom, etc. Pricing, commission, limits, support tier and visibility are
// all configurable from the admin panel so future plans can be created
// without code changes.
//
// Feature flags that are too granular for top-level columns (the 21-item
// list in the spec — consultation_booking, ai_features, custom_branding, …)
// live in the related SubscriptionFeatureRule rows. Top-level columns here
// cover the dimensions every plan uses; the per-feature rules table covers
// the long tail.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `subplan-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const SubscriptionPlan = sequelize.define(
  'SubscriptionPlan',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },

    // --- Identity / display -------------------------------------------------
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(140), allowNull: false, unique: true },
    shortDescription: { type: DataTypes.STRING(500), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },

    // 'free' | 'paid' | 'custom'
    planType: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'paid' },
    // 'public' | 'private' | 'hidden'
    visibility: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'public' },
    // 'active' | 'inactive'
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },

    displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    recommendedBadge: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    featuredBadge: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    // --- Pricing -----------------------------------------------------------
    currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'INR' },

    monthlyEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    // Stored as DECIMAL so currency math stays exact across BE/FE.
    monthlyPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

    annualEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    annualPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    annualDiscountPercent: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    annualSavingsLabel: { type: DataTypes.STRING(120), allowNull: true },

    // --- Commission --------------------------------------------------------
    commissionPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 10,
    },
    // 'consultation' | 'case' | 'service' | 'all'
    commissionAppliesOn: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'all',
    },
    commissionOverrideAllowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // --- Case management ---------------------------------------------------
    caseManagementEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    caseLimit: { type: DataTypes.INTEGER, allowNull: true },
    unlimitedCases: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    caseArchiveAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    documentUploadAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    storageLimitMb: { type: DataTypes.INTEGER, allowNull: true },
    clientNotesAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    caseTimelineAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    taskManagementAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    // --- Firm creation -----------------------------------------------------
    firmCreationAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    firmLimit: { type: DataTypes.INTEGER, allowNull: true },
    unlimitedFirms: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    professionalsAllowed: { type: DataTypes.INTEGER, allowNull: true },
    unlimitedProfessionals: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    firmCaseLimit: { type: DataTypes.INTEGER, allowNull: true },
    unlimitedFirmCases: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    firmBrandingAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    firmProfilePageAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    firmAdminRoleAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    // --- Team / member limits ---------------------------------------------
    teamManagementEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    roleManagementAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    staffAccessAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    internalNotesAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    // --- Support tier -----------------------------------------------------
    // 'basic' | 'email' | 'chat' | 'priority' | 'dedicated'
    supportType: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'basic' },
    supportResponseTime: { type: DataTypes.STRING(64), allowNull: true },
    supportTicketLimit: { type: DataTypes.INTEGER, allowNull: true },
    priorityEscalation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    whatsappSupport: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    callSupport: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    // --- Featured / marketplace visibility --------------------------------
    featuredProfileAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    featuredInSearch: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    featuredOnHomepage: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    priorityRanking: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    priorityListing: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    leadPriority: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    customBrandingAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    analyticsDashboardAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    // --- Booking / escrow rules -------------------------------------------
    consultationBookingAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    bookingCalendarAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    escrowPaymentAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    payoutRequestAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    autoPayoutEligible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    manualAdminApprovalRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    cancellationRules: { type: DataTypes.TEXT, allowNull: true },
    refundRules: { type: DataTypes.TEXT, allowNull: true },
    rescheduleRules: { type: DataTypes.TEXT, allowNull: true },

    // --- Custom plan ------------------------------------------------------
    isCustomPlan: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    customCtaLabel: { type: DataTypes.STRING(120), allowNull: true },
    // 'support_form' | 'sales_form' | 'whatsapp' | 'custom_url'
    customCtaAction: { type: DataTypes.STRING(32), allowNull: true },
    customCtaTarget: { type: DataTypes.STRING(500), allowNull: true },

    // --- Expiry / grace period --------------------------------------------
    gracePeriodDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Plan id the user falls back to on expiry (usually the Starter plan).
    autoDowngradePlanId: { type: DataTypes.STRING(64), allowNull: true },
    renewalReminderDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 7 },

    // --- Razorpay subscription plan ids -----------------------------------
    // Razorpay's Subscriptions API requires a pre-created "plan" object
    // per (price, period) pair. We store the plan_id strings here so the
    // backend can hand them to subscriptions.create(). One per billing
    // cycle; null when that cycle isn't enabled on the plan.
    razorpayPlanIdMonthly: { type: DataTypes.STRING(64), allowNull: true },
    razorpayPlanIdAnnual: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    tableName: 'subscription_plans',
    timestamps: true,
    // Per the blog-tables charset lesson: pin utf8mb4 so ₹, em-dashes and
    // Devanagari descriptions survive the latin1 DB default.
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      { unique: true, fields: ['slug'] },
      { fields: ['status'] },
      { fields: ['planType'] },
      { fields: ['visibility'] },
      { fields: ['displayOrder'] },
    ],
  }
);

module.exports = SubscriptionPlan;

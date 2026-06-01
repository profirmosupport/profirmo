// Sequelize model: ProfessionalSubscription
//
// Links a professional user to the subscription plan they're currently on
// (or were previously on — rows are kept for history, status flips to
// 'cancelled' / 'expired' rather than being deleted).
//
// commission_percentage_snapshot is intentionally a denormalised copy of
// the plan's commission at the time the subscription went live. Plans can
// change commission later — payments captured against this subscription
// keep using the rate they were originally promised.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `subscr-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const ProfessionalSubscription = sequelize.define(
  'ProfessionalSubscription',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    // FK -> users.id (the professional)
    userId: { type: DataTypes.STRING(64), allowNull: false },
    // FK -> subscription_plans.id
    subscriptionPlanId: { type: DataTypes.STRING(64), allowNull: false },

    // 'monthly' | 'annual' | 'lifetime' | 'custom'
    billingCycle: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'monthly' },
    startDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    endDate: { type: DataTypes.DATE, allowNull: true },
    cancelledAt: { type: DataTypes.DATE, allowNull: true },
    // 'pending' | 'active' | 'expired' | 'cancelled' | 'grace' | 'past_due'
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },

    amountPaid: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'INR' },
    // Frozen at activation time — see file header comment for why.
    commissionPercentSnapshot: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 10,
    },

    // 'pending' | 'paid' | 'failed' | 'refunded' | 'free'
    paymentStatus: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'free',
    },
    transactionId: { type: DataTypes.STRING(120), allowNull: true },
    invoiceId: { type: DataTypes.STRING(120), allowNull: true },
    autoRenew: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    // When the user was notified about expiry / renewal (anti-spam guard).
    lastRenewalReminderAt: { type: DataTypes.DATE, allowNull: true },
    // Notes the admin can attach (manual upgrade reason, sales notes, etc.)
    adminNotes: { type: DataTypes.TEXT, allowNull: true },

    // --- Razorpay mandate / recurring subscription -------------------------
    // The Razorpay subscription_id (sub_xxx). Set when the professional
    // upgrades to a paid plan and we create a Razorpay subscription on
    // their behalf. Null for free/custom plans.
    razorpaySubscriptionId: { type: DataTypes.STRING(64), allowNull: true },
    // Razorpay customer_id (cust_xxx) — reused across subsequent
    // subscription upgrades for the same user so they don't have to
    // re-enter card details.
    razorpayCustomerId: { type: DataTypes.STRING(64), allowNull: true },
    // Mirror of the Razorpay subscription's lifecycle: 'created',
    // 'authenticated', 'active', 'paused', 'halted', 'cancelled',
    // 'completed', 'expired'. Distinct from our own `status` column
    // because Razorpay has finer-grained states we need to preserve.
    razorpaySubscriptionStatus: { type: DataTypes.STRING(24), allowNull: true },
    // Short-form payment link Razorpay returns alongside the subscription
    // — handy for "resend payment link" / email reminders.
    razorpayShortUrl: { type: DataTypes.STRING(500), allowNull: true },
  },
  {
    tableName: 'professional_subscriptions',
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      { fields: ['userId'] },
      { fields: ['subscriptionPlanId'] },
      { fields: ['status'] },
      { fields: ['endDate'] },
      // Compound — the most common read is "current active sub for user X".
      { fields: ['userId', 'status'] },
    ],
  }
);

module.exports = ProfessionalSubscription;

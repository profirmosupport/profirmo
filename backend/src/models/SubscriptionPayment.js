// Sequelize model: SubscriptionPayment
//
// Audit trail of every payment made against a subscription. One row per
// transaction — initial activation, monthly auto-renewal, annual renewal,
// upgrade-prorated charge, refund (negative amount), etc.
//
// Distinct from the booking-payments table — bookings flow through
// escrow; subscriptions are direct merchant payments to the platform.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `subpay-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const SubscriptionPayment = sequelize.define(
  'SubscriptionPayment',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    // FK -> users.id
    userId: { type: DataTypes.STRING(64), allowNull: false },
    // FK -> professional_subscriptions.id
    subscriptionId: { type: DataTypes.STRING(64), allowNull: false },
    // FK -> subscription_plans.id — denormalised for fast reporting joins.
    subscriptionPlanId: { type: DataTypes.STRING(64), allowNull: false },

    // 'monthly' | 'annual' | 'one_time'
    billingCycle: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'monthly' },

    // Money fields — DECIMAL so totals reconcile exactly.
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'INR' },
    taxAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    totalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

    // 'razorpay' | 'stripe' | 'manual' | 'free'
    paymentGateway: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'razorpay' },
    transactionId: { type: DataTypes.STRING(120), allowNull: true },
    gatewayOrderId: { type: DataTypes.STRING(120), allowNull: true },
    gatewaySignature: { type: DataTypes.STRING(255), allowNull: true },

    // 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
    paymentStatus: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'pending',
    },
    invoiceNumber: { type: DataTypes.STRING(120), allowNull: true, unique: true },
    paymentDate: { type: DataTypes.DATE, allowNull: true },

    // Refund tracking.
    refundedAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    refundedAt: { type: DataTypes.DATE, allowNull: true },
    refundReason: { type: DataTypes.STRING(500), allowNull: true },

    // Failure tracking (for failed-payment notification + retry logic).
    failureReason: { type: DataTypes.STRING(500), allowNull: true },
    failedAt: { type: DataTypes.DATE, allowNull: true },

    // Raw gateway payload for debugging — JSON for forward-compat with
    // any provider's webhook shape.
    gatewayPayload: { type: DataTypes.JSON, allowNull: true },
  },
  {
    tableName: 'subscription_payments',
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      { fields: ['userId'] },
      { fields: ['subscriptionId'] },
      { fields: ['subscriptionPlanId'] },
      { fields: ['paymentStatus'] },
      { fields: ['paymentDate'] },
      { fields: ['transactionId'] },
    ],
  }
);

module.exports = SubscriptionPayment;

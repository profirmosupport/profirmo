// Sequelize model: SubscriptionFeatureRule
//
// Per-plan feature flag + limit. One row per (plan, feature_key) pair.
// Lets the admin enable/disable + cap any of the 20+ feature_keys listed
// in the spec (consultation_booking, ai_features, custom_branding, …)
// without adding a column to subscription_plans for each one.
//
// The feature-access service reads these rows to decide whether a given
// professional's plan permits a given action — e.g. canCreateCase(user) →
// look up the user's active plan, then this table for feature_key='case_limit'.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `subrule-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const SubscriptionFeatureRule = sequelize.define(
  'SubscriptionFeatureRule',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    subscriptionPlanId: { type: DataTypes.STRING(64), allowNull: false },
    // One of the canonical feature_keys from spec §20. Snake_case
    // string — keeps cross-language lookups predictable.
    featureKey: { type: DataTypes.STRING(64), allowNull: false },
    featureName: { type: DataTypes.STRING(160), allowNull: true },
    isEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    // Use limitValue=null + isUnlimited=true for "unbounded".
    limitValue: { type: DataTypes.INTEGER, allowNull: true },
    isUnlimited: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'subscription_feature_rules',
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      { fields: ['subscriptionPlanId'] },
      { fields: ['featureKey'] },
      // Composite — the access-control layer keys (planId, featureKey).
      { unique: true, fields: ['subscriptionPlanId', 'featureKey'] },
    ],
  }
);

module.exports = SubscriptionFeatureRule;

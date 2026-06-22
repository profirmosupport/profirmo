// ComplianceObligation — one row per (client, rule, period). Generated
// by complianceObligationService.generateForClient using the rule
// definitions in seeds/compliance-rules.json + the client's
// ClientComplianceProfile.
//
// Lifecycle: pending → done | missed | not_applicable. A row stays
// for history even after it's completed so the pro can demonstrate
// continuity to auditors / tax authorities.

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `comp-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

const STATUSES = ['pending', 'done', 'missed', 'not_applicable'];

const ComplianceObligation = sequelize.define(
  'ComplianceObligation',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    professionalId: { type: DataTypes.STRING(64), allowNull: false },
    clientUserId: { type: DataTypes.STRING(64), allowNull: false },
    // Key from seeds/compliance-rules.json, e.g. 'gstr3b', 'tdsQuarterly'.
    ruleKey: { type: DataTypes.STRING(60), allowNull: false },
    // Human-readable label for the period this obligation covers, e.g.
    // "May 2026", "Q1 FY 26-27", "AY 2027-28". Kept as a string
    // because period semantics vary by rule (monthly, quarterly,
    // annual, half-yearly).
    periodLabel: { type: DataTypes.STRING(40), allowNull: false },
    // Canonical due date — drives the dashboard-calendar pill.
    dueDate: { type: DataTypes.DATEONLY, allowNull: false },
    status: {
      type: DataTypes.ENUM(...STATUSES),
      allowNull: false,
      defaultValue: 'pending',
    },
    // Stamp when the pro marks it done; useful for refund/return
    // turnaround reporting.
    completedAt: { type: DataTypes.DATE, allowNull: true },
    completedByUserId: { type: DataTypes.STRING(64), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'compliance_obligations',
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      // Idempotent generation — re-running the generator won't create
      // duplicates for the same (pro, client, rule, period) triple.
      // Custom name because the auto-generated one busts MySQL's
      // 64-char identifier limit.
      {
        name: 'uniq_comp_obl_pro_client_rule_period',
        unique: true,
        fields: ['professionalId', 'clientUserId', 'ruleKey', 'periodLabel'],
      },
      { fields: ['professionalId', 'dueDate'] },
      { fields: ['clientUserId'] },
      { fields: ['status'] },
    ],
  }
);

ComplianceObligation.STATUSES = STATUSES;

module.exports = ComplianceObligation;

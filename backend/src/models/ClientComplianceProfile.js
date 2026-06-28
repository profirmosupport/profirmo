// ClientComplianceProfile — per-client tax/legal entity metadata that
// drives WHICH compliance rules apply. One row per (professional,
// client) pair so the same client can have different profiles under
// different pros (e.g. one pro handles GST, another handles ITR).
//
// Drives the generator in complianceObligationService: given a
// profile, walk seeds/compliance-rules.json and create
// ComplianceObligation rows for the next N months.

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `comp-prof-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

// Coarse entity-type buckets — match the Indian practice taxonomy
// most CAs / lawyers use. Each maps to a different default set of
// applicable rules.
const ENTITY_TYPES = [
  'individual',
  'sole_proprietor',
  'partnership',
  'llp',
  'private_ltd',
  'public_ltd',
  'huf',
  'trust',
  'society',
];

const ClientComplianceProfile = sequelize.define(
  'ClientComplianceProfile',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    // Professional who owns this profile (ProfessionalDetail.id).
    professionalId: { type: DataTypes.STRING(64), allowNull: false },
    // users.id of the client.
    clientUserId: { type: DataTypes.STRING(64), allowNull: false },
    entityType: {
      type: DataTypes.ENUM(...ENTITY_TYPES),
      allowNull: true,
    },
    pan: { type: DataTypes.STRING(20), allowNull: true },
    gstin: { type: DataTypes.STRING(20), allowNull: true },
    cin: { type: DataTypes.STRING(30), allowNull: true },
    // GST scheme — regular / composition / null when no GST registration.
    gstScheme: {
      type: DataTypes.ENUM('regular', 'composition', 'casual', 'isd'),
      allowNull: true,
    },
    // QRMP-eligible (turnover ≤ ₹5cr previous FY). Drives quarterly
    // vs monthly GSTR-1/3B due dates.
    qrmpEligible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // True if the client is a TDS deductor (drives 24Q/26Q + monthly
    // TDS payment obligations).
    tdsDeductor: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // True if a tax audit (44AB) applies — drives the audit-report
    // + Oct/Nov ITR deadlines instead of July.
    taxAuditRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // True if turnover above the ₹5cr threshold for GSTR-9C.
    gstr9cRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'client_compliance_profiles',
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      // One profile per (pro, client) — switching entityType updates
      // the same row instead of duplicating.
      { unique: true, fields: ['professionalId', 'clientUserId'] },
      { fields: ['clientUserId'] },
    ],
  }
);

ClientComplianceProfile.ENTITY_TYPES = ENTITY_TYPES;

module.exports = ClientComplianceProfile;

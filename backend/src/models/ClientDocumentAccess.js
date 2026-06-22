// ClientDocumentAccess — per (client, professional) permission for
// the professional to see EVERY ClientDocument owned by the client
// (not just docs the pro uploaded themselves).
//
// Lifecycle:
//   pending  → pro has requested access, client hasn't decided
//   granted  → client allowed; pro sees all client docs
//   denied   → client explicitly denied
//   revoked  → previously granted then withdrawn
//
// One row per (clientUserId, professionalId) — re-requesting cycles
// the same row through statuses rather than spawning new ones.

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `cdacc-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

const STATUSES = ['pending', 'granted', 'denied', 'revoked'];

const ClientDocumentAccess = sequelize.define(
  'ClientDocumentAccess',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    clientUserId: { type: DataTypes.STRING(64), allowNull: false },
    professionalId: { type: DataTypes.STRING(64), allowNull: false },
    professionalUserId: { type: DataTypes.STRING(64), allowNull: true },
    status: {
      type: DataTypes.ENUM(...STATUSES),
      allowNull: false,
      defaultValue: 'pending',
    },
    requestedAt: { type: DataTypes.DATE, allowNull: true },
    decidedAt: { type: DataTypes.DATE, allowNull: true },
    requestNote: { type: DataTypes.STRING(255), allowNull: true },
    decisionNote: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    tableName: 'client_document_access',
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      { unique: true, fields: ['clientUserId', 'professionalId'] },
      { fields: ['clientUserId', 'status'] },
      { fields: ['professionalId', 'status'] },
    ],
  }
);

ClientDocumentAccess.STATUSES = STATUSES;

module.exports = ClientDocumentAccess;

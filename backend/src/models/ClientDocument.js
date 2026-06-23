// ClientDocument — a file the client (or one of their professionals)
// has uploaded against a specific document slot from the entity-type
// catalog (e.g. `aoa`, `pan`, `form16`). One row per uploaded copy;
// re-upload creates a new row so version history is preserved.
//
// Visibility:
//   * The client (clientUserId) ALWAYS sees their own documents.
//   * The professional who uploaded it (uploaderUserId) sees their own
//     uploads.
//   * Other professionals see this document only when the client has
//     explicitly granted them access via ClientDocumentAccess.

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `cdoc-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

const ClientDocument = sequelize.define(
  'ClientDocument',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    clientUserId: { type: DataTypes.STRING(64), allowNull: false },
    uploaderUserId: { type: DataTypes.STRING(64), allowNull: false },
    // Key from config/entityTypeRequirements.js (e.g. 'aoa', 'pan',
    // 'form16'). 'other' for ad-hoc uploads not in the catalog.
    docKey: { type: DataTypes.STRING(60), allowNull: false },
    label: { type: DataTypes.STRING(200), allowNull: true },
    // Indian financial year the document pertains to, e.g. '2025-26'.
    // Only meaningful for financial-category docs (bank statements,
    // Form 16, capital-gains statements, etc.) — null for KYC /
    // registration docs that aren't year-bound.
    financialYear: { type: DataTypes.STRING(12), allowNull: true },
    // Storage layer (storageService) — stores a path/key, not a full
    // URL, so we can swap drivers (local ↔ S3) without rewriting rows.
    storagePath: { type: DataTypes.STRING(255), allowNull: false },
    fileName: { type: DataTypes.STRING(255), allowNull: true },
    mimeType: { type: DataTypes.STRING(100), allowNull: true },
    size: { type: DataTypes.INTEGER, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'client_documents',
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      { fields: ['clientUserId'] },
      { fields: ['clientUserId', 'docKey'] },
      { fields: ['uploaderUserId'] },
      { fields: ['clientUserId', 'docKey', 'financialYear'] },
    ],
  }
);

module.exports = ClientDocument;

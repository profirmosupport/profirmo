// GmailConnection — per-user OAuth grant for Gmail integration. Each
// signed-in professional connects ONE Gmail account at a time; we
// store the long-lived refresh token + the connected email address +
// the most recent sync cursor (history id) so we don't re-process old
// messages.
//
// Tokens stored as PLAINTEXT (mirrors the AWS-secret model adopted on
// 2026-06-22). The `secret: true` flag on the admin GET response is
// what masks values from the UI; encryption tied to JWT_SECRET caused
// silent data loss on signing-secret rotation and was removed.

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `gmail-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

const GmailConnection = sequelize.define(
  'GmailConnection',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    userId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(255), allowNull: false },
    // Long-lived refresh token. Used by gmailService to mint short-lived
    // access tokens on demand. Plaintext at rest (see file header).
    refreshToken: { type: DataTypes.TEXT, allowNull: false },
    // Scopes the user actually granted — stored for diagnostics + to
    // detect downgraded grants where we have to re-prompt.
    scope: { type: DataTypes.STRING(512), allowNull: true },
    // Most recent Gmail history id we've processed. Drives incremental
    // sync — null means "first run, pull last N messages".
    lastHistoryId: { type: DataTypes.STRING(64), allowNull: true },
    lastSyncedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'gmail_connections',
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      { fields: ['userId'], unique: true },
      { fields: ['email'] },
    ],
  }
);

module.exports = GmailConnection;

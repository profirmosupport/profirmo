// GmailMessageLink — explicit pin from a Gmail message to one case.
//
// Default per-case Gmail listing matches messages by *sender email →
// client → case* — fine when each client has exactly one case. When a
// client has multiple cases, every match would otherwise show up on
// every case, so the pro can pin a message to a single case via this
// table; the pinned case wins, the others stop showing it.
//
// `pinnedByUserId` records who decided which case owns the message
// (audit trail). Composite uniqueness on (messageId, userId) ensures
// each Gmail message has at most ONE pin per professional — switching
// the pin replaces, never duplicates.

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `gmlk-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

const GmailMessageLink = sequelize.define(
  'GmailMessageLink',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    // The professional whose Gmail connection produced this message.
    userId: { type: DataTypes.STRING(64), allowNull: false },
    // Gmail message id (immutable across the message's lifetime).
    messageId: { type: DataTypes.STRING(64), allowNull: false },
    caseId: { type: DataTypes.STRING(64), allowNull: false },
    pinnedByUserId: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    tableName: 'gmail_message_links',
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      // Unique pin per (user, message) — only one case wins per pro.
      { unique: true, fields: ['userId', 'messageId'] },
      { fields: ['caseId'] },
    ],
  }
);

module.exports = GmailMessageLink;

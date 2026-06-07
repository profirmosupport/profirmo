// Sequelize model: SupportTicket
//   Submissions from the /contact page. One row per form post. Admin
//   triages them under Pipeline → Support in the admin panel.
//
//   id           - generated ticket id
//   name         - submitter name (required)
//   email        - submitter email (required, validated upstream)
//   subject      - required
//   message      - required, free text
//   status       - 'open' | 'in_progress' | 'resolved' | 'closed' (default 'open')
//   adminNote    - free-form note attached during triage
//   userId       - linked Users.id when the submitter was signed in
//   ipAddress    - client IP at submit
//   userAgent    - client User-Agent at submit
//   + timestamps

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `sup-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

const SupportTicket = sequelize.define(
  'SupportTicket',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    name: { type: DataTypes.STRING(160), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    subject: { type: DataTypes.STRING(255), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'open',
    },
    adminNote: { type: DataTypes.TEXT, allowNull: true },
    userId: { type: DataTypes.STRING(64), allowNull: true },
    ipAddress: { type: DataTypes.STRING(64), allowNull: true },
    userAgent: { type: DataTypes.STRING(500), allowNull: true },
  },
  {
    tableName: 'support_tickets',
    timestamps: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['email'] },
      { fields: ['userId'] },
    ],
  }
);

module.exports = SupportTicket;

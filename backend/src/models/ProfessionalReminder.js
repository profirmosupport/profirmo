// Sequelize model: ProfessionalReminder
//   Calendar reminders / todos a professional adds on their dashboard.
//   Each row is owned by `userId` (the professional's user account) and
//   anchors to a single calendar day (`dueDate`). Optional links to a
//   booking and/or case let the pro spin off a reminder from the relevant
//   workitem without retyping context.
//
// Columns
//   id              - generated primary key
//   userId          - owning professional (users.id)
//   dueDate         - YYYY-MM-DD anchor day
//   title           - short, required, max 200 chars
//   note            - optional long text (TEXT)
//   bookingId       - optional link to a Booking (nullable)
//   caseId          - optional link to a Case (nullable)
//   done            - completion flag (default false)
//   + timestamps

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `rem-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

const ProfessionalReminder = sequelize.define(
  'ProfessionalReminder',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    userId: { type: DataTypes.STRING(64), allowNull: false },
    dueDate: { type: DataTypes.DATEONLY, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    note: { type: DataTypes.TEXT, allowNull: true },
    bookingId: { type: DataTypes.STRING(64), allowNull: true },
    caseId: { type: DataTypes.STRING(64), allowNull: true },
    done: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Google Calendar event id when this reminder has been mirrored.
    googleEventId: { type: DataTypes.STRING(128), allowNull: true },
  },
  {
    tableName: 'professional_reminders',
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      { fields: ['userId'] },
      { fields: ['userId', 'dueDate'] },
      { fields: ['bookingId'] },
      { fields: ['caseId'] },
    ],
  }
);

module.exports = ProfessionalReminder;

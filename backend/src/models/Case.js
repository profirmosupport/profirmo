// Sequelize model: Case
//   id, clientId, professionalId, firmId, title, category, status,
//   description + timestamps
// status: 'open' | 'in-progress' | 'closed'
// Attached files live in the separate `files` table (see File model).

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `case-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const Case = sequelize.define(
  'Case',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    clientId: { type: DataTypes.STRING(64), allowNull: true },
    professionalId: { type: DataTypes.STRING(64), allowNull: true },
    firmId: { type: DataTypes.STRING(64), allowNull: true },
    title: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    category: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'open',
    },
    description: { type: DataTypes.TEXT, allowNull: true },
    // Descriptive fields added for the firm case-management module.
    priority: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'medium',
    },
    caseNumber: { type: DataTypes.STRING, allowNull: true },
    courtName: { type: DataTypes.STRING, allowNull: true },
    opposingParty: { type: DataTypes.STRING, allowNull: true },
    nextHearingDate: { type: DataTypes.DATEONLY, allowNull: true },
    // Optional: when a firm creates the case it may not yet have a
    // professional assigned. assignedByUserId records who made the assignment.
    assignedByUserId: { type: DataTypes.STRING(64), allowNull: true },
    assignedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'cases',
    timestamps: true,
    indexes: [
      { fields: ['clientId'] },
      { fields: ['professionalId'] },
      { fields: ['firmId'] },
      { fields: ['status'] },
      { fields: ['category'] },
    ],
  }
);

module.exports = Case;

// Sequelize model: CaseStatus
//   Admin-managed lookup of court case status codes (ABATED, DISPOSED,
//   PENDING, etc.). Used by anything that needs to render a normalized
//   case status dropdown — the imported E-Courts cases, the firm's own
//   cases module, search filters, etc.
//
//   `value` is the stable enum key (uppercase + underscores) and
//   `description` is the human-readable label admins see in the UI.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `cstat-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const CaseStatus = sequelize.define(
  'CaseStatus',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    value: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    description: { type: DataTypes.STRING(255), allowNull: false },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'case_statuses',
    timestamps: true,
    indexes: [
      { fields: ['value'], unique: true },
      { fields: ['active'] },
    ],
  }
);

module.exports = CaseStatus;

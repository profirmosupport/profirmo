// Sequelize model: CaseType
//   Admin-managed lookup of court case type codes (CC, WP_C, MCrA, …).
//   `value` is the stable enum key — kept case-sensitive because the
//   partner court taxonomy mixes uppercase (CONMT) with mixed-case
//   entries (Arb, MCrA, Tax_Ref). `description` is the label admins
//   see in the UI.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `ctype-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const CaseType = sequelize.define(
  'CaseType',
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
    tableName: 'case_types',
    timestamps: true,
    indexes: [
      { fields: ['value'], unique: true },
      { fields: ['active'] },
    ],
  }
);

module.exports = CaseType;

// Sequelize model: CauseListType
//   Admin-managed lookup of cause-list categorisation codes (CIVIL,
//   CRIMINAL, UNKNOWN). Tiny by design — used to bucket entries from
//   the /causelist/search endpoint into the right side of the dashboard.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `cltype-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const CauseListType = sequelize.define(
  'CauseListType',
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
    tableName: 'cause_list_types',
    timestamps: true,
    indexes: [
      { fields: ['value'], unique: true },
      { fields: ['active'] },
    ],
  }
);

module.exports = CauseListType;

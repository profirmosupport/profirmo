// Sequelize model: Country
//   Top-level location entity. Admin manages the list; signup + profile
//   forms render it as the first step of the cascading address dropdown
//   (Country → State → City).

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `country-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const Country = sequelize.define(
  'Country',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(160), allowNull: false, unique: true },
    code: { type: DataTypes.STRING(8), allowNull: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'countries',
    timestamps: true,
    indexes: [{ fields: ['slug'], unique: true }, { fields: ['active'] }],
  }
);

module.exports = Country;

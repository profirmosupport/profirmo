// Sequelize model: State
//   Sub-division of a Country. Cities link to States, States link to
//   Countries. The full Country → State → City chain drives the
//   address dropdowns + the practice-cities multi-select.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () => `state-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const State = sequelize.define(
  'State',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    countryId: { type: DataTypes.STRING(64), allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
    // 2-letter state / UT code matching the eCourts partner taxonomy
    // (DL = Delhi, MH = Maharashtra, …). Nullable so legacy rows
    // imported before this column existed don't break.
    code: { type: DataTypes.STRING(8), allowNull: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'states',
    timestamps: true,
    indexes: [
      { fields: ['slug'], unique: true },
      { fields: ['countryId'] },
      { fields: ['active'] },
    ],
  }
);

module.exports = State;

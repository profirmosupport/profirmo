// UserPreference — per-user key-value store for small UI preferences
// that should survive across devices (which view a list defaults to,
// which sort order was last picked, etc.).
//
// Deliberately generic so we don't need a fresh column + migration
// every time a new pref ships. `value` is JSON to keep things flexible
// (string / boolean / shape).
//
// Don't use this for anything large or anything queried beyond a
// single user — it's a kv table, not a search target. For data the
// product depends on (settings, roles, billing), keep using
// purpose-built columns.

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `pref-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

const UserPreference = sequelize.define(
  'UserPreference',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    userId: { type: DataTypes.STRING(64), allowNull: false },
    key: { type: DataTypes.STRING(80), allowNull: false },
    value: { type: DataTypes.JSON, allowNull: true },
  },
  {
    tableName: 'user_preferences',
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      { unique: true, fields: ['userId', 'key'] },
    ],
  }
);

module.exports = UserPreference;

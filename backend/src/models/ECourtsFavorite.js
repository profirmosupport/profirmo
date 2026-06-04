// Sequelize model: ECourtsFavorite
//
// "Starred" cases from the E-Courts India lookup page. Lightweight
// bookmark — stores just enough to render a dashboard row (CNR, title,
// status, court) without re-fetching the partner API. Distinct from
// the full Case model which is for cases the user actively manages.
//
// A (userId, cnr) pair is unique: each user can only star a CNR once.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `efav-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const ECourtsFavorite = sequelize.define(
  'ECourtsFavorite',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    userId: { type: DataTypes.STRING(64), allowNull: false },
    cnr: { type: DataTypes.STRING(32), allowNull: false },
    // Cached display fields snapshotted at star-time so the dashboard
    // does not pay for a partner API hit just to render the list.
    title: { type: DataTypes.STRING(512), allowNull: true },
    caseType: { type: DataTypes.STRING(64), allowNull: true },
    caseStatus: { type: DataTypes.STRING(64), allowNull: true },
    courtCode: { type: DataTypes.STRING(64), allowNull: true },
    filingDate: { type: DataTypes.DATEONLY, allowNull: true },
    nextHearingDate: { type: DataTypes.DATEONLY, allowNull: true },
  },
  {
    tableName: 'ecourts_favorites',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['userId', 'cnr'], unique: true, name: 'ecf_user_cnr_uniq' },
    ],
  }
);

module.exports = ECourtsFavorite;

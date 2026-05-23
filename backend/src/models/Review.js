// Sequelize model: Review
//   id, userId, clientId, clientName, professionalId, rating,
//   comment, date, status + timestamps
//
// Reviews are always against a professional. A firm's reviews are simply the
// collective reviews of every member professional under it — there is no
// firm-level review record.
//
// status: 'PUBLISHED'    — visible everywhere (default)
//         'UNDER_APPEAL' — the professional has appealed; hidden from public
//                          listings/profiles until an admin resolves it.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `review-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const Review = sequelize.define(
  'Review',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    // The authenticated user (users.id) who wrote the review.
    userId: { type: DataTypes.STRING(64), allowNull: true },
    clientId: { type: DataTypes.STRING(64), allowNull: true },
    clientName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    professionalId: { type: DataTypes.STRING(64), allowNull: true },
    rating: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    comment: { type: DataTypes.TEXT, allowNull: true },
    date: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'PUBLISHED',
    },
  },
  {
    tableName: 'reviews',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['clientId'] },
      { fields: ['professionalId'] },
      { fields: ['status'] },
    ],
  }
);

module.exports = Review;
